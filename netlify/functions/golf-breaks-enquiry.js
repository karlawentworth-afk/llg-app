const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

const TIMEOUT_MS = 9000;

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function base64urlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function verifyPass(pass, secret) {
  if (!pass || typeof pass !== "string") return { error: "missing_pass" };
  const parts = pass.split(".");
  if (parts.length !== 2) return { error: "invalid_pass_format" };
  const [payloadB64, sigB64] = parts;
  const expected = base64urlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  if (expected.length !== sigB64.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigB64))) return { error: "invalid_signature" };
  let payload;
  try { payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")); } catch { return { error: "invalid_payload" }; }
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return { error: "pass_expired" };
  if (!payload.memberId) return { error: "incomplete_pass" };
  return { payload };
}
function parseCookies(h) {
  const c = {};
  if (!h) return c;
  h.split(";").forEach(s => { const [k, ...v] = s.trim().split("="); if (k) c[k.trim()] = v.join("=").trim(); });
  return c;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };

  const secret = process.env.WIX_EMBED_SECRET;
  if (!secret) return { statusCode: 500, headers, body: JSON.stringify({ error: "server_config" }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "bad_request" }) }; }

  // Auth: pass or cookie
  let memberId;
  if (body.pass) {
    const r = verifyPass(body.pass, secret);
    if (r.error) return { statusCode: 401, headers, body: JSON.stringify({ error: r.error }) };
    memberId = r.payload.memberId;
  } else {
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
    const token = cookies["llg_session"];
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: "no_session" }) };
    const r = verifyPass(token, secret);
    if (r.error) return { statusCode: 401, headers, body: JSON.stringify({ error: r.error }) };
    memberId = r.payload.memberId;
  }

  // Validate
  const { name, email, phone, destination, travelDate, datesFlexible, partySize, nights, rounds, notes } = body;

  if (!destination || typeof destination !== "string" || destination.trim().length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_destination" }) };
  }
  if (!email || typeof email !== "string") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_email" }) };
  }

  // Build email
  const or = (v) => v && String(v).trim() ? String(v).trim() : "Not given";
  const flexNote = datesFlexible ? " (dates are flexible)" : "";

  const emailBody = [
    `Name: ${or(name)}`,
    `Email: ${or(email)}`,
    `Phone: ${or(phone)}`,
    `Destination: ${or(destination)}`,
    `Travel date: ${or(travelDate)}${flexNote}`,
    `Party size: ${or(partySize)}`,
    `Nights: ${or(nights)}`,
    `Rounds: ${or(rounds)}`,
    `Notes: ${or(notes)}`,
  ].join("\n");

  const subject = `LLG Golf Trip Enquiry - ${or(destination)} - ${or(name)}`;

  // Send email
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const recipientEmail = process.env.GOLFBREAKS_ENQUIRY_EMAIL;

  if (!smtpUser || !smtpPass || !recipientEmail) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "email_not_configured" }) };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Ladies Love Golf" <${smtpUser}>`,
      to: recipientEmail,
      cc: "info@ladieslovegolf.com",
      subject,
      text: emailBody,
    });
  } catch (err) {
    console.error("Golf Breaks email error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "email_failed" }) };
  }

  // Save to Supabase
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (sbUrl && sbKey) {
    try {
      const supabase = createClient(sbUrl, sbKey);
      await supabase.from("golf_breaks_enquiries").insert({
        wix_member_id: memberId,
        name: or(name),
        email: or(email),
        phone: or(phone),
        destination: or(destination),
        travel_date: or(travelDate) + flexNote,
        dates_flexible: !!datesFlexible,
        party_size: or(partySize),
        nights: or(nights),
        rounds: or(rounds),
        notes: or(notes),
      });
    } catch (err) {
      console.error("Golf Breaks Supabase error:", err.message);
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};

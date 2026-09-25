const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function base64urlDecode(str) { return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
function base64urlEncode(buf) { return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
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
function parseCookies(h) { const c = {}; if (!h) return c; h.split(";").forEach(s => { const [k, ...v] = s.trim().split("="); if (k) c[k.trim()] = v.join("=").trim(); }); return c; }

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

  // Auth
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

  const { action, serviceId, sessionStart, pointsAmount, moneyAmount } = body;

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "not_configured" }) };
  const supabase = createClient(sbUrl, sbKey);

  if (action === "set") {
    if (!serviceId || !pointsAmount || !moneyAmount) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };
    }

    // Delete any existing flag for this member
    await supabase.from("points_flags").delete().eq("wix_member_id", memberId);

    // Create new flag, expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await supabase.from("points_flags").insert({
      wix_member_id: memberId,
      service_id: serviceId,
      session_start: sessionStart || null,
      points_amount: pointsAmount,
      money_amount: moneyAmount,
      expires_at: expiresAt,
    });

    if (error) {
      console.error("redeem-points set error:", error.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "save_failed" }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, expiresAt }) };
  }

  if (action === "clear") {
    await supabase.from("points_flags").delete().eq("wix_member_id", memberId);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: "unknown_action" }) };
};

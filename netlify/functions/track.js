const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

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
  if (expected.length !== sigB64.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigB64))) {
    return { error: "invalid_signature" };
  }
  let payload;
  try { payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")); } catch { return { error: "invalid_payload" }; }
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || now > payload.exp) return { error: "pass_expired" };
  if (!payload.memberId) return { error: "incomplete_pass" };
  return { payload };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach(c => {
    const [k, ...v] = c.trim().split("=");
    if (k) cookies[k.trim()] = v.join("=").trim();
  });
  return cookies;
}

function getMemberId(event) {
  const secret = process.env.WIX_EMBED_SECRET;
  if (!secret) return null;

  let body;
  try { body = JSON.parse(event.body); } catch { return null; }

  if (body.pass) {
    const result = verifyPass(body.pass, secret);
    return result.payload?.memberId || null;
  }

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const token = cookies["llg_session"];
  if (token) {
    const result = verifyPass(token, secret);
    return result.payload?.memberId || null;
  }

  return null;
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

  const memberId = getMemberId(event);
  if (!memberId) return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized" }) };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers, body: JSON.stringify({ error: "not_configured" }) };

  const supabase = createClient(url, key);

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "bad_request" }) }; }

  const { action } = body;

  if (action === "event") {
    const eventName = body.event;
    if (!eventName || typeof eventName !== "string") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_event" }) };
    }
    await supabase.from("usage_events").insert({
      wix_member_id: memberId,
      event: eventName,
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (action === "feedback") {
    const message = body.message;
    const screen = body.screen;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_message" }) };
    }
    await supabase.from("feedback").insert({
      wix_member_id: memberId,
      screen: screen || "home",
      message: message.trim().substring(0, 2000),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: "unknown_action" }) };
};

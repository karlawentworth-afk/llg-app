// netlify/functions/get-portal-link.js
//
// POST { eventId }
//
// Called from our trip page when the member taps "Open your trip portal".
// Verifies the member's session, then calls the golf school's
// get-portal-links function server-to-server to get a fresh portal URL.
//
// Returns { portalUrl } or { error, noMatch }

const crypto = require("crypto");

const TIMEOUT_MS = 9000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function base64urlDecode(str) { return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
function base64urlEncode(buf) { return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

function verifySession(cookieHeader, secret) {
  if (!cookieHeader || !secret) return null;
  var match = cookieHeader.match(/llg_session=([^;]+)/);
  if (!match) return null;
  var token = match[1];
  var parts = token.split(".");
  if (parts.length !== 2) return null;
  var payloadB64 = parts[0], sigB64 = parts[1];
  var expected = base64urlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  if (expected.length !== sigB64.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigB64))) return null;
  var payload;
  try { payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")); } catch { return null; }
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
  if (!payload.contactId) return null;
  return payload;
}

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "method_not_allowed" }) };

  var secret = process.env.WIX_EMBED_SECRET;
  if (!secret) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };

  // Verify member session
  var session = verifySession(event.headers.cookie || event.headers.Cookie || "", secret);
  if (!session) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "no_session" }) };

  var memberId = session.memberId;
  var contactId = session.contactId;

  // Look up member's email from Wix (server-side, never from browser)
  var wixH = {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    "Content-Type": "application/json",
  };

  var email = "";
  try {
    var contactRes = await fetchWithTimeout(
      "https://www.wixapis.com/contacts/v4/contacts/" + encodeURIComponent(contactId) + "?fieldsets=FULL",
      { method: "GET", headers: wixH }
    );
    if (contactRes.ok) {
      var contactData = await contactRes.json();
      email = (contactData.contact?.primaryInfo?.email || "").toLowerCase();
    }
  } catch (e) {
    console.error("get-portal-link: contact lookup failed", e.message);
  }

  // Call the golf school's get-portal-links function
  var portalSecret = process.env.PORTAL_LINK_SECRET;
  var portalHost = process.env.PORTAL_HOST || "https://llggolfschool.netlify.app";

  if (!portalSecret) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "portal_not_configured" }) };

  try {
    var res = await fetchWithTimeout(portalHost + "/.netlify/functions/get-portal-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Secret": portalSecret,
      },
      body: JSON.stringify({ memberId: memberId, email: email }),
    });

    if (!res.ok) {
      console.error("get-portal-link: portal call failed", res.status);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "portal_error" }) };
    }

    var data = await res.json();

    if (data.noMatch) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: "no_match" }) };
    }

    // If a specific eventId was requested, find that link
    var body;
    try { body = JSON.parse(event.body); } catch { body = {}; }

    if (body.eventId && data.links) {
      var match = data.links.find(function(l) { return l.eventId === body.eventId; });
      if (match) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ portalUrl: match.portalUrl }) };
      }
    }

    // Return all links
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };

  } catch (err) {
    console.error("get-portal-link error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "server_error" }) };
  }
};

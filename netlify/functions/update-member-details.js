// netlify/functions/update-member-details.js
//
// POST { handicap, golfClub }
//
// Updates the verified member's own Wix contact custom fields.
// Uses WIX_CONTACTS_WRITE_KEY (not the read-only key).
// The contactId comes from the verified session, never from the browser.

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
  const match = cookieHeader.match(/llg_session=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expected = base64urlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  if (expected.length !== sigB64.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigB64))) return null;
  let payload;
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

  const secret = process.env.WIX_EMBED_SECRET;
  const writeKey = process.env.WIX_CONTACTS_WRITE_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!secret || !writeKey || !siteId) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };

  // Verify session
  const session = verifySession(event.headers.cookie || event.headers.Cookie || "", secret);
  if (!session) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "no_session" }) };

  const contactId = session.contactId;

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad_request" }) }; }

  // Build custom fields update
  const customFields = {};
  if (body.handicap !== undefined) {
    // Validate: null/"" to clear, or number 0-54 with one decimal
    if (body.handicap === null || body.handicap === "") {
      customFields["custom.handicap"] = { value: "" };
    } else {
      const h = parseFloat(body.handicap);
      if (isNaN(h) || h < 0 || h > 54) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid_handicap" }) };
      }
      customFields["custom.handicap"] = { value: String(Math.round(h * 10) / 10) };
    }
  }
  if (body.golfClub !== undefined) {
    customFields["custom.golf_club"] = { value: String(body.golfClub || "") };
  }

  if (Object.keys(customFields).length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "nothing_to_update" }) };
  }

  try {
    // First get the contact's current revision (required for PATCH)
    const getRes = await fetchWithTimeout(
      "https://www.wixapis.com/contacts/v4/contacts/" + encodeURIComponent(contactId) + "?fieldsets=FULL",
      {
        method: "GET",
        headers: {
          Authorization: writeKey,
          "wix-site-id": siteId,
          "Content-Type": "application/json",
        },
      }
    );
    if (!getRes.ok) {
      console.error("update-member-details: get contact failed", getRes.status);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "contact_lookup_failed" }) };
    }
    const contactData = await getRes.json();
    const revision = contactData.contact?.revision;

    // PATCH the contact
    const patchRes = await fetchWithTimeout(
      "https://www.wixapis.com/contacts/v4/contacts/" + encodeURIComponent(contactId),
      {
        method: "PATCH",
        headers: {
          Authorization: writeKey,
          "wix-site-id": siteId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contact: { customFields },
          revision,
        }),
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text().catch(function() { return ""; });
      console.error("update-member-details: patch failed", patchRes.status, errText);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "update_failed" }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("update-member-details error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "server_error" }) };
  }
};

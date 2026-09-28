// netlify/functions/update-member-details.js
//
// POST { firstName, lastName, phone, handicap, golfClub }
//
// Updates the verified member's own Wix contact.
// Uses WIX_CONTACTS_WRITE_KEY (not the read-only key).
// The contactId comes from the verified session, never from the browser.
// Only updates: name, phone, custom.handicap, custom.golfclub.
// Never updates email (it's the login key).

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

function tidyPhone(raw) {
  if (!raw) return "";
  var s = raw.trim();
  // Strip everything except digits, +, spaces
  s = s.replace(/[^\d+\s]/g, "");
  // Collapse multiple spaces
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function validatePhone(phone) {
  if (!phone) return true; // empty is ok (clearing)
  var digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
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
  var writeKey = process.env.WIX_CONTACTS_WRITE_KEY;
  var siteId = process.env.WIX_SITE_ID;
  if (!secret || !writeKey || !siteId) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };

  var session = verifySession(event.headers.cookie || event.headers.Cookie || "", secret);
  if (!session) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "no_session" }) };

  var contactId = session.contactId;

  var body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad_request" }) }; }

  // Build the contact update object
  var contactUpdate = {};
  var hasUpdate = false;

  // Name
  if (body.firstName !== undefined || body.lastName !== undefined) {
    contactUpdate.name = {};
    if (body.firstName !== undefined) contactUpdate.name.first = String(body.firstName || "").trim();
    if (body.lastName !== undefined) contactUpdate.name.last = String(body.lastName || "").trim();
    hasUpdate = true;
  }

  // Phone
  if (body.phone !== undefined) {
    var tidied = tidyPhone(body.phone);
    if (tidied && !validatePhone(tidied)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid_phone" }) };
    }
    contactUpdate.phones = tidied ? [{ phone: tidied }] : [];
    hasUpdate = true;
  }

  // Custom fields (handicap + golf club)
  var customFields = {};
  if (body.handicap !== undefined) {
    if (body.handicap === null || body.handicap === "") {
      customFields["custom.handicap"] = { value: "" };
    } else {
      var h = parseFloat(body.handicap);
      if (isNaN(h) || h < 0 || h > 54) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid_handicap" }) };
      }
      customFields["custom.handicap"] = { value: String(Math.round(h * 10) / 10) };
    }
    hasUpdate = true;
  }
  if (body.golfClub !== undefined) {
    customFields["custom.golfclub"] = { value: String(body.golfClub || "") };
    hasUpdate = true;
  }

  if (!hasUpdate) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "nothing_to_update" }) };
  }

  if (Object.keys(customFields).length > 0) {
    contactUpdate.customFields = customFields;
  }

  try {
    // Get current revision
    var getRes = await fetchWithTimeout(
      "https://www.wixapis.com/contacts/v4/contacts/" + encodeURIComponent(contactId) + "?fieldsets=FULL",
      {
        method: "GET",
        headers: { Authorization: writeKey, "wix-site-id": siteId, "Content-Type": "application/json" },
      }
    );
    if (!getRes.ok) {
      console.error("update-member-details: get contact failed", getRes.status);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "contact_lookup_failed" }) };
    }
    var contactData = await getRes.json();
    var revision = contactData.contact?.revision;

    // PATCH
    var patchBody = { contact: contactUpdate, revision: revision };
    var patchRes = await fetchWithTimeout(
      "https://www.wixapis.com/contacts/v4/contacts/" + encodeURIComponent(contactId),
      {
        method: "PATCH",
        headers: { Authorization: writeKey, "wix-site-id": siteId, "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      }
    );

    if (!patchRes.ok) {
      var errText = await patchRes.text().catch(function() { return ""; });
      console.error("update-member-details: patch failed", patchRes.status, errText);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "update_failed" }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("update-member-details error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "server_error" }) };
  }
};

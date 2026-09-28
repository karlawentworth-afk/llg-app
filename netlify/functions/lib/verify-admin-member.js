// lib/verify-admin-member.js
//
// Verifies the llg_session cookie and checks the member's email
// (from Wix Contacts API) against ADMIN_EMAILS env var.
//
// Returns { contactId, memberId, email } or null.
// Usage:
//   const { verifyAdminMember } = require("./lib/verify-admin-member");
//   const admin = await verifyAdminMember(event);
//   if (!admin) return { statusCode: 401, ... };

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

async function verifyAdminMember(event) {
  // Try admin password first (laptop access)
  var adminPwd = process.env.ADMIN_PASSWORD;
  var headerPwd = event.headers["x-admin-password"];
  if (adminPwd && headerPwd && headerPwd === adminPwd) {
    return { contactId: null, memberId: null, email: "admin-password" };
  }

  // Then try session cookie (app access)
  var secret = process.env.WIX_EMBED_SECRET;
  if (!secret) return null;

  var cookieHeader = event.headers.cookie || event.headers.Cookie || "";
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

  // Look up the member's email from Wix Contacts (server-side, never from browser)
  var wixH = {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    "Content-Type": "application/json",
  };
  if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

  try {
    var res = await fetchWithTimeout(
      "https://www.wixapis.com/contacts/v4/contacts/" + encodeURIComponent(payload.contactId) + "?fieldsets=FULL",
      { method: "GET", headers: wixH }
    );
    if (!res.ok) return null;
    var data = await res.json();
    var email = (data.contact?.primaryInfo?.email || "").toLowerCase();
    if (!email) return null;

    // Check against ADMIN_EMAILS
    var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
    if (!adminEmails.includes(email)) return null;

    return {
      contactId: payload.contactId,
      memberId: payload.memberId || null,
      email: email,
    };
  } catch {
    return null;
  }
}

module.exports = { verifyAdminMember };

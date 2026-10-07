// netlify/functions/ics.js
//
// GET ?booking=<bookingId>
//
// Returns a .ics calendar file for a booking.
// Verifies the booking belongs to the authenticated member.

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
  var token = match[1], parts = token.split(".");
  if (parts.length !== 2) return null;
  var expected = base64urlEncode(crypto.createHmac("sha256", secret).update(parts[0]).digest());
  if (expected.length !== parts[1].length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))) return null;
  var payload;
  try { payload = JSON.parse(base64urlDecode(parts[0]).toString("utf8")); } catch { return null; }
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
  if (!payload.memberId) return null;
  return payload;
}

function fmtIcsDate(isoStr) {
  // "2026-10-10T10:00:00" → "20261010T100000"
  return isoStr.replace(/[-:]/g, "").replace(/\.\d+Z?$/, "").split("+")[0];
}

function escIcs(s) {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method not allowed" };

  var secret = process.env.WIX_EMBED_SECRET;
  var session = verifySession(event.headers.cookie || event.headers.Cookie || "", secret);
  if (!session) return { statusCode: 401, body: "Not authenticated" };

  var bookingId = (event.queryStringParameters || {}).booking;
  if (!bookingId) return { statusCode: 400, body: "Missing booking parameter" };

  // Fetch the booking from Wix to verify it belongs to this member
  var wixH = {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    "Content-Type": "application/json",
  };
  if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

  try {
    var res = await fetchWithTimeout(
      "https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/" + encodeURIComponent(bookingId),
      { method: "GET", headers: wixH }
    );

    if (!res.ok) return { statusCode: 404, body: "Booking not found" };
    var data = await res.json();
    var booking = data.extendedBooking || data.booking || data;

    // Verify this booking belongs to the authenticated member
    var contactId = booking.contactId || booking.bookedEntity?.contactId || "";
    if (contactId && contactId !== session.contactId) {
      return { statusCode: 403, body: "This booking does not belong to you" };
    }

    var title = booking.bookedEntity?.title || booking.title || "Golf Session";
    var startDate = booking.startDate || booking.bookedEntity?.slot?.startDate || "";
    var endDate = booking.endDate || booking.bookedEntity?.slot?.endDate || "";
    var location = booking.bookedEntity?.location?.name || booking.location?.name || "";

    if (!startDate) return { statusCode: 400, body: "No start date on booking" };

    var uid = bookingId + "@ladieslovegolf.com";
    var now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z?$/, "") + "Z";

    var ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ladies Love Golf//App//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + now,
      "DTSTART:" + fmtIcsDate(startDate),
      endDate ? "DTEND:" + fmtIcsDate(endDate) : "",
      "SUMMARY:" + escIcs(title),
      location ? "LOCATION:" + escIcs(location) : "",
      "DESCRIPTION:" + escIcs("Ladies Love Golf session. Manage at ladieslovegolf.com/account/my-bookings"),
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="llg-session.ics"',
        "Cache-Control": "no-cache",
      },
      body: ics,
    };
  } catch (err) {
    console.error("ics error:", err.message);
    return { statusCode: 500, body: "Could not generate calendar file" };
  }
};

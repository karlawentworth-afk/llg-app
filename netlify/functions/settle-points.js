// netlify/functions/settle-points.js
//
// POST { bookingId, serviceId, sessionStart, contactId }
//
// Called by Wix events.js when a booking is confirmed.
// Secured with SPI_SECRET (same as check-points-flag).
//
// 1. Resolves memberId from contactId via Wix Members API
// 2. Checks points_ledger for this bookingId (idempotent)
// 3. Finds the matching points_flag
// 4. Deducts points via Wix Loyalty API
// 5. Writes to points_ledger with bookingId
// 6. Deletes the flag
//
// If no flag exists, does nothing (member booked normally).

const { createClient } = require("@supabase/supabase-js");

const TIMEOUT_MS = 9000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-SPI-Secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "method_not_allowed" }) };

  const spiSecret = process.env.SPI_SECRET;
  const reqSecret = event.headers["x-spi-secret"];
  if (!spiSecret || reqSecret !== spiSecret) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad_request" }) }; }

  const { bookingId, serviceId, contactId } = body;
  if (!bookingId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_booking_id" }) };
  }
  if (!contactId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_contact_id" }) };
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };
  const supabase = createClient(sbUrl, sbKey);

  const wixH = {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    "Content-Type": "application/json",
  };
  if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

  try {
    // 1. Resolve memberId from contactId
    const memberRes = await fetchWithTimeout(
      "https://www.wixapis.com/members/v1/members/query",
      {
        method: "POST",
        headers: wixH,
        body: JSON.stringify({
          query: { filter: { contactId: { $eq: contactId } }, paging: { limit: 1 } },
        }),
      }
    );
    let memberId = null;
    if (memberRes.ok) {
      const memberData = await memberRes.json();
      memberId = memberData.members?.[0]?.id || null;
    }
    if (!memberId) {
      console.log("settle-points: no member for contact", contactId);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "no_member" }) };
    }
    console.log("settle-points: memberId =", memberId, "bookingId =", bookingId);

    // 2. Idempotent check
    const { data: existing } = await supabase
      .from("points_ledger")
      .select("id")
      .eq("booking_id", bookingId)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from("points_flags").delete().eq("wix_member_id", memberId);
      console.log("settle-points: already settled for booking", bookingId);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "already_settled" }) };
    }

    // 3. Find the flag
    let flagQuery = supabase
      .from("points_flags")
      .select("*")
      .eq("wix_member_id", memberId);
    if (serviceId) flagQuery = flagQuery.eq("service_id", serviceId);

    const { data: flags } = await flagQuery.limit(1);
    const flag = flags?.[0];

    if (!flag) {
      console.log("settle-points: no flag for member", memberId);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "no_flag" }) };
    }
    console.log("settle-points: flag found, points =", flag.points_amount, "money =", flag.money_amount);

    // 4. Deduct points via Wix Loyalty API
    const loyaltyRes = await fetchWithTimeout(
      "https://www.wixapis.com/loyalty-accounts/v1/accounts/search",
      {
        method: "POST",
        headers: wixH,
        body: JSON.stringify({
          search: { filter: { "contact.id": { "$eq": contactId } }, cursorPaging: { limit: 1 } },
        }),
      }
    );

    if (!loyaltyRes.ok) {
      console.error("settle-points: loyalty search failed", loyaltyRes.status);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "loyalty_search_failed" }) };
    }

    const loyaltyData = await loyaltyRes.json();
    const account = loyaltyData.accounts?.[0];

    if (!account) {
      console.error("settle-points: no loyalty account for contact", contactId);
      await supabase.from("points_ledger").insert({
        wix_member_id: memberId,
        points: -flag.points_amount,
        type: "deduct",
        reason: "Session redemption \u00a3" + flag.money_amount + " (no loyalty account)",
        booking_id: bookingId,
      });
      await supabase.from("points_flags").delete().eq("id", flag.id);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: true, warning: "no_loyalty_account" }) };
    }

    const adjustRes = await fetchWithTimeout(
      "https://www.wixapis.com/loyalty-accounts/v1/accounts/" + account.id + "/adjust-points",
      {
        method: "POST",
        headers: wixH,
        body: JSON.stringify({
          amount: -flag.points_amount,
          revision: account.revision,
          description: "Points redeemed for session (\u00a3" + flag.money_amount + ")",
        }),
      }
    );

    if (!adjustRes.ok) {
      const errText = await adjustRes.text().catch(function() { return ""; });
      console.error("settle-points: adjust-points failed", adjustRes.status, errText);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "points_deduction_failed" }) };
    }

    // 5. Write to ledger
    const { error: ledgerErr } = await supabase.from("points_ledger").insert({
      wix_member_id: memberId,
      points: -flag.points_amount,
      type: "deduct",
      reason: "Session redemption \u00a3" + flag.money_amount,
      booking_id: bookingId,
    });

    if (ledgerErr) {
      if (ledgerErr.code === "23505") {
        console.log("settle-points: duplicate booking_id, already settled");
      } else {
        console.error("settle-points: ledger insert error", ledgerErr.message);
      }
    }

    // 6. Delete the flag
    await supabase.from("points_flags").delete().eq("id", flag.id);
    console.log("settle-points: settled", flag.points_amount, "points for booking", bookingId);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ settled: true, points: flag.points_amount, amount: flag.money_amount, bookingId }),
    };

  } catch (err) {
    console.error("settle-points error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "server_error" }) };
  }
};

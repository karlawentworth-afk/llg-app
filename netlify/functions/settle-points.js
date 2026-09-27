// netlify/functions/settle-points.js
//
// POST { memberId, bookingId, serviceId, sessionStart, contactId }
//
// Called by the Wix events.js backend when a booking is confirmed.
// Secured with LLG_SPI_SECRET (same secret as check-points-flag).
//
// 1. Finds the matching points_flag for this member + service
// 2. Checks points_ledger for this bookingId (idempotent: skip if
//    already settled)
// 3. Deducts points via Wix Loyalty API
// 4. Writes to points_ledger with the bookingId
// 5. Deletes the flag
//
// If there's no flag (member booked without using points), does
// nothing and returns { settled: false }.

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

  // Auth: shared secret with Wix
  const spiSecret = process.env.SPI_SECRET;
  const reqSecret = event.headers["x-spi-secret"];
  if (!spiSecret || reqSecret !== spiSecret) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad_request" }) }; }

  let { memberId, bookingId, serviceId, sessionStart, contactId } = body;
  if (!bookingId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_fields" }) };
  }
  if (!memberId && !contactId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_member_or_contact" }) };
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };
  const supabase = createClient(sbUrl, sbKey);

  try {
    // 0. Resolve memberId from contactId if needed (via Wix Members API)
    if (!memberId && contactId) {
      const wixH = {
        Authorization: process.env.WIX_API_KEY,
        "wix-site-id": process.env.WIX_SITE_ID,
        "Content-Type": "application/json",
      };
      if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

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
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        memberId = memberData.members?.[0]?.id || null;
      }
    }

    if (!memberId) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "no_member" }) };
    }

    // 1. Already settled? (idempotent check)
    const { data: existing } = await supabase
      .from("points_ledger")
      .select("id")
      .eq("booking_id", bookingId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already settled. Clean up any leftover flag.
      await supabase.from("points_flags").delete().eq("wix_member_id", memberId);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "already_settled" }) };
    }

    // 2. Find the flag for this member
    // Match on member + service if we have a serviceId, otherwise just member
    let flagQuery = supabase
      .from("points_flags")
      .select("*")
      .eq("wix_member_id", memberId);

    if (serviceId) {
      flagQuery = flagQuery.eq("service_id", serviceId);
    }

    const { data: flags } = await flagQuery.limit(1);
    const flag = flags?.[0];

    if (!flag) {
      // No flag: member booked normally without using points
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "no_flag" }) };
    }

    // 3. Resolve contactId for Loyalty API
    // The Wix booking event gives us contactId directly.
    // If not provided, we can't deduct points.
    const loyaltyContactId = contactId || null;
    if (!loyaltyContactId) {
      console.error("settle-points: no contactId for member", memberId);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: false, reason: "no_contact_id" }) };
    }

    // 4. Deduct points via Wix Loyalty API
    const wixHeaders = {
      Authorization: process.env.WIX_API_KEY,
      "wix-site-id": process.env.WIX_SITE_ID,
      "Content-Type": "application/json",
    };
    if (process.env.WIX_ACCOUNT_ID) wixHeaders["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

    // Find the loyalty account
    const loyaltyRes = await fetchWithTimeout(
      "https://www.wixapis.com/loyalty-accounts/v1/accounts/search",
      {
        method: "POST",
        headers: wixHeaders,
        body: JSON.stringify({
          search: { filter: { "contact.id": { "$eq": loyaltyContactId } }, cursorPaging: { limit: 1 } },
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
      console.error("settle-points: no loyalty account for contact", loyaltyContactId);
      // Still settle the flag to avoid blocking future bookings
      await supabase.from("points_ledger").insert({
        wix_member_id: memberId,
        points: -flag.points_amount,
        type: "deduct",
        reason: `Session redemption £${flag.money_amount} (loyalty account not found)`,
        booking_id: bookingId,
      });
      await supabase.from("points_flags").delete().eq("id", flag.id);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settled: true, warning: "no_loyalty_account" }) };
    }

    // Adjust points (deduct)
    const adjustRes = await fetchWithTimeout(
      `https://www.wixapis.com/loyalty-accounts/v1/accounts/${account.id}/adjust-points`,
      {
        method: "POST",
        headers: wixHeaders,
        body: JSON.stringify({
          amount: -flag.points_amount,
          revision: account.revision,
          description: `Points redeemed for session (£${flag.money_amount})`,
        }),
      }
    );

    if (!adjustRes.ok) {
      const errText = await adjustRes.text().catch(() => "");
      console.error("settle-points: adjust-points failed", adjustRes.status, errText);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "points_deduction_failed" }) };
    }

    // 5. Write to ledger (idempotent: unique constraint on booking_id)
    const { error: ledgerErr } = await supabase.from("points_ledger").insert({
      wix_member_id: memberId,
      points: -flag.points_amount,
      type: "deduct",
      reason: `Session redemption £${flag.money_amount}`,
      booking_id: bookingId,
    });

    if (ledgerErr) {
      // If it's a unique violation, another process already settled
      if (ledgerErr.code === "23505") {
        console.log("settle-points: duplicate booking_id, already settled");
      } else {
        console.error("settle-points: ledger insert error", ledgerErr.message);
      }
    }

    // 6. Delete the flag
    await supabase.from("points_flags").delete().eq("id", flag.id);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        settled: true,
        points: flag.points_amount,
        amount: flag.money_amount,
        bookingId,
      }),
    };

  } catch (err) {
    console.error("settle-points error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "server_error" }) };
  }
};

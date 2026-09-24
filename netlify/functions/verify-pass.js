const crypto = require("crypto");

const TIMEOUT_MS = 9000;

// Constant-time string comparison
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Base64url decode
function base64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

// Base64url encode
function base64urlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Fetch with AbortController timeout
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  const secret = process.env.WIX_EMBED_SECRET;
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  const accountId = process.env.WIX_ACCOUNT_ID;

  if (!secret || !apiKey || !siteId) {
    return { statusCode: 500, headers, body: JSON.stringify({
      error: "server_config",
      debug: { hasSecret: !!secret, hasApiKey: !!apiKey, hasSiteId: !!siteId }
    }) };
  }

  let pass;
  try {
    const body = JSON.parse(event.body);
    pass = body.pass;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "bad_request" }) };
  }

  if (!pass || typeof pass !== "string") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_pass" }) };
  }

  // --- Verify the pass ---
  const parts = pass.split(".");
  if (parts.length !== 2) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "invalid_pass_format" }) };
  }

  const [payloadB64, sigB64] = parts;

  // Recompute HMAC
  const expectedSig = base64urlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );

  if (!timingSafeEqual(expectedSig, sigB64)) {
    // TEMPORARY DEBUG — remove after testing
    return { statusCode: 401, headers, body: JSON.stringify({
      error: "invalid_signature",
      debug: {
        receivedSigLength: sigB64.length,
        expectedSigLength: expectedSig.length,
        receivedSigStart: sigB64.substring(0, 8),
        expectedSigStart: expectedSig.substring(0, 8),
        payloadB64Start: payloadB64.substring(0, 20),
        secretLength: secret.length,
        secretStart: secret.substring(0, 4),
      }
    }) };
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "invalid_payload" }) };
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || now > payload.exp) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "pass_expired" }) };
  }

  if (!payload.memberId || !payload.contactId) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "incomplete_pass" }) };
  }

  const { memberId, contactId, firstName } = payload;

  const wixHeaders = {
    Authorization: apiKey,
    "wix-site-id": siteId,
    ...(accountId ? { "wix-account-id": accountId } : {}),
    "Content-Type": "application/json",
  };

  // --- Fetch data in parallel ---
  let planResult = { name: null, status: "none" };
  let bookings = [];
  let points = 0;
  let planDebug = {};
  let bookingsDebug = {};
  let loyaltyDebug = {};

  try {
    const [planRes, bookingsRes, loyaltyRes] = await Promise.allSettled([
      // a) Pricing Plans - list orders for this member (GET with query params)
      fetchWithTimeout(
        `https://www.wixapis.com/pricing-plans/v2/orders?buyerIds=${encodeURIComponent(memberId)}&limit=5&sorting.fieldName=createdDate&sorting.order=DESC`,
        {
          method: "GET",
          headers: wixHeaders,
        }
      ),

      // b) Bookings - query extended bookings for upcoming confirmed sessions
      fetchWithTimeout(
        "https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query",
        {
          method: "POST",
          headers: wixHeaders,
          body: JSON.stringify({
            query: {
              filter: {
                "contactId": contactId,
                "status": "CONFIRMED",
                "startDate": { "$gte": new Date().toISOString() },
              },
              sort: [{ fieldName: "startDate", order: "ASC" }],
              cursorPaging: { limit: 3 },
            },
          }),
        }
      ),

      // c) Loyalty - search accounts by contact ID
      fetchWithTimeout(
        "https://www.wixapis.com/loyalty-accounts/v1/accounts/search",
        {
          method: "POST",
          headers: wixHeaders,
          body: JSON.stringify({
            search: {
              filter: { "contact.id": { "$eq": contactId } },
              cursorPaging: { limit: 1 },
            },
          }),
        }
      ),
    ]);

    // Process plan
    if (planRes.status === "fulfilled") {
      planDebug.httpStatus = planRes.value.status;
      const planBody = await planRes.value.text();
      planDebug.body = planBody.substring(0, 500);
      if (planRes.value.ok) {
        try {
          const planData = JSON.parse(planBody);
          if (planData.orders && planData.orders.length > 0) {
            const latestOrder = planData.orders[0];
            planResult = {
              name: latestOrder.planName || latestOrder.planDetails?.name || "Unknown Plan",
              status: (latestOrder.status || "unknown").toLowerCase(),
            };
          }
        } catch {}
      }
    } else {
      planDebug.error = planRes.reason?.message || "rejected";
    }

    // Process bookings (extended bookings response)
    try {
      if (bookingsRes.status === "fulfilled") {
        bookingsDebug.httpStatus = bookingsRes.value.status;
        const bookBody = await bookingsRes.value.text();
        bookingsDebug.body = bookBody.substring(0, 500);
        if (bookingsRes.value.ok) {
          const bookData = JSON.parse(bookBody);
          const items = bookData.extendedBookings || [];
          if (items.length > 0) {
            bookings = items.map((eb) => {
              const b = eb.booking || eb;
              const slot = b.bookedEntity?.slot || {};
              const startDate = slot.startDate || b.startDate;
              return {
                name: b.bookedEntity?.title || "Session",
                date: startDate
                  ? new Date(startDate).toLocaleDateString("en-GB", {
                      weekday: "short", day: "numeric", month: "short",
                    })
                  : "TBC",
                time: startDate
                  ? new Date(startDate).toLocaleTimeString("en-GB", {
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "TBC",
                location: slot.location?.name || "",
              };
            });
          }
        }
      } else {
        bookingsDebug.error = bookingsRes.reason?.message || "rejected";
      }
    } catch (e) { bookingsDebug.parseError = e.message; }

    // Process loyalty
    try {
      if (loyaltyRes.status === "fulfilled") {
        loyaltyDebug.httpStatus = loyaltyRes.value.status;
        const loyalBody = await loyaltyRes.value.text();
        loyaltyDebug.body = loyalBody.substring(0, 500);
        if (loyaltyRes.value.ok) {
          const loyalData = JSON.parse(loyalBody);
          if (loyalData.accounts && loyalData.accounts.length > 0) {
            points = loyalData.accounts[0].points?.balance || 0;
          } else if (loyalData.account) {
            points = loyalData.account.points?.balance || 0;
          }
        }
      } else {
        loyaltyDebug.error = loyaltyRes.reason?.message || "rejected";
      }
    } catch (e) { loyaltyDebug.parseError = e.message; }
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "wix_api_failed", debug: err.message }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      firstName: firstName || "Member",
      plan: planResult,
      bookings,
      points,
      _debug: { planDebug, bookingsDebug, loyaltyDebug },
    }),
  };
};

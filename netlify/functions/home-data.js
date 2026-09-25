const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 60_000;
const cache = new Map();

const SESSION_TTL_SECS = 7 * 24 * 60 * 60; // 7 days
const COOKIE_NAME = "llg_session";

const ELIGIBLE_PLAN_IDS = [
  "530c7704-3e17-4f8f-bc5a-5ceec84ae16c", // Physical
  "00478766-f484-40f0-9d4a-1fb329b54da5", // Complete
];

// --- Pass verification (shared logic) ---

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
  if (!payload.memberId || !payload.contactId) return { error: "incomplete_pass" };
  return { payload };
}

// --- Session cookie ---

function makeSessionToken(payload, secret) {
  const sessionPayload = {
    memberId: payload.memberId,
    contactId: payload.contactId,
    firstName: payload.firstName,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECS,
  };
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(sessionPayload), "utf8"));
  const sig = base64urlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  return payloadB64 + "." + sig;
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

function sessionCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECS}`;
}

// --- Fetch helpers ---

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function wixHeaders() {
  return {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    ...(process.env.WIX_ACCOUNT_ID ? { "wix-account-id": process.env.WIX_ACCOUNT_ID } : {}),
    "Content-Type": "application/json",
  };
}

// --- Data fetchers ---

async function fetchPlan(memberId, headers) {
  try {
    const res = await fetchWithTimeout(
      `https://www.wixapis.com/pricing-plans/v2/orders?buyerIds=${encodeURIComponent(memberId)}&orderStatuses=ACTIVE&limit=5`,
      { method: "GET", headers }
    );
    if (!res.ok) return { name: null, status: "none" };
    const data = await res.json();
    if (!data.orders?.length) return { name: null, status: "none" };
    const active = data.orders.find(o => o.status === "ACTIVE") || data.orders[0];
    const isEligible = ELIGIBLE_PLAN_IDS.includes(active.planId);
    return {
      name: active.planName || "Unknown Plan",
      status: (active.status || "unknown").toLowerCase(),
      planId: active.planId,
      eligible: isEligible,
      startDate: active.startDate || null,
      endDate: active.endDate || null,
      autoRenewing: active.autoRenewCanceled === false,
    };
  } catch { return { name: null, status: "none" }; }
}

async function fetchBookings(contactId, headers) {
  try {
    const res = await fetchWithTimeout(
      "https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query",
      {
        method: "POST", headers,
        body: JSON.stringify({
          query: {
            filter: { "contactDetails.contactId": contactId, "status": "CONFIRMED", "startDate": { "$gte": new Date().toISOString() } },
            sort: [{ fieldName: "startDate", order: "ASC" }],
            cursorPaging: { limit: 5 },
          },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.extendedBookings || []).map(eb => {
      const b = eb.booking || eb;
      const slot = b.bookedEntity?.slot || {};
      return {
        title: b.bookedEntity?.title || "Session",
        startDate: slot.startDate || b.startDate || null,
        endDate: slot.endDate || null,
        locationName: slot.location?.name || "",
        locationId: slot.location?.id || "",
        serviceId: slot.serviceId || "",
        eventId: slot.eventId || "",
      };
    });
  } catch { return []; }
}

async function fetchPoints(contactId, headers) {
  try {
    const res = await fetchWithTimeout(
      "https://www.wixapis.com/loyalty-accounts/v1/accounts/search",
      {
        method: "POST", headers,
        body: JSON.stringify({ search: { filter: { "contact.id": { "$eq": contactId } }, cursorPaging: { limit: 1 } } }),
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.accounts?.[0]?.points?.balance || 0;
  } catch { return 0; }
}

async function fetchBookingHistory(contactId, headers) {
  try {
    const res = await fetchWithTimeout(
      "https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query",
      {
        method: "POST", headers,
        body: JSON.stringify({
          query: {
            filter: { "contactDetails.contactId": contactId },
            sort: [{ fieldName: "startDate", order: "DESC" }],
            cursorPaging: { limit: 50 },
          },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.extendedBookings || []).map(eb => {
      const b = eb.booking || eb;
      const slot = b.bookedEntity?.slot || {};
      return { locationId: slot.location?.id || "", locationName: slot.location?.name || "" };
    });
  } catch { return []; }
}

async function fetchVenueSessions(locationId, headers) {
  try {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fromDate = now.toISOString().substring(0, 16);
    const toDate = end.toISOString().substring(0, 16);
    const res = await fetchWithTimeout(
      "https://www.wixapis.com/calendar/v3/events/query",
      {
        method: "POST", headers,
        body: JSON.stringify({
          query: {
            filter: { "location.id": locationId },
            sort: [{ fieldName: "start", order: "ASC" }],
            cursorPaging: { limit: 30 },
          },
          fromLocalDate: fromDate,
          toLocalDate: toDate,
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map(e => ({
      eventId: e.id,
      title: e.title || "Session",
      startDate: e.start?.localDate || null,
      endDate: e.end?.localDate || null,
      startUtc: e.start?.utcDate || null,
      endUtc: e.end?.utcDate || null,
      timeZone: e.start?.timeZone || "Europe/London",
      totalCapacity: e.totalCapacity || 0,
      remainingCapacity: e.remainingCapacity || 0,
      locationName: e.location?.name || "",
      recurrenceType: e.recurrenceType || "NONE",
      scheduleId: e.scheduleId || "",
      serviceId: e.externalScheduleId || "",
      resourceId: e.resources?.[0]?.id || "",
    }));
  } catch { return []; }
}

async function fetchEvents(headers) {
  try {
    const res = await fetchWithTimeout(
      "https://www.wixapis.com/events/v3/events/query",
      {
        method: "POST", headers,
        body: JSON.stringify({
          query: {
            filter: { status: "UPCOMING" },
            sort: [{ fieldName: "dateAndTimeSettings.startDate", order: "ASC" }],
            paging: { limit: 3 },
          },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map(e => ({
      id: e.id,
      title: e.title || "",
      startDate: e.dateAndTimeSettings?.startDate || null,
      location: e.location?.name || e.location?.address?.formattedAddress || "",
      slug: e.slug || "",
    }));
  } catch { return []; }
}

// --- Supabase data ---

async function getHomeVenue(supabase, memberId, contactId, wixH) {
  // Check member_prefs first
  const { data: pref } = await supabase
    .from("member_prefs")
    .select("home_venue_id")
    .eq("wix_member_id", memberId)
    .single();

  if (pref?.home_venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("*")
      .eq("id", pref.home_venue_id)
      .single();
    return { venue, source: "saved" };
  }

  // Auto-detect from booking history
  const history = await fetchBookingHistory(contactId, wixH);
  if (history.length === 0) return { venue: null, source: "none" };

  const counts = {};
  history.forEach(b => {
    if (b.locationId) counts[b.locationId] = (counts[b.locationId] || 0) + 1;
  });

  const topLocationId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topLocationId) return { venue: null, source: "none" };

  const { data: venue } = await supabase
    .from("venues")
    .select("*")
    .eq("wix_location_id", topLocationId)
    .single();

  return { venue: venue || null, source: venue ? "detected" : "none" };
}

async function getVenuePerks(supabase, venueId) {
  if (!venueId) return [];
  const { data } = await supabase
    .from("venue_perks")
    .select("text, sort_order")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order");
  return (data || []).map(p => p.text);
}

async function getSessionTopics(supabase, venueId, fromDate, toDate) {
  if (!venueId) return [];
  const { data } = await supabase
    .from("session_topics")
    .select("start_utc, title, description")
    .eq("venue_id", venueId)
    .gte("start_utc", fromDate.toISOString())
    .lte("start_utc", toDate.toISOString());
  return data || [];
}

async function getAllVenues(supabase) {
  const { data } = await supabase.from("venues").select("id, name, town").order("name");
  return data || [];
}

// --- Main handler ---

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
  if (!secret || !process.env.WIX_API_KEY || !process.env.WIX_SITE_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server_config" }) };
  }

  // Try pass from body first, then session cookie
  let pass = null;
  let setCookie = null;
  let skipCache = false;
  try {
    const body = JSON.parse(event.body);
    pass = body.pass;
    skipCache = !!body.skipCache;
  } catch {}

  let payload;

  if (pass) {
    const result = verifyPass(pass, secret);
    if (result.error) return { statusCode: 401, headers, body: JSON.stringify({ error: result.error }) };
    payload = result.payload;
    // Issue a session cookie so she's remembered
    setCookie = sessionCookieHeader(makeSessionToken(payload, secret));
  } else {
    // Check session cookie
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
    const token = cookies[COOKIE_NAME];
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: "no_session" }) };
    const result = verifyPass(token, secret);
    if (result.error) return { statusCode: 401, headers, body: JSON.stringify({ error: result.error }) };
    payload = result.payload;
  }

  const { memberId, contactId, firstName } = payload;

  // Check cache (skip after venue change)
  const cached = cache.get(memberId);
  if (!skipCache && cached && Date.now() < cached.expires) {
    const respHeaders = { ...headers };
    if (setCookie) respHeaders["Set-Cookie"] = setCookie;
    return { statusCode: 200, headers: respHeaders, body: JSON.stringify(cached.data) };
  }

  const wixH = wixHeaders();
  const supabase = getSupabase();
  const t0 = Date.now();

  // Parallel fetch: Wix data + Supabase home venue
  const [plan, bookings, points, events, homeVenueResult, allVenues] = await Promise.all([
    fetchPlan(memberId, wixH),
    fetchBookings(contactId, wixH),
    fetchPoints(contactId, wixH),
    fetchEvents(wixH),
    supabase ? getHomeVenue(supabase, memberId, contactId, wixH) : { venue: null, source: "none" },
    supabase ? getAllVenues(supabase) : [],
  ]);
  const t1 = Date.now();

  const homeVenue = homeVenueResult.venue;

  // Second parallel batch: venue-dependent data
  let sessions = [];
  let perks = [];
  let topics = [];

  if (homeVenue && supabase) {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    [sessions, perks, topics] = await Promise.all([
      homeVenue.wix_location_id ? fetchVenueSessions(homeVenue.wix_location_id, wixH) : [],
      getVenuePerks(supabase, homeVenue.id),
      getSessionTopics(supabase, homeVenue.id, now, end),
    ]);

    // Match topics to sessions by date+time
    sessions = sessions.map(s => {
      const sessionStart = s.startDate ? new Date(s.startDate) : null;
      let topic = null;
      if (sessionStart) {
        topic = topics.find(t => {
          const topicStart = new Date(t.start_utc);
          return Math.abs(topicStart.getTime() - sessionStart.getTime()) < 2 * 60 * 60 * 1000; // 2hr tolerance
        });
      }
      return {
        ...s,
        topic: topic ? { title: topic.title, description: topic.description } : null,
      };
    });
  }

  const t2 = Date.now();

  // Check which sessions the member is already booked on
  const bookedEventIds = new Set(bookings.map(b => b.eventId).filter(Boolean));
  sessions = sessions.map(s => ({
    ...s,
    isBooked: bookedEventIds.has(s.eventId),
  }));

  const data = {
    firstName: firstName || "Member",
    plan,
    bookings,
    points,
    homeVenue: homeVenue ? { id: homeVenue.id, name: homeVenue.name, town: homeVenue.town } : null,
    homeVenueSource: homeVenueResult.source,
    allVenues,
    sessions,
    perks,
    events,
    _timing: { batch1: t1 - t0, batch2: t2 - t1, total: t2 - t0 },
  };

  // Cache
  cache.set(memberId, { data, expires: Date.now() + CACHE_TTL_MS });

  const respHeaders = { ...headers };
  if (setCookie) respHeaders["Set-Cookie"] = setCookie;

  return { statusCode: 200, headers: respHeaders, body: JSON.stringify(data) };
};

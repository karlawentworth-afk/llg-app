const { createClient } = require("@supabase/supabase-js");

const TIMEOUT_MS = 9000;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function wixHeaders() {
  return {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    ...(process.env.WIX_ACCOUNT_ID ? { "wix-account-id": process.env.WIX_ACCOUNT_ID } : {}),
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };

  const adminPwd = process.env.ADMIN_PASSWORD;
  const password = event.headers["x-admin-password"];
  if (!adminPwd || password !== adminPwd) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized", debug: { hasEnv: !!adminPwd, hasHeader: !!password } }) };
  }

  const supabase = getSupabase();
  if (!supabase) return { statusCode: 500, headers, body: JSON.stringify({ error: "supabase_not_configured" }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "bad_request" }) }; }

  const { action } = body;

  try {
    if (action === "venues") return await handleVenues(supabase, headers);
    if (action === "sessions") return await handleSessions(supabase, body, headers);
    if (action === "searchTopics") return await handleSearchTopics(supabase, body, headers);
    if (action === "saveTopic") return await handleSaveTopic(supabase, body, headers);
    if (action === "copyLastMonth") return await handleCopyLastMonth(supabase, body, headers);
    if (action === "addLibraryTopic") return await handleAddLibraryTopic(supabase, body, headers);
    if (action === "lastUsed") return await handleLastUsed(supabase, body, headers);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "unknown_action" }) };
  } catch (err) {
    console.error("Planner error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server_error", detail: err.message }) };
  }
};

async function handleVenues(supabase, headers) {
  const { data } = await supabase.from("venues").select("id, name, town, wix_location_id").order("name");
  return { statusCode: 200, headers, body: JSON.stringify({ venues: data || [] }) };
}

async function handleSessions(supabase, body, headers) {
  const { venueId, year, month } = body;
  if (!venueId || !year || !month) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };
  }

  // Get venue
  const { data: venue } = await supabase.from("venues").select("*").eq("id", venueId).single();
  if (!venue?.wix_location_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "venue_not_found" }) };
  }

  // Fetch Wix sessions for this venue and month
  const fromDate = `${year}-${String(month).padStart(2, "0")}-01T00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59`;

  const res = await fetchWithTimeout(
    "https://www.wixapis.com/calendar/v3/events/query",
    {
      method: "POST",
      headers: wixHeaders(),
      body: JSON.stringify({
        query: {
          filter: { "location.id": venue.wix_location_id },
          sort: [{ fieldName: "start", order: "ASC" }],
          cursorPaging: { limit: 50 },
        },
        fromLocalDate: fromDate,
        toLocalDate: toDate,
      }),
    }
  );

  let wixSessions = [];
  if (res.ok) {
    const data = await res.json();
    wixSessions = (data.events || []).map(e => ({
      eventId: e.id,
      title: e.title || "Session",
      startDate: e.start?.localDate || null,
      endDate: e.end?.localDate || null,
      locationName: e.location?.name || "",
    }));
  }

  // Get existing topic assignments for this venue and month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const { data: existingTopics } = await supabase
    .from("session_topics")
    .select("start_utc, title, description")
    .eq("venue_id", venueId)
    .gte("start_utc", monthStart.toISOString())
    .lte("start_utc", monthEnd.toISOString());

  // Match topics to sessions
  const sessions = wixSessions.map(s => {
    const sessionStart = s.startDate ? new Date(s.startDate) : null;
    let topic = null;
    if (sessionStart && existingTopics) {
      topic = existingTopics.find(t => {
        const topicStart = new Date(t.start_utc);
        return Math.abs(topicStart.getTime() - sessionStart.getTime()) < 2 * 60 * 60 * 1000;
      });
    }
    return {
      ...s,
      currentTopic: topic ? { title: topic.title, description: topic.description } : null,
    };
  });

  return { statusCode: 200, headers, body: JSON.stringify({ sessions, venueName: venue.name }) };
}

async function handleSearchTopics(supabase, body, headers) {
  const { query, category, venueId } = body;

  let q = supabase
    .from("topic_library")
    .select("id, title, description, category")
    .eq("active", true)
    .order("title")
    .limit(30);

  if (query && query.trim().length > 0) {
    q = q.ilike("title", `%${query.trim()}%`);
  }
  if (category && category.trim().length > 0) {
    q = q.eq("category", category.trim());
  }

  const { data, error } = await q;
  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "search_failed", detail: error.message }) };
  }

  // Batch fetch last-used dates for all results at this venue
  const topics = data || [];
  if (topics.length > 0 && venueId) {
    const titles = topics.map(t => t.title);
    const { data: usages } = await supabase
      .from("session_topics")
      .select("title, start_utc")
      .eq("venue_id", venueId)
      .in("title", titles)
      .order("start_utc", { ascending: false });

    // Map: title -> most recent start_utc
    const lastUsedMap = {};
    (usages || []).forEach(u => {
      if (!lastUsedMap[u.title]) lastUsedMap[u.title] = u.start_utc;
    });

    topics.forEach(t => { t.lastUsed = lastUsedMap[t.title] || null; });
  }

  return { statusCode: 200, headers, body: JSON.stringify({ topics }) };
}

async function handleSaveTopic(supabase, body, headers) {
  const { venueId, startDate, title, description } = body;
  if (!venueId || !startDate || !title) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };
  }

  const { error } = await supabase
    .from("session_topics")
    .upsert({
      venue_id: venueId,
      start_utc: startDate,
      title,
      description: description || null,
    }, { onConflict: "venue_id,start_utc", ignoreDuplicates: false });

  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "save_failed", detail: error.message }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}

async function handleCopyLastMonth(supabase, body, headers) {
  const { venueId, year, month } = body;
  if (!venueId || !year || !month) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };
  }

  // Get last month's topics
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStart = new Date(prevYear, prevMonth - 1, 1);
  const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59);

  const { data: prevTopics } = await supabase
    .from("session_topics")
    .select("start_utc, title, description")
    .eq("venue_id", venueId)
    .gte("start_utc", prevStart.toISOString())
    .lte("start_utc", prevEnd.toISOString())
    .order("start_utc");

  if (!prevTopics || prevTopics.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ copied: 0, message: "No topics found last month" }) };
  }

  // Map by weekday + time, shift to current month
  const newTopics = [];
  for (const pt of prevTopics) {
    const prevDate = new Date(pt.start_utc);
    const dayOfWeek = prevDate.getDay();
    const hours = prevDate.getHours();
    const minutes = prevDate.getMinutes();

    // Find matching day in current month
    const firstOfMonth = new Date(year, month - 1, 1);
    let day = firstOfMonth;
    let found = false;

    // Find the first occurrence of this weekday
    while (day.getDay() !== dayOfWeek && day.getMonth() === month - 1) {
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }

    // Find which week the original was in
    const prevFirstOfMonth = new Date(prevYear, prevMonth - 1, 1);
    const weekIndex = Math.floor((prevDate.getDate() - 1) / 7);

    // Apply same week index
    const targetDate = new Date(day.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
    targetDate.setHours(hours, minutes, 0, 0);

    if (targetDate.getMonth() === month - 1) {
      newTopics.push({
        venue_id: venueId,
        start_utc: targetDate.toISOString(),
        title: pt.title,
        description: pt.description,
      });
    }
  }

  if (newTopics.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ copied: 0, message: "No topics could be mapped to this month" }) };
  }

  // Insert as draft (don't overwrite existing)
  const { data, error } = await supabase
    .from("session_topics")
    .upsert(newTopics, { onConflict: "venue_id,start_utc", ignoreDuplicates: true })
    .select();

  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "copy_failed", detail: error.message }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ copied: data?.length || 0 }) };
}

async function handleAddLibraryTopic(supabase, body, headers) {
  const { title, description, category } = body;
  if (!title || !title.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_title" }) };
  }

  // Sentence case
  const cleanTitle = title.trim().charAt(0).toUpperCase() + title.trim().slice(1).toLowerCase();

  const { data, error } = await supabase
    .from("topic_library")
    .insert({
      title: cleanTitle,
      description: description || null,
      category: category || null,
    })
    .select("id, title")
    .single();

  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "add_failed", detail: error.message }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ topic: data }) };
}

async function handleLastUsed(supabase, body, headers) {
  const { topicTitle, venueId } = body;
  if (!topicTitle) {
    return { statusCode: 200, headers, body: JSON.stringify({ lastUsed: null }) };
  }

  const { data } = await supabase
    .from("session_topics")
    .select("start_utc")
    .eq("venue_id", venueId)
    .eq("title", topicTitle)
    .order("start_utc", { ascending: false })
    .limit(1);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ lastUsed: data?.[0]?.start_utc || null }),
  };
}

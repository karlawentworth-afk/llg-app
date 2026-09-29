const { createClient } = require("@supabase/supabase-js");
const { verifyAdminMember } = require("./lib/verify-admin-member");

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

  const admin = await verifyAdminMember(event);
  if (!admin) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "no_access" }) };
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
    if (action === "editLibraryTopic") return await handleEditLibraryTopic(supabase, body, headers);
    if (action === "removeLibraryTopic") return await handleRemoveLibraryTopic(supabase, body, headers);
    if (action === "clearSessionTopic") return await handleClearSessionTopic(supabase, body, headers);
    if (action === "bulkNoSession") return await handleBulkNoSession(supabase, body, headers);
    if (action === "tidyPreview") return await handleTidyPreview(supabase, body, headers);
    if (action === "cancelSession") return await handleCancelSession(supabase, body, headers, admin);
    if (action === "findOrphans") return await handleFindOrphans(supabase, body, headers);
    if (action === "listTopicsForReview") return await handleListTopicsForReview(supabase, body, headers);
    if (action === "updateShortDescription") return await handleUpdateShortDescription(supabase, body, headers);
    if (action === "approveShortDescriptions") return await handleApproveShortDescriptions(supabase, body, headers);
    if (action === "deleteOrphans") return await handleDeleteOrphans(supabase, body, headers);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "unknown_action" }) };
  } catch (err) {
    console.error("Planner error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server_error", detail: err.message }) };
  }
};

async function handleVenues(supabase, headers) {
  const { data } = await supabase.from("venues").select("id, name, town, wix_location_id, logo_url, poster_footnote").order("name");
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

  // Paginate through all sessions for this venue and month
  let wixSessions = [];
  let cursor = null;
  for (let page = 0; page < 5; page++) {
    const paging = cursor ? { limit: 100, cursor } : { limit: 100 };
    const res = await fetchWithTimeout(
      "https://www.wixapis.com/calendar/v3/events/query",
      {
        method: "POST",
        headers: wixHeaders(),
        body: JSON.stringify({
          query: {
            filter: { "location.id": venue.wix_location_id },
            sort: [{ fieldName: "start", order: "ASC" }],
            cursorPaging: paging,
          },
          fromLocalDate: fromDate,
          toLocalDate: toDate,
        }),
      }
    );
    if (!res.ok) break;
    const data = await res.json();
    const batch = (data.events || [])
      .filter(e => e.status !== "CANCELLED" && e.type === "CLASS")
      .map(e => ({
        eventId: e.id,
        title: e.title || "Session",
        startDate: e.start?.localDate || null,
        endDate: e.end?.localDate || null,
        startUtc: e.start?.utcDate || null,
        endUtc: e.end?.utcDate || null,
        timeZone: e.start?.timeZone || "Europe/London",
        locationName: e.location?.name || "",
        scheduleId: e.scheduleId || "",
        externalScheduleId: e.externalScheduleId || "",
        status: e.status || "",
        type: e.type || "",
        totalCapacity: e.totalCapacity || 0,
        remainingCapacity: e.remainingCapacity || 0,
      }));
    wixSessions = wixSessions.concat(batch);
    cursor = data.pagingMetadata?.cursors?.next || null;
    if (!cursor) break;
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

  // Fetch short descriptions from topic library for poster use
  const topicTitles = [...new Set((existingTopics || []).map(t => t.title).filter(Boolean))];
  let shortDescMap = {};
  if (topicTitles.length > 0) {
    const { data: libTopics } = await supabase
      .from("topic_library")
      .select("title, short_description, short_description_status")
      .in("title", topicTitles);
    (libTopics || []).forEach(lt => {
      if (lt.short_description && lt.short_description_status === "approved") {
        shortDescMap[lt.title] = lt.short_description;
      }
    });
  }

  // Match topics to sessions
  const sessions = wixSessions.map(s => {
    const sessionStart = s.startDate ? new Date(s.startDate) : null;
    let topic = null;
    if (sessionStart && existingTopics) {
      topic = existingTopics.find(t => {
        const topicStart = new Date(t.start_utc);
        return Math.abs(topicStart.getTime() - sessionStart.getTime()) < 15 * 60 * 1000;
      });
    }
    return {
      ...s,
      currentTopic: topic ? { title: topic.title, description: topic.description, shortDescription: shortDescMap[topic.title] || null } : null,
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

async function handleEditLibraryTopic(supabase, body, headers) {
  const { topicId, title, description, category } = body;
  if (!topicId) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_topic_id" }) };

  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description || null;
  if (category !== undefined) update.category = category || null;

  if (Object.keys(update).length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "nothing_to_update" }) };
  }

  const { error } = await supabase.from("topic_library").update(update).eq("id", topicId);
  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "update_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}

async function handleRemoveLibraryTopic(supabase, body, headers) {
  const { topicId } = body;
  if (!topicId) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_topic_id" }) };

  // Soft-delete: set active = false (keeps history)
  const { error } = await supabase.from("topic_library").update({ active: false }).eq("id", topicId);
  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "remove_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}

async function handleClearSessionTopic(supabase, body, headers) {
  const { venueId, startDate } = body;
  if (!venueId || !startDate) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };

  // Delete the assignment entirely (rather than setting to "(none)")
  const sessionStart = new Date(startDate);
  const windowStart = new Date(sessionStart.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(sessionStart.getTime() + 15 * 60 * 1000);

  const { error } = await supabase
    .from("session_topics")
    .delete()
    .eq("venue_id", venueId)
    .gte("start_utc", windowStart.toISOString())
    .lte("start_utc", windowEnd.toISOString());

  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "clear_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}

async function handleBulkNoSession(supabase, body, headers) {
  // Convert all blank (unassigned) sessions in a month to "No session this day"
  const { venueId, year, month, sessions } = body;
  if (!venueId || !sessions || !Array.isArray(sessions)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };
  }

  const rows = sessions.map(function(s) {
    return {
      venue_id: venueId,
      start_utc: s.startDate,
      title: "No session this day",
      description: null,
    };
  });

  if (rows.length === 0) return { statusCode: 200, headers, body: JSON.stringify({ marked: 0 }) };

  const { data, error } = await supabase
    .from("session_topics")
    .upsert(rows, { onConflict: "venue_id,start_utc", ignoreDuplicates: true })
    .select();

  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "bulk_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ marked: data?.length || 0 }) };
}

async function handleTidyPreview(supabase, body, headers) {
  // List sessions marked "No session this day" with their booking counts
  const { venueId, year, month } = body;
  if (!venueId || !year || !month) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };

  const monthStart = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = new Date(year, month - 1, lastDay, 23, 59, 59);

  // Get session_topics marked as "No session this day"
  const { data: noSessions } = await supabase
    .from("session_topics")
    .select("start_utc")
    .eq("venue_id", venueId)
    .eq("title", "No session this day")
    .gte("start_utc", monthStart.toISOString())
    .lte("start_utc", monthEnd.toISOString());

  if (!noSessions || noSessions.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ canCancel: [], hasBookings: [] }) };
  }

  // Get venue for Wix location
  const { data: venue } = await supabase.from("venues").select("wix_location_id").eq("id", venueId).single();
  if (!venue?.wix_location_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "venue_not_found" }) };
  }

  // Fetch Wix sessions for this month
  const fromDate = year + "-" + String(month).padStart(2, "0") + "-01T00:00";
  const toDate = year + "-" + String(month).padStart(2, "0") + "-" + lastDay + "T23:59";

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

  if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: "wix_fetch_failed" }) };
  const wixData = await res.json();
  const wixEvents = wixData.events || [];

  // Match "No session" markers to Wix events
  var canCancel = [];
  var hasBookings = [];

  noSessions.forEach(function(ns) {
    var nsTime = new Date(ns.start_utc).getTime();
    var match = wixEvents.find(function(e) {
      if (e.status === "CANCELLED") return false;
      var eTime = e.start?.localDate ? new Date(e.start.localDate).getTime() : 0;
      return Math.abs(eTime - nsTime) < 15 * 60 * 1000;
    });
    if (!match) return;

    var booked = (match.totalCapacity || 0) - (match.remainingCapacity || 0);
    var entry = {
      eventId: match.id,
      startDate: match.start?.localDate || null,
      title: match.title || "Session",
      booked: booked,
    };

    if (booked > 0) {
      hasBookings.push(entry);
    } else {
      canCancel.push(entry);
    }
  });

  return { statusCode: 200, headers, body: JSON.stringify({ canCancel, hasBookings }) };
}

async function handleCancelSession(supabase, body, headers, admin) {
  // Cancel a single Wix calendar event (INSTANCE of recurring)
  const { eventId, venueId } = body;
  if (!eventId) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_event_id" }) };

  var writeKey = process.env.WIX_CONTACTS_WRITE_KEY;
  var siteId = process.env.WIX_SITE_ID;
  if (!writeKey || !siteId) return { statusCode: 500, headers, body: JSON.stringify({ error: "not_configured" }) };

  try {
    var res = await fetchWithTimeout(
      "https://www.wixapis.com/calendar/v3/events/" + encodeURIComponent(eventId) + "/cancel",
      {
        method: "POST",
        headers: {
          Authorization: writeKey,
          "wix-site-id": siteId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantNotification: { notifyParticipants: false },
        }),
      }
    );

    if (!res.ok) {
      var errText = await res.text().catch(function() { return ""; });
      console.error("cancelSession: Wix cancel failed", res.status, errText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "cancel_failed", detail: errText.slice(0, 200) }) };
    }

    // Log the cancellation
    await supabase.from("session_cancellations").insert({
      wix_event_id: eventId,
      venue_id: venueId || null,
      cancelled_by: admin?.email || "unknown",
    }).catch(function(err) { console.error("Cancel log error:", err.message); });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("cancelSession error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server_error" }) };
  }
}

async function handleFindOrphans(supabase, body, headers) {
  var { venueId, year, month } = body;
  if (!venueId || !year || !month) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_fields" }) };

  var venue = (await supabase.from("venues").select("*").eq("id", venueId).single()).data;
  if (!venue || !venue.wix_location_id) return { statusCode: 400, headers, body: JSON.stringify({ error: "venue_not_found" }) };

  // Get all topic assignments for this venue and month
  var monthStart = new Date(year, month - 1, 1);
  var lastDay = new Date(year, month, 0).getDate();
  var monthEnd = new Date(year, month - 1, lastDay, 23, 59, 59);

  var { data: topics } = await supabase
    .from("session_topics")
    .select("id, start_utc, title, description")
    .eq("venue_id", venueId)
    .gte("start_utc", monthStart.toISOString())
    .lte("start_utc", monthEnd.toISOString())
    .order("start_utc");

  if (!topics || topics.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ orphans: [] }) };
  }

  // Fetch Wix sessions for this month (paginated)
  var fromDate = year + "-" + String(month).padStart(2, "0") + "-01T00:00";
  var toDate = year + "-" + String(month).padStart(2, "0") + "-" + lastDay + "T23:59";
  var wixTimes = [];
  var cursor = null;

  for (var page = 0; page < 5; page++) {
    var paging = cursor ? { limit: 100, cursor: cursor } : { limit: 100 };
    var res = await fetchWithTimeout(
      "https://www.wixapis.com/calendar/v3/events/query",
      {
        method: "POST",
        headers: wixHeaders(),
        body: JSON.stringify({
          query: {
            filter: { "location.id": venue.wix_location_id },
            sort: [{ fieldName: "start", order: "ASC" }],
            cursorPaging: paging,
          },
          fromLocalDate: fromDate,
          toLocalDate: toDate,
        }),
      }
    );
    if (!res.ok) break;
    var data = await res.json();
    (data.events || []).forEach(function(e) {
      if (e.status !== "CANCELLED" && e.type === "CLASS" && e.start && e.start.localDate) {
        wixTimes.push(new Date(e.start.localDate).getTime());
      }
    });
    cursor = data.pagingMetadata && data.pagingMetadata.cursors ? data.pagingMetadata.cursors.next : null;
    if (!cursor) break;
  }

  // Find orphans: topic assignments with no matching Wix session (within 2 hours)
  var orphans = topics.filter(function(t) {
    if (t.title === "No session this day") return false; // expected to have no session
    var topicTime = new Date(t.start_utc).getTime();
    return !wixTimes.some(function(wt) {
      return Math.abs(wt - topicTime) < 15 * 60 * 1000;
    });
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      orphans: orphans.map(function(o) {
        return { id: o.id, startUtc: o.start_utc, title: o.title };
      }),
    }),
  };
}

async function handleDeleteOrphans(supabase, body, headers) {
  var { orphanIds } = body;
  if (!orphanIds || !Array.isArray(orphanIds) || orphanIds.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_orphan_ids" }) };
  }

  var { error } = await supabase
    .from("session_topics")
    .delete()
    .in("id", orphanIds);

  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "delete_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: orphanIds.length }) };
}

async function handleListTopicsForReview(supabase, body, headers) {
  var { data, error } = await supabase
    .from("topic_library")
    .select("id, title, description, short_description, short_description_status")
    .eq("active", true)
    .order("title");

  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "fetch_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ topics: data || [] }) };
}

async function handleUpdateShortDescription(supabase, body, headers) {
  var { topicId, shortDescription, status } = body;
  if (!topicId) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_topic_id" }) };

  var update = {};
  if (shortDescription !== undefined) update.short_description = shortDescription;
  if (status) update.short_description_status = status;

  var { error } = await supabase.from("topic_library").update(update).eq("id", topicId);
  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "update_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}

async function handleApproveShortDescriptions(supabase, body, headers) {
  var { topicIds } = body;
  if (!topicIds || !Array.isArray(topicIds) || topicIds.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_topic_ids" }) };
  }

  var { error } = await supabase
    .from("topic_library")
    .update({ short_description_status: "approved" })
    .in("id", topicIds);

  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: "approve_failed", detail: error.message }) };
  return { statusCode: 200, headers, body: JSON.stringify({ approved: topicIds.length }) };
}

const { createClient } = require("@supabase/supabase-js");

const TIMEOUT_MS = 9000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  // Check admin password
  const password = event.headers["x-admin-password"];
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized" }) };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "supabase_not_configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "bad_request" }) };
  }

  const { action, rows } = body;

  // Preview: validate and match rows to venues
  if (action === "preview") {
    return await handlePreview(supabase, rows, headers);
  }

  // Save: insert matched rows
  if (action === "save") {
    return await handleSave(supabase, rows, headers);
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: "unknown_action" }) };
};

async function handlePreview(supabase, rows, headers) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "no_rows" }) };
  }

  // Fetch all venues for matching
  const { data: venues, error: venueErr } = await supabase
    .from("venues")
    .select("id, name, wix_location_id");

  if (venueErr) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "venues_fetch_failed", detail: venueErr.message }) };
  }

  const results = rows.map((row, i) => {
    const venue = venues.find(
      (v) => v.name.toLowerCase() === (row.venue || "").toLowerCase()
    );

    if (!venue) {
      return { row: i + 1, status: "error", message: `Venue not found: ${row.venue}`, ...row };
    }

    if (!row.date || !row.start_time || !row.title) {
      return { row: i + 1, status: "error", message: "Missing date, start_time or title", ...row };
    }

    // Build UTC timestamp from date + time (assume UK time)
    const localStr = `${row.date}T${row.start_time}:00`;

    return {
      row: i + 1,
      status: "ok",
      venue_id: venue.id,
      venue_name: venue.name,
      start_local: localStr,
      title: row.title,
      description: row.description || "",
    };
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ preview: results }),
  };
}

async function handleSave(supabase, rows, headers) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "no_rows" }) };
  }

  // rows should be the previewed+confirmed rows with venue_id and start_local
  const inserts = rows
    .filter((r) => r.status === "ok")
    .map((r) => ({
      venue_id: r.venue_id,
      start_utc: r.start_local, // Supabase will store as timestamptz
      title: r.title,
      description: r.description || null,
    }));

  if (inserts.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "no_valid_rows" }) };
  }

  const { data, error } = await supabase
    .from("session_topics")
    .upsert(inserts, { onConflict: "venue_id,start_utc", ignoreDuplicates: false })
    .select();

  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "insert_failed", detail: error.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ saved: data.length }),
  };
}

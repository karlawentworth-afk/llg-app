// netlify/functions/video-library.js
//
// GET  ?action=list                       → all active videos (with category, on_course, progress)
// GET  ?action=list&category=Putting      → filter by category
// GET  ?action=list&onCourse=true         → filter on-course videos
// GET  ?action=stream&id=<uuid>           → generate HLS streaming URL
// POST { action: "progress", videoId, position, completed } → save watch progress
// GET  ?action=progress                   → get all watch progress for this member
//
// Auth: llg_session cookie (verified member). Free videos list without auth.

const crypto = require("crypto");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

const TIMEOUT_MS = 9000;

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

function wixPost(path, body) {
  return new Promise((resolve, reject) => {
    var payload = JSON.stringify(body);
    var req = https.request({
      hostname: "www.wixapis.com", path: path, method: "POST",
      headers: {
        Authorization: process.env.WIX_API_KEY,
        "wix-site-id": process.env.WIX_SITE_ID,
        "Content-Type": "application/json",
      },
    }, res => {
      var d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: d.slice(0, 200) }); } });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(payload);
    req.end();
  });
}

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  var secret = process.env.WIX_EMBED_SECRET;
  var session = verifySession(event.headers.cookie || event.headers.Cookie || "", secret);
  var memberId = session ? session.memberId : null;

  var sbUrl = process.env.SUPABASE_URL;
  var sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };
  var supabase = createClient(sbUrl, sbKey);

  var qs = event.queryStringParameters || {};
  var action = qs.action || "";
  if (event.httpMethod === "POST") {
    try { var body = JSON.parse(event.body || "{}"); action = body.action || action; } catch {}
  }

  // LIST: all active videos with optional filters
  if (action === "list") {
    var query = supabase
      .from("videos")
      .select("id, wix_file_id, title, description, category, thumbnail_url, is_free, on_course, featured, sort_order")
      .eq("active", true)
      .order("sort_order")
      .order("title");

    // Category filter
    if (qs.category) query = query.eq("category", qs.category);
    // On-course filter
    if (qs.onCourse === "true") query = query.eq("on_course", true);

    var { data: videos } = await query;

    // Get progress if member is logged in
    var progressMap = {};
    if (memberId) {
      var { data: progress } = await supabase
        .from("video_progress")
        .select("video_id, position_seconds, completed, updated_at")
        .eq("wix_member_id", memberId);
      (progress || []).forEach(function(p) { progressMap[p.video_id] = p; });
    }

    // Build category list
    var categories = [];
    var catSet = {};
    var featured = [];
    (videos || []).forEach(function(v) {
      v.progress = progressMap[v.id] || null;
      var cat = v.category || "Other";
      if (!catSet[cat]) { catSet[cat] = true; categories.push(cat); }
      if (v.featured) featured.push(v);
    });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        videos: videos || [],
        categories: categories,
        featured: featured,
      }),
    };
  }

  // STREAM: generate HLS URL for a video (requires session for non-free)
  if (action === "stream") {
    var videoId = qs.id || (event.httpMethod === "POST" ? JSON.parse(event.body || "{}").id : "");
    if (!videoId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_id" }) };

    var { data: vid } = await supabase.from("videos").select("wix_file_id, is_free").eq("id", videoId).single();
    if (!vid) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "not_found" }) };

    // Free videos: anyone can stream. Members-only: require session
    if (!vid.is_free && !memberId) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "no_session" }) };
    }

    var streamRes = await wixPost("/site-media/v1/files/generate-video-stream-url", {
      fileId: vid.wix_file_id,
      format: "HLS",
      expirationInMinutes: 120,
    });

    if (!streamRes.downloadUrl?.url) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "stream_failed", detail: JSON.stringify(streamRes).slice(0, 200) }) };
    }

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ streamUrl: streamRes.downloadUrl.url }),
    };
  }

  // PROGRESS: save watch position (requires session)
  if (action === "progress" && event.httpMethod === "POST") {
    if (!memberId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "no_session" }) };
    var pbody = JSON.parse(event.body || "{}");
    var vidId = pbody.videoId;
    var position = parseInt(pbody.position || 0, 10);
    var completed = !!pbody.completed;
    if (!vidId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_videoId" }) };

    await supabase.from("video_progress").upsert({
      wix_member_id: memberId,
      video_id: vidId,
      position_seconds: position,
      completed: completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "wix_member_id,video_id" });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  // GET PROGRESS: all progress for this member (requires session)
  if (action === "progress" && event.httpMethod === "GET") {
    if (!memberId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "no_session" }) };
    var { data: prog } = await supabase
      .from("video_progress")
      .select("video_id, position_seconds, completed, updated_at")
      .eq("wix_member_id", memberId)
      .order("updated_at", { ascending: false });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ progress: prog || [] }) };
  }

  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "unknown_action" }) };
};

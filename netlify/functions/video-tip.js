// netlify/functions/video-tip.js
//
// GET  → current video tip (public)
// POST { videoUrl, title, thumbnailUrl } → update tip (admin only)

const { createClient } = require("@supabase/supabase-js");
const verifyAdmin = require("./lib/verify-admin-member");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  var sbUrl = process.env.SUPABASE_URL;
  var sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };
  var supabase = createClient(sbUrl, sbKey);

  // GET: return current tip
  if (event.httpMethod === "GET") {
    try {
      var { data } = await supabase.from("video_tip").select("video_url, title, thumbnail_url, updated_at").eq("id", 1).single();
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ tip: data || { video_url: "", title: "", thumbnail_url: "" } }),
      };
    } catch {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ tip: { video_url: "", title: "", thumbnail_url: "" } }) };
    }
  }

  // POST: admin update
  if (event.httpMethod === "POST") {
    var admin = await verifyAdmin(event);
    if (!admin.ok) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };

    var body;
    try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad_json" }) }; }

    var { error } = await supabase.from("video_tip").update({
      video_url: (body.videoUrl || "").trim(),
      title: (body.title || "").trim(),
      thumbnail_url: (body.thumbnailUrl || "").trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "method_not_allowed" }) };
};

// netlify/functions/prize-draw.js
//
// GET  ?action=list           → all published draws + current month
// GET  ?action=video-url&id=X → signed URL for uploaded video
// POST { action: "save", ... }       → admin: save/update draw
// POST { action: "search-member", query } → admin: search Wix contacts
// POST { action: "publish", id }     → admin: publish winner
// POST { action: "upload-url", id, filename, contentType } → admin: get upload URL
// GET  ?action=entrants       → admin: CSV of this month's entrants

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { verifyAdminMember } = require("./lib/verify-admin-member");

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
  return payload;
}

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, X-Admin-Email",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ALLOWED_VIDEO_DOMAINS = ["instagram.com", "www.instagram.com", "facebook.com", "www.facebook.com", "fb.watch", "youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"];

function validateVideoUrl(url) {
  if (!url) return true; // empty is fine
  try {
    var u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_VIDEO_DOMAINS.some(function(d) { return u.hostname === d; });
  } catch { return false; }
}

function videoSource(url) {
  if (!url) return null;
  try {
    var u = new URL(url);
    if (u.hostname.includes("instagram")) return "instagram";
    if (u.hostname.includes("facebook") || u.hostname === "fb.watch") return "facebook";
    if (u.hostname.includes("youtube") || u.hostname === "youtu.be") return "youtube";
  } catch {}
  return "link";
}

function youtubeEmbedId(url) {
  if (!url) return null;
  try {
    var u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
    var v = u.searchParams.get("v");
    if (v) return v;
  } catch {}
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  var sbUrl = process.env.SUPABASE_URL;
  var sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "not_configured" }) };
  var supabase = createClient(sbUrl, sbKey);

  var qs = event.queryStringParameters || {};
  var action = qs.action || "";
  if (event.httpMethod === "POST") {
    try { var body = JSON.parse(event.body || "{}"); action = body.action || action; } catch {}
  }

  // LIST: all published draws + current month (even if unpublished, for members to see the prize)
  if (action === "list") {
    var now = new Date();
    var thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";

    var { data: draws } = await supabase
      .from("prize_draws")
      .select("id, month, prize, draw_at, winner_display, video_url, video_path, published")
      .or("published.eq.true,month.eq." + thisMonth)
      .order("month", { ascending: false });

    // Don't expose video_path directly; indicate if an upload exists
    (draws || []).forEach(function(d) {
      d.hasUploadedVideo = !!d.video_path;
      d.videoSource = videoSource(d.video_url);
      d.youtubeId = youtubeEmbedId(d.video_url);
      delete d.video_path;
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ draws: draws || [] }) };
  }

  // VIDEO-URL: signed URL for an uploaded video
  if (action === "video-url") {
    var id = qs.id;
    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_id" }) };

    var { data: draw } = await supabase.from("prize_draws").select("video_path").eq("id", id).single();
    if (!draw || !draw.video_path) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "no_video" }) };

    var { data: signedUrl } = await supabase.storage
      .from("prize-draw-videos")
      .createSignedUrl(draw.video_path, 600); // 10 minutes

    if (!signedUrl) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "sign_failed" }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: signedUrl.signedUrl }) };
  }

  // --- ADMIN ACTIONS ---

  // SAVE: create or update a draw
  if (action === "save") {
    var admin = await verifyAdminMember(event);
    if (!admin) {
      var emailHeader = (event.headers["x-admin-email"] || "").trim().toLowerCase();
      var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      if (!emailHeader || !adminEmails.includes(emailHeader)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var month = body.month; // "2026-10-01"
    if (!month) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_month" }) };

    var update = { prize: (body.prize || "").trim(), updated_at: new Date().toISOString() };
    if (body.draw_at !== undefined) update.draw_at = body.draw_at || null;
    if (body.winner_display !== undefined) update.winner_display = (body.winner_display || "").trim() || null;
    if (body.winner_contact_id !== undefined) update.winner_contact_id = body.winner_contact_id || null;
    if (body.video_url !== undefined) {
      var vurl = (body.video_url || "").trim();
      if (vurl && !validateVideoUrl(vurl)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid_video_url" }) };
      update.video_url = vurl || null;
    }

    // Upsert by month
    var { data, error } = await supabase.from("prize_draws")
      .upsert({ month: month, ...update }, { onConflict: "month" })
      .select()
      .single();

    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ draw: data }) };
  }

  // PUBLISH: mark a draw as published
  if (action === "publish") {
    var admin = await verifyAdminMember(event);
    if (!admin) {
      var emailHeader = (event.headers["x-admin-email"] || "").trim().toLowerCase();
      var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      if (!emailHeader || !adminEmails.includes(emailHeader)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var { error } = await supabase.from("prize_draws")
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq("id", body.id);

    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  // SEARCH-MEMBER: search Wix contacts by name
  if (action === "search-member") {
    var admin = await verifyAdminMember(event);
    if (!admin) {
      var emailHeader = (event.headers["x-admin-email"] || "").trim().toLowerCase();
      var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      if (!emailHeader || !adminEmails.includes(emailHeader)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var query = (body.query || "").trim();
    if (!query || query.length < 2) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "query_too_short" }) };

    var wixH = {
      Authorization: process.env.WIX_API_KEY,
      "wix-site-id": process.env.WIX_SITE_ID,
      "Content-Type": "application/json",
    };
    if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

    try {
      var res = await fetchWithTimeout("https://www.wixapis.com/contacts/v4/contacts/search", {
        method: "POST", headers: wixH,
        body: JSON.stringify({
          search: { expression: query },
          paging: { limit: 10 },
        }),
      });
      if (!res.ok) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "search_failed" }) };
      var data = await res.json();
      var contacts = (data.contacts || []).map(function(c) {
        var first = c.info?.name?.first || "";
        var last = c.info?.name?.last || "";
        return {
          contactId: c.id,
          name: (first + " " + last).trim(),
          firstName: first,
          lastInitial: last ? last[0] + "." : "",
          display: first + (last ? " " + last[0] + "." : ""),
        };
      });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ contacts: contacts }) };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
  }

  // UPLOAD-URL: get a signed upload URL for Supabase Storage
  if (action === "upload-url") {
    var admin = await verifyAdminMember(event);
    if (!admin) {
      var emailHeader = (event.headers["x-admin-email"] || "").trim().toLowerCase();
      var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      if (!emailHeader || !adminEmails.includes(emailHeader)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var drawId = body.id;
    var contentType = body.contentType || "video/mp4";
    if (!drawId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_id" }) };
    if (contentType !== "video/mp4" && contentType !== "video/quicktime") {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid_content_type" }) };
    }

    var ext = contentType === "video/quicktime" ? "mov" : "mp4";
    var path = drawId + "/draw." + ext;

    var { data: uploadData, error: uploadError } = await supabase.storage
      .from("prize-draw-videos")
      .createSignedUploadUrl(path);

    if (uploadError) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: uploadError.message }) };

    // Save the path to the draw record
    await supabase.from("prize_draws")
      .update({ video_path: path, updated_at: new Date().toISOString() })
      .eq("id", drawId);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ uploadUrl: uploadData.signedUrl, token: uploadData.token, path: path }) };
  }

  // ENTRANTS: CSV of active Digital and Complete members
  if (action === "entrants") {
    var admin = await verifyAdminMember(event);
    if (!admin) {
      var emailHeader = (qs.email || event.headers["x-admin-email"] || "").trim().toLowerCase();
      var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      if (!emailHeader || !adminEmails.includes(emailHeader)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };
    }

    var wixH = {
      Authorization: process.env.WIX_API_KEY,
      "wix-site-id": process.env.WIX_SITE_ID,
      "Content-Type": "application/json",
    };
    if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

    // Digital and Complete plan IDs
    var digitalPlanId = "8324fc1b-c344-454c-af4d-eed9639b7222";
    var completePlanId = "00478766-f484-40f0-9d4a-1fb329b54da5";

    var allEntrants = [];
    for (var planId of [digitalPlanId, completePlanId]) {
      var offset = 0;
      for (var page = 0; page < 10; page++) {
        var res = await fetchWithTimeout(
          "https://www.wixapis.com/pricing-plans/v2/orders?planIds=" + planId + "&orderStatuses=ACTIVE&limit=100&offset=" + offset,
          { method: "GET", headers: wixH }
        );
        if (!res.ok) break;
        var data = await res.json();
        var orders = data.orders || [];
        if (orders.length === 0) break;
        orders.forEach(function(o) {
          allEntrants.push({ buyerId: o.buyer?.memberId || o.buyerInfo?.memberId || "", planName: o.planName || "" });
        });
        offset += orders.length;
        if (orders.length < 100) break;
      }
    }

    // Get member names
    var csv = "First name,Plan\n";
    for (var ent of allEntrants) {
      if (!ent.buyerId) continue;
      try {
        var mRes = await fetchWithTimeout(
          "https://www.wixapis.com/members/v1/members/" + ent.buyerId + "?fieldsets=FULL",
          { method: "GET", headers: wixH }
        );
        if (mRes.ok) {
          var mData = await mRes.json();
          var name = mData.member?.profile?.nickname || mData.member?.profile?.slug || "Unknown";
          var first = name.split(" ")[0];
          csv += first + "," + ent.planName + "\n";
        }
      } catch {}
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="prize-draw-entrants.csv"',
        "Access-Control-Allow-Origin": "*",
      },
      body: csv,
    };
  }

  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "unknown_action" }) };
};

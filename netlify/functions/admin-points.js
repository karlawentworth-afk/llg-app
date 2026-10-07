// netlify/functions/admin-points.js
//
// Admin tool: give or take points from a member.
// All actions require admin auth (session cookie or password).
//
// POST { action: "search", query: "name or email" }
// POST { action: "balance", contactId: "..." }
// POST { action: "adjust", contactId: "...", memberId: "...", memberName: "...", memberEmail: "...",
//        amount: 500, reason: "Golf Breaks trip", note: "Costa Navarino Oct 2026" }
//   amount > 0 = earn, amount < 0 = remove

const https = require("https");
const { createClient } = require("@supabase/supabase-js");
const { verifyAdminMember } = require("./lib/verify-admin-member");

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
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "method_not_allowed" }) };

  // Auth: session cookie, admin password, or admin email header
  var admin = await verifyAdminMember(event);
  if (!admin) {
    // Fall back to email-only check for browser access
    var emailHeader = (event.headers["x-admin-email"] || "").trim().toLowerCase();
    var adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
    if (emailHeader && adminEmails.includes(emailHeader)) {
      admin = { contactId: null, memberId: null, email: emailHeader };
    } else {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "not_admin" }) };
    }
  }

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad_json" }) }; }
  var action = body.action || "";

  var wixH = {
    Authorization: process.env.WIX_CONTACTS_WRITE_KEY || process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    "Content-Type": "application/json",
  };
  if (process.env.WIX_ACCOUNT_ID) wixH["wix-account-id"] = process.env.WIX_ACCOUNT_ID;

  // SEARCH: find members by name or email
  if (action === "search") {
    var query = (body.query || "").trim();
    if (!query || query.length < 2) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "query_too_short" }) };

    try {
      var res = await fetchWithTimeout("https://www.wixapis.com/members/v1/members/query", {
        method: "POST", headers: wixH,
        body: JSON.stringify({
          query: {
            filter: {
              "$or": [
                { "profile.nickname": { "$contains": query } },
                { "loginEmail": { "$contains": query } },
              ],
            },
            sort: [{ "profile.nickname": "ASC" }],
            paging: { limit: 20, offset: 0 },
          },
          fieldsets: ["FULL"],
        }),
      });
      if (!res.ok) {
        var errText = await res.text().catch(function() { return ""; });
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "search_failed", detail: errText.slice(0, 200) }) };
      }
      var data = await res.json();
      var members = (data.members || []).map(function(m) {
        return {
          memberId: m.id,
          contactId: m.contactId,
          name: m.profile?.nickname || m.profile?.slug || "",
          email: m.loginEmail || "",
          photo: m.profile?.photo?.url || null,
        };
      });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ members: members }) };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
  }

  // BALANCE: get a member's current points balance
  if (action === "balance") {
    var contactId = body.contactId;
    if (!contactId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_contactId" }) };

    try {
      var res = await fetchWithTimeout("https://www.wixapis.com/loyalty-accounts/v1/accounts/search", {
        method: "POST", headers: wixH,
        body: JSON.stringify({
          search: { filter: { "contact.id": { "$eq": contactId } }, cursorPaging: { limit: 1 } },
        }),
      });
      if (!res.ok) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "loyalty_search_failed" }) };
      var data = await res.json();
      var account = data.accounts?.[0];
      if (!account) return { statusCode: 200, headers: CORS, body: JSON.stringify({ balance: 0, accountId: null }) };
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          balance: account.points?.balance || 0,
          accountId: account.id,
          revision: account.revision,
        }),
      };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ADJUST: give or take points
  if (action === "adjust") {
    var contactId = body.contactId;
    var memberId = body.memberId || "";
    var memberName = body.memberName || "";
    var memberEmail = body.memberEmail || "";
    var amount = parseInt(body.amount, 10);
    var reason = (body.reason || "").trim();
    var note = (body.note || "").trim();

    if (!contactId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_contactId" }) };
    if (!amount || amount === 0) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "amount_must_be_nonzero" }) };
    if (!reason) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_reason" }) };

    var description = note ? reason + ": " + note : reason;

    // Get loyalty account
    var searchRes = await fetchWithTimeout("https://www.wixapis.com/loyalty-accounts/v1/accounts/search", {
      method: "POST", headers: wixH,
      body: JSON.stringify({
        search: { filter: { "contact.id": { "$eq": contactId } }, cursorPaging: { limit: 1 } },
      }),
    });
    if (!searchRes.ok) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "loyalty_search_failed" }) };
    var searchData = await searchRes.json();
    var account = searchData.accounts?.[0];
    if (!account) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "no_loyalty_account" }) };

    var oldBalance = account.points?.balance || 0;

    // Earn (add) or adjust (remove)
    var apiRes;
    if (amount > 0) {
      // earnPoints
      apiRes = await fetchWithTimeout(
        "https://www.wixapis.com/loyalty-accounts/v1/accounts/" + account.id + "/earn-points",
        {
          method: "POST", headers: wixH,
          body: JSON.stringify({
            amount: amount,
            description: description,
            appId: "553c79f3-5625-4f38-b14b-ef7c0d1e87df",
            idempotencyKey: "admin-" + Date.now() + "-" + contactId,
          }),
        }
      );
    } else {
      // adjustPoints (negative)
      apiRes = await fetchWithTimeout(
        "https://www.wixapis.com/loyalty-accounts/v1/accounts/" + account.id + "/adjust-points",
        {
          method: "POST", headers: wixH,
          body: JSON.stringify({
            amount: amount,
            revision: account.revision,
            description: description,
          }),
        }
      );
    }

    if (!apiRes.ok) {
      var errText = await apiRes.text().catch(function() { return ""; });
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "wix_api_failed", detail: errText.slice(0, 300) }) };
    }

    var newBalance = oldBalance + amount;

    // Log in Supabase
    var sbUrl = process.env.SUPABASE_URL;
    var sbKey = process.env.SUPABASE_SERVICE_KEY;
    if (sbUrl && sbKey) {
      var supabase = createClient(sbUrl, sbKey);
      await supabase.from("points_admin_log").insert({
        wix_member_id: memberId,
        member_name: memberName,
        member_email: memberEmail,
        amount: amount,
        reason: reason,
        note: note,
        admin_email: admin.email || "admin-password",
      });
    }

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ ok: true, oldBalance: oldBalance, newBalance: newBalance, description: description }),
    };
  }

  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "unknown_action" }) };
};

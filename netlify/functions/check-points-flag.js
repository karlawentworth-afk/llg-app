const { createClient } = require("@supabase/supabase-js");

// Called by the Wix SPI to check if a member has an active points flag
// Secured with a shared secret (LLG_SPI_SECRET in Wix Secrets Manager
// and SPI_SECRET in Netlify env vars)

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-SPI-Secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };

  const spiSecret = process.env.SPI_SECRET;
  const reqSecret = event.headers["x-spi-secret"];
  if (!spiSecret || reqSecret !== spiSecret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "bad_request" }) }; }

  const { memberId } = body;
  if (!memberId) return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_member_id" }) };

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "not_configured" }) };

  const supabase = createClient(sbUrl, sbKey);

  // Find active (non-expired) flag for this member
  const { data, error } = await supabase
    .from("points_flags")
    .select("id, service_id, points_amount, money_amount, expires_at")
    .eq("wix_member_id", memberId)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (error) {
    console.error("check-points-flag error:", error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "query_failed" }) };
  }

  const flag = data?.[0] || null;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ hasFlag: !!flag, flag }),
  };
};

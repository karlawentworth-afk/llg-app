// TEMPORARY: query points_flags and points_ledger for debugging.
// Secured with SPI_SECRET. Remove after testing.

const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-SPI-Secret",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const spiSecret = process.env.SPI_SECRET;
  const reqSecret = event.headers["x-spi-secret"];
  if (!spiSecret || reqSecret !== spiSecret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized" }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const { data: flags } = await supabase
    .from("points_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: ledger } = await supabase
    .from("points_ledger")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ flags: flags || [], ledger: ledger || [] }, null, 2),
  };
};

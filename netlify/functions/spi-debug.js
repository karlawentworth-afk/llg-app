// TEMPORARY: logs whatever the SPI trigger sends it.
// Secured with SPI_SECRET. Remove after testing.

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-SPI-Secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const spiSecret = process.env.SPI_SECRET;
  const reqSecret = event.headers["x-spi-secret"];
  if (!spiSecret || reqSecret !== spiSecret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { body = { raw: event.body }; }

  console.log("SPI-DEBUG:", JSON.stringify(body));

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};

const crypto = require("crypto");

// ── Dummy secret (never the real one) ──
const TEST_SECRET = "a]b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1";

// ── Stub fetch so no real Wix calls are made ──
const stubResponse = (json) => ({
  ok: true,
  status: 200,
  json: async () => json,
  text: async () => JSON.stringify(json),
});

global.fetch = async () =>
  stubResponse({
    orders: [{ planName: "Test Plan", status: "ACTIVE" }],
    extendedBookings: [],
    accounts: [{ points: { balance: 500 } }],
  });

// ── Set env vars before requiring the handler ──
process.env.WIX_EMBED_SECRET = TEST_SECRET;
process.env.WIX_API_KEY = "fake-api-key";
process.env.WIX_SITE_ID = "fake-site-id";
process.env.WIX_ACCOUNT_ID = "fake-account-id";

const { handler } = require("../netlify/functions/verify-pass");

// ── Helpers ──
function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makePass(payloadObj, secret = TEST_SECRET) {
  const payloadB64 = base64urlEncode(JSON.stringify(payloadObj));
  const sig = base64urlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );
  return payloadB64 + "." + sig;
}

function validPayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    memberId: "member-001",
    contactId: "contact-001",
    firstName: "Tester",
    iat: now,
    exp: now + 300,
    ...overrides,
  };
}

async function callHandler(pass) {
  return handler({
    httpMethod: "POST",
    body: JSON.stringify({ pass }),
  });
}

// ── Tests ──
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS", notes: "" });
  } catch (err) {
    results.push({ name, status: "FAIL", notes: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function run() {
  // 1. Valid pass: accepted
  await test("Valid pass accepted", async () => {
    const pass = makePass(validPayload());
    const res = await callHandler(pass);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.firstName === "Tester", `Expected firstName Tester, got ${body.firstName}`);
  });

  // 2. One character changed in payload: rejected
  await test("Tampered payload rejected", async () => {
    const pass = makePass(validPayload());
    const [payloadB64, sig] = pass.split(".");
    // Flip one character in the payload
    const tampered = payloadB64.slice(0, 5) + (payloadB64[5] === "A" ? "B" : "A") + payloadB64.slice(6);
    const res = await callHandler(tampered + "." + sig);
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.error === "invalid_signature", `Expected invalid_signature, got ${body.error}`);
  });

  // 3. One character changed in signature: rejected
  await test("Tampered signature rejected", async () => {
    const pass = makePass(validPayload());
    const [payloadB64, sig] = pass.split(".");
    const tampered = sig.slice(0, 3) + (sig[3] === "X" ? "Y" : "X") + sig.slice(4);
    const res = await callHandler(payloadB64 + "." + tampered);
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.error === "invalid_signature", `Expected invalid_signature, got ${body.error}`);
  });

  // 4. Pass expired 1 minute ago: rejected as expired
  await test("Expired pass rejected", async () => {
    const now = Math.floor(Date.now() / 1000);
    const pass = makePass(validPayload({ iat: now - 360, exp: now - 60 }));
    const res = await callHandler(pass);
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.error === "pass_expired", `Expected pass_expired, got ${body.error}`);
  });

  // 5. Pass with no signature part: rejected
  await test("No signature rejected", async () => {
    const payload = base64urlEncode(JSON.stringify(validPayload()));
    const res = await callHandler(payload);
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.error === "invalid_pass_format", `Expected invalid_pass_format, got ${body.error}`);
  });

  // 6a. Empty pass: rejected
  await test("Empty pass rejected", async () => {
    const res = await callHandler("");
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.error === "missing_pass", `Expected missing_pass, got ${body.error}`);
  });

  // 6b. Garbage pass: rejected
  await test("Garbage pass rejected", async () => {
    const res = await callHandler("not.a" + ".valid.pass");
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // ── Report ──
  console.log("");
  console.log("  #  | Status | Test");
  console.log("-----|--------|--------------------------------------");
  results.forEach((r, i) => {
    const num = String(i + 1).padStart(3);
    const status = r.status === "PASS" ? " PASS " : " FAIL ";
    const notes = r.notes ? ` (${r.notes})` : "";
    console.log(`  ${num} |${status}| ${r.name}${notes}`);
  });
  console.log("");

  const failed = results.filter((r) => r.status === "FAIL").length;
  if (failed > 0) {
    console.log(`  ${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log(`  All ${results.length} tests passed`);
  }
}

run();

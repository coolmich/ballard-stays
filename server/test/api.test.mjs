// API endpoint tests for Task 4.
// Run with: npm run test:api
// Assumes `npm run dev` is running so the backend on :3001 is up and DB is populated.
import { test } from "node:test";
import assert from "node:assert/strict";

const API = "http://127.0.0.1:3001";

function isoDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

// Pick the first 2 consecutive dates beyond ~200 days that are NOT in the listing's blocked set,
// so the precheck flow doesn't get rejected by Airbnb-side availability. Falls back to ~300 days out.
async function pickAvailableRange(listingId) {
  const r = await fetch(`${API}/api/availability/${listingId}`);
  const blocked = new Set((await r.json()).blocked_dates || []);
  // Look for any 1-night window (check_in unblocked, check_out can be blocked since it's the day after)
  for (let off = 60; off < 360; off++) {
    const checkIn = isoDate(off);
    const checkOut = isoDate(off + 1);
    if (!blocked.has(checkIn) && !blocked.has(checkOut)) {
      return { check_in: checkIn, check_out: checkOut };
    }
  }
  // Fallback: any unblocked check-in (1-night stay)
  for (let off = 60; off < 360; off++) {
    const checkIn = isoDate(off);
    if (!blocked.has(checkIn)) {
      return { check_in: checkIn, check_out: isoDate(off + 1) };
    }
  }
  throw new Error("no unblocked dates in next year — DB may have stale bookings; flush bookings table");
}

async function get(path) {
  const r = await fetch(`${API}${path}`);
  return { status: r.status, body: r.status >= 500 ? await r.text() : await r.json() };
}
async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: r.status >= 500 ? await r.text() : await r.json() };
}

test("GET /api/pricing/:id returns price for each known listing", async () => {
  for (const id of ["bamboo", "gateway", "zen"]) {
    const { status, body } = await get(`/api/pricing/${id}`);
    assert.equal(status, 200, `${id} status`);
    assert.ok(body.airbnb_rate_usd > 0, `${id} positive price`);
    assert.equal(body.currency, "USD");
    assert.match(body.last_scraped_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(["ok", "error"].includes(body.status), `${id} status should be ok or error, got ${body.status}`);
  }
});

test("GET /api/pricing/unknown returns 404", async () => {
  const { status, body } = await get("/api/pricing/nothing");
  assert.equal(status, 404);
  assert.equal(body.error, "listing_not_found");
});

test("GET /api/availability/:id returns blocked_dates array of future YYYY-MM-DD strings", async () => {
  const { status, body } = await get("/api/availability/bamboo");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.blocked_dates));
  const today = new Date().toISOString().slice(0, 10);
  for (const d of body.blocked_dates) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(d >= today, `${d} should be >= ${today}`);
  }
});

test("GET /api/listings returns all three", async () => {
  const { status, body } = await get("/api/listings");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.listings));
  const ids = body.listings.map(l => l.id).sort();
  assert.deepEqual(ids, ["bamboo", "gateway", "zen"]);
});

test("POST /api/bookings/precheck rejects bad input with 400", async () => {
  const cases = [
    {},
    { listing_id: "bamboo" },
    { listing_id: "bamboo", check_in: "2027-08-15" },
    { listing_id: "bamboo", check_in: "bad-date", check_out: "2027-08-17" },
    { listing_id: "bamboo", check_in: "2027-08-17", check_out: "2027-08-15" }, // checkout before checkin
  ];
  for (const body of cases) {
    const { status } = await post("/api/bookings/precheck", body);
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
});

test("POST /api/bookings/precheck rejects unknown listing with 404", async () => {
  const { status, body } = await post("/api/bookings/precheck", {
    listing_id: "ghost",
    check_in: isoDate(200),
    check_out: isoDate(202),
  });
  assert.equal(status, 404);
  assert.equal(body.error, "listing_not_found");
});

test("POST /api/admin/rescrape/:id triggers a scrape and returns updated row", { timeout: 60_000 }, async () => {
  const before = await get("/api/pricing/gateway");
  const r = await post("/api/admin/rescrape/gateway", {});
  assert.equal(r.status, 200);
  assert.ok(r.body.airbnb_rate_usd > 0);
  assert.match(r.body.last_scraped_at, /^\d{4}-\d{2}-\d{2}T/);
  // Timestamp must advance
  assert.ok(
    new Date(r.body.last_scraped_at).getTime() >= new Date(before.body.last_scraped_at).getTime(),
    `expected scraped_at to advance: before=${before.body.last_scraped_at} after=${r.body.last_scraped_at}`,
  );
});

test("POST /api/admin/rescrape/unknown returns 404", async () => {
  const r = await post("/api/admin/rescrape/ghost", {});
  assert.equal(r.status, 404);
});

test("GET /api/admin/bookings returns array with hold + confirmed rows", async () => {
  const r = await get("/api/admin/bookings");
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.bookings));
  for (const b of r.body.bookings) {
    assert.ok(b.id && b.listing_id && b.status);
    assert.ok(["hold", "confirmed"].includes(b.status));
  }
});

test("GET /ical/:id.ics returns valid iCalendar feed", async () => {
  const r = await fetch(`${API}/ical/bamboo.ics`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /text\/calendar/);
  const body = await r.text();
  assert.match(body, /^BEGIN:VCALENDAR\r\n/);
  assert.match(body, /END:VCALENDAR\r\n?$/);
  assert.match(body, /VERSION:2\.0/);
  assert.match(body, /PRODID:/);
  // Each VEVENT (if any) must have UID/DTSTART/DTEND
  const events = body.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  for (const e of events) {
    assert.match(e, /UID:[^\r\n]+@ballard-stays/);
    assert.match(e, /DTSTART;VALUE=DATE:\d{8}/);
    assert.match(e, /DTEND;VALUE=DATE:\d{8}/);
    assert.match(e, /SUMMARY:Direct booking/);
  }
});

test("GET /ical/unknown.ics returns 404", async () => {
  const r = await fetch(`${API}/ical/ghost.ics`);
  assert.equal(r.status, 404);
});

test("Hono returns JSON 404 for unknown routes", async () => {
  const r = await fetch(`${API}/api/totally-unknown`);
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type") || "", /application\/json/);
  const body = await r.json();
  assert.equal(body.error, "not_found");
});

test("precheck → book → reuse-rejected flow", { timeout: 90_000 }, async () => {
  const range = await pickAvailableRange("bamboo");

  const pre = await post("/api/bookings/precheck", { listing_id: "bamboo", ...range });
  assert.equal(pre.status, 200);
  if (!pre.body.ok) assert.fail(`precheck failed unexpectedly: ${JSON.stringify(pre.body)} for ${JSON.stringify(range)}`);
  assert.ok(pre.body.hold_token && pre.body.hold_token.length >= 16);
  assert.match(pre.body.hold_expires_at, /^\d{4}-\d{2}-\d{2}T/);

  const pre2 = await post("/api/bookings/precheck", { listing_id: "bamboo", ...range });
  assert.equal(pre2.status, 200);
  assert.equal(pre2.body.ok, false);
  assert.equal(pre2.body.reason, "held_by_other");

  const book = await post("/api/bookings", {
    hold_token: pre.body.hold_token,
    guest_name: "Test Guest",
    guest_email: `test-${Date.now()}@example.com`,
  });
  assert.equal(book.status, 200);
  assert.ok(book.body.booking_id);

  const book2 = await post("/api/bookings", {
    hold_token: pre.body.hold_token,
    guest_email: "test@example.com",
  });
  assert.equal(book2.status, 409);

  const pre3 = await post("/api/bookings/precheck", { listing_id: "bamboo", ...range });
  assert.equal(pre3.body.ok, false);
  assert.equal(pre3.body.reason, "direct_already_booked");
});

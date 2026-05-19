import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import {
  getDb,
  getDbPath,
  initDb,
  seedListings,
  listListings,
  getListing,
  getBlockedDates,
  upsertScrapeResult,
  findOverlappingBooking,
  tryCreateHold,
  confirmBooking,
  listActiveBookings,
} from "./db.mjs";
import { scrapeListing } from "./scraper.mjs";
import { startCron } from "./cron.mjs";

const PORT = Number(process.env.PORT || 3001);

const app = new Hono();

app.use("*", cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
}));

app.get("/health", (c) => c.json({ ok: true, service: "ballard-stays-backend" }));
app.get("/api/health", (c) => c.json({ ok: true, service: "ballard-stays-backend" }));

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function badDates(checkIn, checkOut) {
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) return "invalid_date_format";
  if (checkIn >= checkOut) return "checkout_must_be_after_checkin";
  return null;
}

// --- Listings / pricing / availability -----------------------------------

app.get("/api/listings", (c) => {
  const rows = listListings().map((l) => ({
    id: l.id,
    name: l.name,
    airbnb_url: l.airbnb_url,
    airbnb_room_id: l.airbnb_room_id,
    airbnb_rate_usd: l.airbnb_rate_usd,
    currency: l.currency || "USD",
    last_scraped_at: l.last_scraped_at,
    last_scraped_status: l.last_scraped_status,
    last_scraped_error: l.last_scraped_error,
  }));
  return c.json({ listings: rows });
});

app.get("/api/pricing/:id", (c) => {
  const id = c.req.param("id");
  const listing = getListing(id);
  if (!listing) return c.json({ error: "listing_not_found" }, 404);
  return c.json({
    listing_id: id,
    airbnb_rate_usd: listing.airbnb_rate_usd,
    currency: listing.currency || "USD",
    last_scraped_at: listing.last_scraped_at,
    status: listing.last_scraped_status || "unknown",
    error: listing.last_scraped_error || null,
  });
});

app.get("/api/availability/:id", (c) => {
  const id = c.req.param("id");
  const listing = getListing(id);
  if (!listing) return c.json({ error: "listing_not_found" }, 404);
  return c.json({
    listing_id: id,
    blocked_dates: getBlockedDates(id),
    last_scraped_at: listing.last_scraped_at,
  });
});

// --- Booking precheck + confirm ------------------------------------------

app.post("/api/bookings/precheck", async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid_json" }, 400); }

  const { listing_id, check_in, check_out } = body || {};
  if (!listing_id || !check_in || !check_out) {
    return c.json({ error: "missing_fields", required: ["listing_id", "check_in", "check_out"] }, 400);
  }
  const dateErr = badDates(check_in, check_out);
  if (dateErr) return c.json({ error: dateErr }, 400);

  const listing = getListing(listing_id);
  if (!listing) return c.json({ error: "listing_not_found" }, 404);

  // 1. Check direct-side: confirmed booking or active hold overlapping?
  const overlap = findOverlappingBooking(listing_id, check_in, check_out);
  if (overlap) {
    if (overlap.status === "confirmed") {
      return c.json({ ok: false, reason: "direct_already_booked" });
    }
    return c.json({ ok: false, reason: "held_by_other" });
  }

  // 2. Fresh scrape — checks Airbnb for new bookings since last cron
  const result = await scrapeListing(listing.airbnb_room_id, { checkIn: check_in, checkOut: check_out });
  // Save fresh data as a side effect (only if scrape succeeded)
  if (!result.error) {
    upsertScrapeResult(listing_id, result);
    const blocked = new Set(result.blocked_dates || []);
    // Any night in [check_in, check_out) blocked on Airbnb?
    const cursor = new Date(check_in + "T00:00:00Z");
    const end = new Date(check_out + "T00:00:00Z");
    while (cursor < end) {
      const d = cursor.toISOString().slice(0, 10);
      if (blocked.has(d)) {
        return c.json({ ok: false, reason: "airbnb_just_booked" });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    // Scrape failed — record so the host sees it via /admin, but fall through.
    // We don't block booking on a flaky scrape; the host can review pending bookings.
    upsertScrapeResult(listing_id, { error: result.error, scraped_at: result.scraped_at });
    console.warn(`[precheck] scrape failed for ${listing_id}: ${result.error}`);
  }

  // 3. Atomic re-check + create hold (handles races between parallel prechecks)
  const holdResult = tryCreateHold(listing_id, check_in, check_out, 5);
  if (holdResult.conflict) {
    return c.json({ ok: false, reason: holdResult.conflict.status === "confirmed" ? "direct_already_booked" : "held_by_other" });
  }
  return c.json({ ok: true, hold_token: holdResult.hold.hold_token, hold_expires_at: holdResult.hold.hold_expires_at });
});

app.post("/api/bookings", async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid_json" }, 400); }

  const { hold_token, guest_name, guest_email } = body || {};
  if (!hold_token || !guest_email) {
    return c.json({ error: "missing_fields", required: ["hold_token", "guest_email"] }, 400);
  }
  const result = confirmBooking(hold_token, guest_name || null, guest_email);
  if (result.error === "hold_not_found") return c.json({ error: "hold_not_found" }, 404);
  if (result.error === "hold_expired") return c.json({ error: "hold_expired" }, 410);
  if (result.error === "already_confirmed") return c.json({ error: "already_confirmed" }, 409);
  if (result.error) return c.json({ error: result.error }, 400);
  return c.json({ booking_id: result.booking_id });
});

// --- iCal export feed ----------------------------------------------------

function buildIcs(listing, bookings) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ballard Stays//Direct Bookings 1.0//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${listing.name} — Direct Bookings`,
  ];
  for (const b of bookings) {
    const dtStart = b.check_in.replace(/-/g, "");
    const dtEnd = b.check_out.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@ballard-stays`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:Direct booking — ${listing.name}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

app.get("/ical/:slug", (c) => {
  const slug = c.req.param("slug");
  const id = slug.replace(/\.ics$/, "");
  const listing = getListing(id);
  if (!listing) return c.text("listing_not_found", 404);
  const confirmed = getDb()
    .prepare("SELECT id, check_in, check_out FROM bookings WHERE listing_id = ? AND status = 'confirmed' ORDER BY check_in")
    .all(id);
  const ics = buildIcs(listing, confirmed);
  return c.body(ics, 200, { "content-type": "text/calendar; charset=utf-8" });
});

// --- Admin (localhost only — no auth) ------------------------------------

app.post("/api/admin/rescrape/:id", async (c) => {
  const id = c.req.param("id");
  const listing = getListing(id);
  if (!listing) return c.json({ error: "listing_not_found" }, 404);
  const result = await scrapeListing(listing.airbnb_room_id);
  upsertScrapeResult(id, result);
  const updated = getListing(id);
  return c.json({
    listing_id: id,
    airbnb_rate_usd: updated.airbnb_rate_usd,
    currency: updated.currency || "USD",
    last_scraped_at: updated.last_scraped_at,
    status: updated.last_scraped_status,
    error: updated.last_scraped_error,
  });
});

app.get("/api/admin/bookings", (c) => {
  return c.json({ bookings: listActiveBookings() });
});

// --- Boot ----------------------------------------------------------------

getDb();
initDb();
seedListings();
startCron();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[backend] listening on http://localhost:${info.port}`);
  console.log(`[backend] sqlite at ${getDbPath()}`);
});

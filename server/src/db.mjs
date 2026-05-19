import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, "..", "data", "app.db");

let _db = null;

export function getDbPath() {
  return process.env.DB_PATH || DEFAULT_DB_PATH;
}

export function getDb() {
  if (_db) return _db;
  const path = getDbPath();
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

export function initDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      airbnb_room_id TEXT NOT NULL,
      airbnb_url TEXT NOT NULL,
      last_scraped_at TEXT,
      last_scraped_status TEXT,
      last_scraped_error TEXT,
      airbnb_rate_usd INTEGER,
      currency TEXT
    );
    CREATE TABLE IF NOT EXISTS availability (
      listing_id TEXT NOT NULL,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      blocked INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (listing_id, date, source)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      guest_name TEXT,
      guest_email TEXT,
      hold_token TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'direct',
      created_at TEXT NOT NULL,
      hold_expires_at TEXT
    );
  `);
  // For DBs created before hold_token existed:
  try { db.exec("ALTER TABLE bookings ADD COLUMN hold_token TEXT"); } catch {}
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bookings_listing_dates ON bookings(listing_id, check_in, check_out);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_hold_token ON bookings(hold_token);
  `);
}

const SEED_LISTINGS = [
  {
    id: "bamboo",
    name: "Ballard Bamboo Indulgence",
    airbnb_room_id: "890746600710694659",
    airbnb_url: "https://www.airbnb.com/rooms/890746600710694659",
  },
  {
    id: "gateway",
    name: "Ballard Top Floor Suite with Private Chef Kitchen",
    airbnb_room_id: "1451097135219726178",
    airbnb_url: "https://www.airbnb.com/rooms/1451097135219726178",
  },
  {
    id: "zen",
    name: "Sunlit Zen Retreat",
    airbnb_room_id: "1414909835861328832",
    airbnb_url: "https://www.airbnb.com/rooms/1414909835861328832",
  },
];

export function seedListings() {
  initDb();
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO listings (id, name, airbnb_room_id, airbnb_url)
    VALUES (@id, @name, @airbnb_room_id, @airbnb_url)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const row of SEED_LISTINGS) stmt.run(row);
}

export function listListings() {
  return getDb().prepare("SELECT * FROM listings ORDER BY id").all();
}

export function getListing(id) {
  return getDb().prepare("SELECT * FROM listings WHERE id = ?").get(id);
}

export function upsertScrapeResult(listingId, result) {
  const db = getDb();
  const now = result.scraped_at || new Date().toISOString();
  if (result.error) {
    db.prepare(`
      UPDATE listings
      SET last_scraped_at = ?, last_scraped_status = 'error', last_scraped_error = ?
      WHERE id = ?
    `).run(now, result.error, listingId);
    return;
  }
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE listings
      SET last_scraped_at = ?, last_scraped_status = 'ok', last_scraped_error = NULL,
          airbnb_rate_usd = ?, currency = ?
      WHERE id = ?
    `).run(now, result.price_usd, result.currency || "USD", listingId);

    db.prepare("DELETE FROM availability WHERE listing_id = ? AND source = 'airbnb'").run(listingId);
    if (result.blocked_dates && result.blocked_dates.length > 0) {
      const ins = db.prepare("INSERT INTO availability (listing_id, date, source, blocked) VALUES (?, ?, 'airbnb', 1)");
      for (const date of result.blocked_dates) ins.run(listingId, date);
    }
  });
  tx();
}

export function getAvailabilityCount(listingId, source) {
  return getDb().prepare("SELECT COUNT(*) AS n FROM availability WHERE listing_id = ? AND source = ?").get(listingId, source).n;
}

export function getBlockedDates(listingId) {
  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const blockedFromScrape = db
    .prepare("SELECT DISTINCT date FROM availability WHERE listing_id = ? AND blocked = 1 AND date >= ?")
    .all(listingId, today)
    .map(r => r.date);

  // Also block dates covered by confirmed direct bookings
  const nowIso = new Date().toISOString();
  const confirmedRanges = db
    .prepare(`
      SELECT check_in, check_out FROM bookings
      WHERE listing_id = ?
        AND check_out > ?
        AND (status = 'confirmed' OR (status = 'hold' AND hold_expires_at > ?))
    `)
    .all(listingId, today, nowIso);

  const blocked = new Set(blockedFromScrape);
  for (const r of confirmedRanges) {
    const cur = new Date(r.check_in + "T00:00:00Z");
    const end = new Date(r.check_out + "T00:00:00Z");
    while (cur < end) {
      const d = cur.toISOString().slice(0, 10);
      if (d >= today) blocked.add(d);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return Array.from(blocked).sort();
}

// Booking / hold helpers ----------------------------------------------------

function randomToken(bytes = 12) {
  return randomBytes(bytes).toString("hex");
}

// Returns the active blocking row (hold OR confirmed) overlapping the requested window, or null.
// "Overlap": a < B && b > A
export function findOverlappingBooking(listingId, checkIn, checkOut) {
  const nowIso = new Date().toISOString();
  return getDb()
    .prepare(`
      SELECT * FROM bookings
      WHERE listing_id = ?
        AND check_in < ?
        AND check_out > ?
        AND (
          status = 'confirmed'
          OR (status = 'hold' AND hold_expires_at > ?)
        )
      LIMIT 1
    `)
    .get(listingId, checkOut, checkIn, nowIso);
}

// Atomic re-check + insert. Returns either {hold:{...}} on success, or
// {conflict: row} where row is the overlapping confirmed/active-hold booking.
export function tryCreateHold(listingId, checkIn, checkOut, holdMinutes = 5) {
  const db = getDb();
  return db.transaction(() => {
    const nowIso = new Date().toISOString();
    const overlap = db
      .prepare(`
        SELECT * FROM bookings
        WHERE listing_id = ?
          AND check_in < ?
          AND check_out > ?
          AND (
            status = 'confirmed'
            OR (status = 'hold' AND hold_expires_at > ?)
          )
        LIMIT 1
      `)
      .get(listingId, checkOut, checkIn, nowIso);
    if (overlap) return { conflict: overlap };

    const id = randomToken(8);
    const hold_token = randomToken(12);
    const created_at = new Date().toISOString();
    const hold_expires_at = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO bookings (id, listing_id, check_in, check_out, status, source, created_at, hold_expires_at, hold_token)
      VALUES (?, ?, ?, ?, 'hold', 'direct', ?, ?, ?)
    `).run(id, listingId, checkIn, checkOut, created_at, hold_expires_at, hold_token);
    return { hold: { id, hold_token, hold_expires_at } };
  })();
}

export function listActiveBookings() {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  return getDb()
    .prepare(`
      SELECT id, listing_id, check_in, check_out, guest_name, guest_email, status, source, created_at, hold_expires_at
      FROM bookings
      WHERE status = 'confirmed'
         OR (status = 'hold' AND hold_expires_at > ?)
         OR (status = 'confirmed' AND check_out >= ?)
      ORDER BY created_at DESC
    `)
    .all(nowIso, today);
}

export function confirmBooking(holdToken, guestName, guestEmail) {
  const db = getDb();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const row = db
      .prepare("SELECT * FROM bookings WHERE hold_token = ? LIMIT 1")
      .get(holdToken);
    if (!row) return { error: "hold_not_found" };
    if (row.status === "confirmed") return { error: "already_confirmed" };
    if (row.status !== "hold") return { error: "invalid_hold_state" };
    if (row.hold_expires_at && row.hold_expires_at < now) return { error: "hold_expired" };
    db.prepare(`
      UPDATE bookings
      SET status = 'confirmed', guest_name = ?, guest_email = ?, hold_expires_at = NULL
      WHERE id = ?
    `).run(guestName, guestEmail, row.id);
    return { booking_id: row.id };
  });
  return tx();
}

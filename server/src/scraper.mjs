import { chromium } from "playwright";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function isoDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function extractRoomId(input) {
  const m = String(input).match(/(?:rooms\/)?(\d{6,})/);
  return m ? m[1] : null;
}

function parseUsd(s) {
  if (s == null) return null;
  const m = String(s).match(/([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function nightlyFromExplanation(sdp) {
  // explanationData.priceDetails[].items[].description like "2 nights x $268.35"
  const items = sdp?.explanationData?.priceDetails || [];
  for (const group of items) {
    for (const item of group.items || []) {
      const desc = item?.description || "";
      const match = desc.match(/x\s*\$([0-9][0-9,]*(?:\.[0-9]+)?)/i);
      if (match) {
        const n = parseFloat(match[1].replace(/,/g, ""));
        if (Number.isFinite(n)) return n;
      }
      // Fallback: per-night line item
      if (/per\s*night/i.test(desc) && item.priceString) {
        const n = parseUsd(item.priceString);
        if (n) return n;
      }
    }
  }
  return null;
}

function nightlyFromPrimaryLine(sdp) {
  const primary = sdp?.primaryLine || {};
  const total = parseUsd(primary.discountedPrice || primary.price || primary.originalPrice);
  if (total == null) return null;
  // If displayPriceStyle is TOTAL_ONLY, divide by nights (extracted from qualifier "for N nights")
  if (sdp.displayPriceStyle === "TOTAL_ONLY" || /for\s+\d+\s+night/i.test(primary.qualifier || "")) {
    const m = (primary.qualifier || primary.accessibilityLabel || "").match(/(\d+)\s+night/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0) return total / n;
    }
  }
  return total;
}

function findPriceInPdpResponse(json) {
  const sections = json?.data?.presentation?.stayProductDetailPage?.sections?.sections || [];
  for (const sec of sections) {
    const sdp = sec?.section?.structuredDisplayPrice;
    if (!sdp) continue;
    const fromExplanation = nightlyFromExplanation(sdp);
    if (fromExplanation && fromExplanation > 0) return Math.round(fromExplanation);
    const fromPrimary = nightlyFromPrimaryLine(sdp);
    if (fromPrimary && fromPrimary > 0) return Math.round(fromPrimary);
  }
  return null;
}

function findBlockedDatesInCalendarResponse(json) {
  const today = new Date().toISOString().slice(0, 10);
  const months = json?.data?.merlin?.pdpAvailabilityCalendar?.calendarMonths || [];
  const blocked = [];
  for (const month of months) {
    for (const day of month.days || []) {
      const date = day.calendarDate;
      if (!date || date < today) continue;
      const isAvailable = day.available === true && day.availableForCheckin !== false;
      if (!isAvailable) blocked.push(date);
    }
  }
  return blocked;
}

function findFirstAvailableRange(json) {
  const today = new Date().toISOString().slice(0, 10);
  const months = json?.data?.merlin?.pdpAvailabilityCalendar?.calendarMonths || [];
  const days = [];
  for (const month of months) for (const day of month.days || []) days.push(day);
  days.sort((a, b) => (a.calendarDate || "").localeCompare(b.calendarDate || ""));
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d.calendarDate || d.calendarDate < today) continue;
    if (!d.available || d.availableForCheckin === false) continue;
    const minNights = Math.max(1, d.minNights || 1);
    const checkoutIdx = i + minNights;
    if (checkoutIdx >= days.length) continue;
    // All intermediate nights must be available
    let allAvail = true;
    for (let k = 1; k < minNights; k++) {
      if (!days[i + k] || !days[i + k].available) { allAvail = false; break; }
    }
    if (!allAvail) continue;
    const checkout = days[checkoutIdx];
    if (!checkout || checkout.availableForCheckout === false) continue;
    return { checkIn: d.calendarDate, checkOut: checkout.calendarDate };
  }
  return null;
}

async function loadAndCapture(page, url) {
  const pdpJsonPromises = [];
  const calendarJsonPromises = [];
  const handler = (resp) => {
    const u = resp.url();
    if (u.includes("/api/v3/StaysPdpSections")) pdpJsonPromises.push(resp.json().catch(() => null));
    if (u.includes("/api/v3/PdpAvailabilityCalendar")) calendarJsonPromises.push(resp.json().catch(() => null));
  };
  page.on("response", handler);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait for the specific GraphQL responses we care about, with a hard cap
  const waitForBoth = Promise.race([
    page.waitForResponse((r) => r.url().includes("/api/v3/PdpAvailabilityCalendar"), { timeout: 8000 }).catch(() => null),
    page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null),
  ]);
  await waitForBoth;
  // Brief settle window for any stragglers
  await page.waitForTimeout(500);
  page.off("response", handler);
  const [pdp, cal] = await Promise.all([
    Promise.all(pdpJsonPromises),
    Promise.all(calendarJsonPromises),
  ]);
  return { pdp: pdp.filter(Boolean), cal: cal.filter(Boolean) };
}

function pickPrice(pdpResponses) {
  for (const r of pdpResponses) {
    const p = findPriceInPdpResponse(r);
    if (p && p > 0) return p;
  }
  return null;
}

function pickBlockedDates(calResponses) {
  let best = [];
  for (const r of calResponses) {
    const blocked = findBlockedDatesInCalendarResponse(r);
    if (blocked.length > best.length) best = blocked;
  }
  return best;
}

function buildUrl(room_id, checkIn, checkOut) {
  return `https://www.airbnb.com/rooms/${room_id}?check_in=${checkIn}&check_out=${checkOut}&adults=1`;
}

export async function scrapeListing(roomIdOrUrl, options = {}) {
  const room_id = extractRoomId(roomIdOrUrl);
  if (!room_id) {
    return { error: "invalid_room_id", input: roomIdOrUrl, scraped_at: new Date().toISOString() };
  }

  const initialCheckIn = options.checkIn || isoDate(30);
  const initialCheckOut = options.checkOut || isoDate(31);
  let source_url = buildUrl(room_id, initialCheckIn, initialCheckOut);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();

    let { pdp, cal } = await loadAndCapture(page, source_url);
    let price_usd = pickPrice(pdp);
    let blocked_dates = pickBlockedDates(cal);

    // If the chosen dates were unavailable, find a real available range from the calendar and retry once
    if (price_usd == null && cal.length > 0) {
      const range = findFirstAvailableRange(cal[0]);
      if (range) {
        source_url = buildUrl(room_id, range.checkIn, range.checkOut);
        const retry = await loadAndCapture(page, source_url);
        const retryPrice = pickPrice(retry.pdp);
        const retryBlocked = pickBlockedDates(retry.cal);
        if (retryPrice) price_usd = retryPrice;
        if (retryBlocked.length > blocked_dates.length) blocked_dates = retryBlocked;
      }
    }

    if (price_usd == null) {
      return {
        error: "no_price_found",
        room_id,
        source_url,
        pdp_response_count: pdp.length,
        calendar_response_count: cal.length,
        scraped_at: new Date().toISOString(),
      };
    }

    return {
      price_usd,
      currency: "USD",
      blocked_dates,
      room_id,
      source_url,
      scraped_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      error: "scrape_failed",
      message: err.message,
      room_id,
      source_url,
      scraped_at: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

// CLI: node server/src/scraper.mjs <url-or-roomid>
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node server/src/scraper.mjs <airbnb-url-or-room-id>");
    process.exit(1);
  }
  const result = await scrapeListing(arg);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.error ? 1 : 0);
}

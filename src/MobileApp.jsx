// Ballard Stays, mobile shell. Three tabs (How / Stays / Book) with bottom-sheet date picker and sticky CTA.
import { useEffect, useMemo, useState } from "react";
import { PROPERTIES } from "./data.js";
import { enforceWeekendMin, fmtLong, yearsHosting } from "./utils.js";
import Footprint from "./Footprint.jsx";

const HOST_RATE = 100;
const SERVICE_FEE_PCT = 15.5;
const SALES_TAX_PCT = 9.59;
const CONV_TAX_PCT = 7.0;
const DISCOUNT_PCT = 10;

const $ = (n) => `$${n.toFixed(2)}`;

const MATH = (() => {
  const serviceFee  = HOST_RATE * SERVICE_FEE_PCT / 100;
  const preTax      = HOST_RATE + serviceFee;
  const salesTax    = preTax * SALES_TAX_PCT / 100;
  const convTax     = preTax * CONV_TAX_PCT / 100;
  const airbnbTotal = preTax + salesTax + convTax;
  const direct      = preTax * (1 - DISCOUNT_PCT / 100);
  const savings     = airbnbTotal - direct;
  const savingsPct  = Math.round(savings / airbnbTotal * 100);
  return { serviceFee, preTax, salesTax, convTax, airbnbTotal, direct, savings, savingsPct };
})();

const pctOf = (n) => `${(n / MATH.airbnbTotal * 100).toFixed(2)}%`;
const fpLabel = (id) =>
  id === "bamboo" ? "1st floor suite" :
  id === "gateway" ? "Floors 2–3 + rooftop" :
  id === "zen" ? "Entire home" : "";

const FAQ_ITEMS = [
  ["Why book direct instead of Airbnb?", `Same home, same hosts, same self check-in. You skip Airbnb's 15.5% service fee and Seattle's ~16.6% lodging tax stacked on top. About ${MATH.savingsPct}% less for you, roughly the same money to the host.`],
  ["How do I see if my dates are available?", "Airbnb's calendar is the source of truth. Check there first to make sure your dates are open and note the pre-tax price. Then come back here to request direct, please don't mention direct booking inside the Airbnb app."],
  ["How does the request work?", "Pick your dates here, fill in your contact info, choose Zelle or Venmo, and add a short message. Mandy gets it directly and replies within 24 hours to confirm."],
  ["How do I pay?", `Zelle or Venmo, after Mandy confirms. She sends a payment request at ${DISCOUNT_PCT}% off the Airbnb pre-tax rate. No card, no service fee, no surprise charges.`],
  ["How does check-in work?", "Self check-in with a keypad. We send your code 24 hours before arrival, along with a guidebook of our favorite Ballard coffee shops, dinners, and walks."],
  ["Is parking included?", "Yes. Free, safe street parking right out front. If it's full, there's always a spot one block away. No permits needed."],
  ["What's your cancellation policy?", "Flexible: full refund up to 5 days before check-in, 50% up to 24 hours. Long stays (7+ nights) have a custom policy, just ask."],
];

function fmtRange(checkin, checkout) {
  if (!checkin || !checkout) return null;
  const opts = { month: "short", day: "numeric" };
  return `${checkin.toLocaleDateString("en-US", opts)} – ${checkout.toLocaleDateString("en-US", opts)}`;
}
function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  return Math.round((checkout - checkin) / 86400000);
}
function makeConf() {
  return "REQ-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function MobileApp() {
  const [tab, setTab] = useState("how");
  const [selectedStayId, setSelectedStayId] = useState(PROPERTIES[0].id);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [tab]);

  const pickStay = (id) => {
    setSelectedStayId(id);
    setTab("book");
  };

  if (confirmation) {
    return <Confirmation data={confirmation} onDone={() => { setConfirmation(null); setTab("stays"); }} />;
  }

  return (
    <div className="mob">
      <main className="mob-main">
        {tab === "how"   && <HowScreen />}
        {tab === "stays" && <StaysScreen onPick={pickStay} />}
        {tab === "book"  && <BookScreen selectedStayId={selectedStayId} onSelectStay={setSelectedStayId} onSubmit={setConfirmation} />}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  );
}

function TabBar({ current, onChange }) {
  return (
    <nav className="tabbar">
      <button className={"tab" + (current === "how" ? " tab-active" : "")} onClick={() => onChange("how")}>
        <IconInfo active={current === "how"} />
        <span>How it works</span>
      </button>
      <button className={"tab" + (current === "stays" ? " tab-active" : "")} onClick={() => onChange("stays")}>
        <IconHouse active={current === "stays"} />
        <span>Stays</span>
      </button>
      <button className={"tab" + (current === "book" ? " tab-active" : "")} onClick={() => onChange("book")}>
        <IconCalendar active={current === "book"} />
        <span>Book</span>
      </button>
    </nav>
  );
}
function IconHouse({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" fillOpacity={active ? 0.16 : 0} />
    </svg>
  );
}
function IconInfo({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M12 11v6M12 7.5v0" />
    </svg>
  );
}
function IconCalendar({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function HeroPlaceholder({ label, id }) {
  const palette = {
    bamboo:  { from: "#C7B98A", to: "#8F8260" },
    gateway: { from: "#B8C4D2", to: "#7A8FA8" },
    zen:     { from: "#D8C9B8", to: "#A89579" },
  }[id] || { from: "#CCC", to: "#888" };
  return (
    <div style={{
      width: "100%", height: "100%",
      background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      display: "flex", alignItems: "flex-end", padding: "20px",
      color: "rgba(255,255,255,0.85)", fontSize: "12px",
    }}>
      {label}
    </div>
  );
}

function StaysScreen({ onPick }) {
  return (
    <div>
      <header className="mob-header">
        <div className="mob-header-eyebrow">Ballard Stays</div>
        <h1 className="mob-header-title">Three stays.<br/><em>One Ballard townhouse.</em></h1>
        <p className="mob-header-sub">
          Same address, three configurations, pick what fits your trip. Tap any stay to request your dates.
        </p>
      </header>

      <div>
        {PROPERTIES.map(p => <StayCard key={p.id} p={p} onPick={() => onPick(p.id)} />)}
      </div>

      <HostBlock />
    </div>
  );
}

function StayCard({ p, onPick }) {
  return (
    <article className="stay-card" onClick={onPick}>
      <div className="stay-card-photo">
        {p.heroImage
          ? <img src={p.heroImage} alt={p.heroPlaceholder} />
          : <HeroPlaceholder label={p.heroPlaceholder} id={p.id} />}
        {p.guestFavorite && <div className="stay-card-fav">Guest favorite</div>}
        <div className="stay-card-fp">
          <Footprint unit={p.id} size="sm" />
          <div className="stay-card-fp-caption">{fpLabel(p.id)}</div>
        </div>
      </div>
      <div className="stay-card-body">
        <div className="stay-card-meta">{p.type} · Sleeps {p.sleeps}</div>
        <h2 className="stay-card-name">{p.name}</h2>
        <p className="stay-card-tagline">{p.tagline}</p>
        <button className="stay-card-cta" onClick={(e) => { e.stopPropagation(); onPick(); }}>
          <span>Request your dates</span>
          <span className="stay-card-cta-arrow">→</span>
        </button>
      </div>
    </article>
  );
}

function HostBlock() {
  return (
    <section className="mobsec-card">
      <div className="propsheet-section-eyebrow">Meet your hosts</div>
      <div className="propsheet-host-row">
        <div className="propsheet-host-avatar">
          <img src="/img/host.jpg" alt="Mandy & Jacob" />
        </div>
        <div>
          <div className="propsheet-host-name">Mandy & Jacob</div>
          <div className="propsheet-host-tag">Superhosts · {yearsHosting()} years hosting</div>
        </div>
      </div>
      <p className="propsheet-host-bio">
        We met in college in San Diego and fell in love with Seattle summers. We designed this Ballard townhouse to feel minimal and stylish, the kind of place we wished existed when we traveled.
      </p>
      <div className="propsheet-host-badges">
        <span className="propsheet-host-badge">Superhost</span>
        <span className="propsheet-host-badge">ID verified</span>
        <span className="propsheet-host-badge">&lt;24h response</span>
      </div>
    </section>
  );
}

function HowScreen() {
  return (
    <div>
      <header className="mob-header">
        <div className="mob-header-eyebrow">Direct booking</div>
        <h1 className="mob-header-title">Same stay.<br/><em>About {MATH.savingsPct}% less.</em></h1>
        <p className="mob-header-sub">
          On Airbnb every <strong>$100</strong> to the host costs you about <strong>${Math.round(MATH.airbnbTotal)}</strong>. A 15.5% service fee, then Seattle's <strong>{(SALES_TAX_PCT + CONV_TAX_PCT).toFixed(2)}%</strong> lodging tax on top of <em>that</em>.
        </p>
      </header>

      <div className="howmob-hero">
        <div className="moneystack">
          <div className="moneystack-row">
            <div className="moneystack-head">
              <span className="moneystack-label">Airbnb at checkout</span>
              <span className="moneystack-amount">{$(MATH.airbnbTotal)}</span>
            </div>
            <div className="moneystack-bar">
              <div className="ms-seg ms-host" style={{ width: pctOf(HOST_RATE) }}></div>
              <div className="ms-seg ms-fee" style={{ width: pctOf(MATH.serviceFee) }}></div>
              <div className="ms-seg ms-tax-1" style={{ width: pctOf(MATH.salesTax) }}></div>
              <div className="ms-seg ms-tax-2" style={{ width: pctOf(MATH.convTax) }}></div>
            </div>
            <div className="moneystack-legend">
              <div className="msl-item">
                <span className="msl-dot msl-dot--host"></span>
                <span className="msl-text">Host's rate</span>
                <span className="msl-val">{$(HOST_RATE)}</span>
              </div>
              <div className="msl-item">
                <span className="msl-dot msl-dot--fee"></span>
                <span className="msl-text">Airbnb · 15.5%</span>
                <span className="msl-val">{$(MATH.serviceFee)}</span>
              </div>
              <div className="msl-item">
                <span className="msl-dot msl-dot--tax-1"></span>
                <span className="msl-text">Sales · {SALES_TAX_PCT}%</span>
                <span className="msl-val">{$(MATH.salesTax)}</span>
              </div>
              <div className="msl-item">
                <span className="msl-dot msl-dot--tax-2"></span>
                <span className="msl-text">Conv · {CONV_TAX_PCT}%</span>
                <span className="msl-val">{$(MATH.convTax)}</span>
              </div>
            </div>
          </div>

          <div className="moneystack-row moneystack-row--reference">
            <div className="moneystack-head">
              <span className="moneystack-label">Airbnb pre-tax</span>
              <span className="moneystack-amount moneystack-amount--muted">{$(MATH.preTax)}</span>
            </div>
            <div className="moneystack-bar moneystack-bar--reference">
              <div className="ms-seg ms-pretax" style={{ width: pctOf(MATH.preTax) }}>
                <span>Reference price</span>
              </div>
            </div>
            <div className="moneystack-note">
              ↑ The price Airbnb shows you when picking dates. We charge <strong>{DISCOUNT_PCT}% off this</strong>.
            </div>
          </div>

          <div className="moneystack-row">
            <div className="moneystack-head">
              <span className="moneystack-label moneystack-label--direct">Book direct</span>
              <span className="moneystack-amount moneystack-amount--direct">{$(MATH.direct)}</span>
            </div>
            <div className="moneystack-bar">
              <div className="ms-seg ms-direct" style={{ width: pctOf(HOST_RATE) }}></div>
              <div className="ms-seg ms-direct-site" style={{ width: pctOf(MATH.direct - HOST_RATE) }}></div>
            </div>
            <div className="moneystack-legend">
              <div className="msl-item">
                <span className="msl-dot msl-dot--direct"></span>
                <span className="msl-text">To the host</span>
                <span className="msl-val">{$(HOST_RATE)}</span>
              </div>
              <div className="msl-item">
                <span className="msl-dot msl-dot--direct-site"></span>
                <span className="msl-text">Site operations</span>
                <span className="msl-val">{$(MATH.direct - HOST_RATE)}</span>
              </div>
            </div>
          </div>

          <div className="moneystack-save">
            <div>
              <div className="moneystack-save-eyebrow">You save</div>
              <div className="moneystack-save-val">{$(MATH.savings)}</div>
            </div>
            <div className="moneystack-save-pct">≈{MATH.savingsPct}%</div>
          </div>
        </div>
      </div>

      <div className="howmob-steps">
        <div className="howmob-step">
          <div className="howmob-step-num">1</div>
          <div>
            <h3 className="howmob-step-title">Stay once on Airbnb</h3>
            <p className="howmob-step-text">New guests always start there. Airbnb handles ID, reviews, and the first deposit of trust. After you check out, you're on our list.</p>
          </div>
        </div>

        <div className="howmob-step">
          <div className="howmob-step-num">2</div>
          <div>
            <h3 className="howmob-step-title">Check Airbnb, request here</h3>
            <p className="howmob-step-text">Airbnb's calendar is the source of truth. Confirm your dates are open, note the pre-tax price. Then tap <strong>Book</strong> here. Mandy replies within 24 hours.</p>
            <div className="howmob-step-tip">
              <span className="howmob-step-tip-icon">!</span>
              <span>Please <strong>don't mention direct booking</strong> in the Airbnb app. Airbnb monitors messages and flags hosts who steer guests off-platform.</span>
            </div>
          </div>
        </div>

        <div className="howmob-step">
          <div className="howmob-step-num">3</div>
          <div>
            <h3 className="howmob-step-title">Pay host-to-guest</h3>
            <p className="howmob-step-text">Mandy sends a Zelle or Venmo request at {DISCOUNT_PCT}% off the Airbnb pre-tax price. Your $100 nightly rate goes straight to the host; the small remainder covers this site.</p>
          </div>
        </div>
      </div>

      <div className="howmob-faq">
        <div className="mob-header-eyebrow" style={{ marginBottom: 6 }}>Common questions</div>
        <h2 className="howmob-faq-title">Still curious?</h2>
        <div className="howmob-faq-list">
          {FAQ_ITEMS.map(([q, a], i) => <FaqItem key={i} q={q} a={a} initialOpen={i === 0} />)}
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a, initialOpen }) {
  const [open, setOpen] = useState(!!initialOpen);
  return (
    <div className={"mob-faq-item" + (open ? " mob-faq-open" : "")}>
      <button className="mob-faq-q" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mob-faq-q-text">{q}</span>
        <span className="mob-faq-chev">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mob-faq-a">{a}</div>}
    </div>
  );
}

function BookScreen({ selectedStayId, onSelectStay, onSubmit }) {
  const p = PROPERTIES.find(x => x.id === selectedStayId) || PROPERTIES[0];
  const [dates, setDates] = useState({ checkin: null, checkout: null });
  const [guests, setGuests] = useState(2);
  const [info, setInfo] = useState({ name: "", email: "", phone: "", payMethod: "zelle", payHandle: "", message: "" });
  const [touched, setTouched] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const nights = nightsBetween(dates.checkin, dates.checkout);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim());
  const payValid = info.payHandle.trim().length > 0;
  const datesValid = !!(dates.checkin && dates.checkout && nights >= 1);
  const valid = datesValid && info.name.trim() && emailValid && payValid;

  const submit = async () => {
    setTouched(true);
    if (!valid) {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
      return;
    }
    setSubmitting(true);
    setSubmitError(false);
    const conf = makeConf();
    const payName = info.payMethod === "venmo" ? "Venmo" : "Zelle";
    const title = `${p.name.split(" with")[0]} · ${fmtLong(dates.checkin)} to ${fmtLong(dates.checkout)}`;
    const body =
      `${p.name}\n` +
      `${fmtLong(dates.checkin)} to ${fmtLong(dates.checkout)} · ${nights} night${nights > 1 ? "s" : ""} · ${guests} guest${guests > 1 ? "s" : ""}\n` +
      `\n${info.name} · ${info.email}${info.phone ? ` · ${info.phone}` : ""}\n` +
      `Pay: ${payName} ${info.payHandle}\n` +
      (info.message ? `\n"${info.message}"\n` : "") +
      `\nRequest ${conf}`;
    try {
      const r = await fetch("https://ntfy.sh/mandy-seattle-direct-booking", {
        method: "POST",
        headers: { "Title": title, "Tags": "house,calendar", "Priority": "default" },
        body,
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      onSubmit({ stayId: p.id, dates, nights, guests, info, conf });
    } catch (err) {
      console.warn("ntfy push failed:", err);
      setSubmitError(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="bookmob bookmob-main-padded">
      <header className="mob-header">
        <div className="mob-header-eyebrow">Request to book</div>
        <h1 className="mob-header-title">Send Mandy your dates.</h1>
        <p className="mob-header-sub">
          No payment now. She confirms within 24 hours, then sends a Zelle or Venmo request at {DISCOUNT_PCT}% off the Airbnb pre-tax price.
        </p>
      </header>

      <div className="bookmob-stayselect">
        <div className="bookmob-staypicker-label">Choose your stay</div>
        {PROPERTIES.map(opt => (
          <button
            key={opt.id}
            className={"bookmob-stay-row" + (opt.id === p.id ? " bookmob-stay-row-active" : "")}
            onClick={() => onSelectStay(opt.id)}
          >
            <div className="bookmob-stay-row-thumb">
              {opt.heroImage
                ? <img src={opt.heroImage} alt="" />
                : <HeroPlaceholder label="" id={opt.id} />}
            </div>
            <div className="bookmob-stay-row-text">
              <div className="bookmob-stay-row-name">{opt.name}</div>
              <div className="bookmob-stay-row-meta">{fpLabel(opt.id)} · Sleeps {opt.sleeps}</div>
            </div>
            <span className="bookmob-stay-row-check">✓</span>
          </button>
        ))}
      </div>

      <div className="airbnb-check-card">
        <div className="airbnb-check-step">Step 1 · Before you request</div>
        <h3 className="airbnb-check-title">Check Airbnb first</h3>
        <p className="airbnb-check-body">
          Airbnb's calendar is the source of truth. Open the <strong>{p.name}</strong> listing, confirm your dates are open, and note the <em>pre-tax</em> nightly price.
        </p>
        <a
          href={p.airbnbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="airbnb-check-link"
        >
          <span className="airbnb-check-link-text">Open {p.name} on Airbnb</span>
          <span className="airbnb-check-link-arrow" aria-hidden="true">↗</span>
        </a>
        <div className="airbnb-check-warn">
          <span className="airbnb-check-warn-icon" aria-hidden="true">!</span>
          <span>Please <strong>don't mention direct booking</strong> inside the Airbnb app. Airbnb monitors messages and flags hosts who steer guests off-platform.</span>
        </div>
      </div>

      <div className="bookmob-step-marker">Step 2 · Send your request</div>

      <button className="bookmob-field" onClick={() => setSheetOpen(true)} style={{ width: "calc(100% - 32px)", textAlign: "left" }}>
        <div className="bookmob-field-label">Dates</div>
        <div className="bookmob-field-row">
          <div className={"bookmob-field-val" + (!datesValid ? " bookmob-field-val--empty" : "")}>
            {datesValid
              ? <>{fmtRange(dates.checkin, dates.checkout)} <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 13 }}>· {nights} night{nights !== 1 ? "s" : ""}</span></>
              : "Pick your dates"}
          </div>
          <span className="bookmob-field-row-chev">›</span>
        </div>
        {touched && !datesValid && <div className="bookmob-field-error">Please pick your dates.</div>}
      </button>

      <div className="bookmob-field">
        <div className="bookmob-field-label">Guests</div>
        <div className="bookmob-field-row">
          <div className="bookmob-field-val">{guests} {guests === 1 ? "guest" : "guests"}</div>
          <div className="bookmob-step-controls">
            <button className="bookmob-step-btn" onClick={() => setGuests(Math.max(1, guests - 1))} disabled={guests <= 1} aria-label="Remove guest">−</button>
            <div className="bookmob-step-count">{guests}</div>
            <button className="bookmob-step-btn" onClick={() => setGuests(Math.min(p.sleeps, guests + 1))} disabled={guests >= p.sleeps} aria-label="Add guest">+</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>This stay sleeps up to {p.sleeps}.</div>
      </div>

      <div className="bookmob-field">
        <div className="bookmob-field-label" style={{ marginBottom: 10 }}>How you'd like to pay</div>
        <div className="bookmob-pay">
          <button
            type="button"
            className={"bookmob-pay-opt " + (info.payMethod === "zelle" ? "bookmob-pay-opt-active" : "")}
            onClick={() => setInfo({ ...info, payMethod: "zelle" })}
          >
            <span className="bookmob-pay-logo bookmob-pay-logo--zelle">
              <svg viewBox="0 0 24 24"><path d="M8 5.5h9L9 16.5h8V19H7v-2.5L15 6H8z" fill="#fff" /></svg>
            </span>
            <span className="bookmob-pay-name">Zelle</span>
            <span className="bookmob-pay-check">✓</span>
          </button>
          <button
            type="button"
            className={"bookmob-pay-opt " + (info.payMethod === "venmo" ? "bookmob-pay-opt-active" : "")}
            onClick={() => setInfo({ ...info, payMethod: "venmo" })}
          >
            <span className="bookmob-pay-logo bookmob-pay-logo--venmo">
              <svg viewBox="0 0 24 24"><path d="M18.5 3.5c.7 1.1 1 2.3 1 3.9 0 4.8-4.1 11-7.2 14.6H6.4L4 6.5l5.7-.5 1.2 9.8c1.2-1.9 2.6-4.9 2.6-6.9 0-1-.2-1.8-.5-2.4l5.5-3z" fill="#fff" /></svg>
            </span>
            <span className="bookmob-pay-name">Venmo</span>
            <span className="bookmob-pay-check">✓</span>
          </button>
        </div>
        <div className="bookmob-field-label">{info.payMethod === "zelle" ? "Zelle email or US phone" : "Venmo username"}</div>
        <input
          className="bookmob-field-input"
          value={info.payHandle}
          onChange={(e) => setInfo({ ...info, payHandle: e.target.value })}
          placeholder={info.payMethod === "zelle" ? "jane@email.com or +1 (555) 555-5555" : "@jane-doe"}
        />
        {touched && !payValid && <div className="bookmob-field-error">Add your {info.payMethod === "zelle" ? "Zelle handle" : "Venmo username"}.</div>}
      </div>

      <div className="bookmob-field">
        <div className="bookmob-field-label">Your name</div>
        <input
          className="bookmob-field-input"
          value={info.name}
          onChange={(e) => setInfo({ ...info, name: e.target.value })}
          placeholder="Jane Doe"
        />
        {touched && !info.name.trim() && <div className="bookmob-field-error">Add your full name.</div>}
      </div>

      <div className="bookmob-field">
        <div className="bookmob-field-label">Email</div>
        <input
          className="bookmob-field-input"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={info.email}
          onChange={(e) => setInfo({ ...info, email: e.target.value })}
          placeholder="jane@email.com"
        />
        {touched && !emailValid && <div className="bookmob-field-error">Enter a valid email.</div>}
      </div>

      <div className="bookmob-field">
        <div className="bookmob-field-label">Phone (optional)</div>
        <input
          className="bookmob-field-input"
          type="tel"
          inputMode="tel"
          value={info.phone}
          onChange={(e) => setInfo({ ...info, phone: e.target.value })}
          placeholder="+1 (555) 555-5555"
        />
      </div>

      <div className="bookmob-field">
        <div className="bookmob-field-label">Message for Mandy</div>
        <textarea
          className="bookmob-field-textarea"
          value={info.message}
          onChange={(e) => setInfo({ ...info, message: e.target.value })}
          placeholder={`Hi Mandy, we'd love to book the ${p.name.split(" with")[0]} for ${nights || "X"} night${nights !== 1 ? "s" : ""}. We're a party of ${guests}…`}
          rows={4}
        />
      </div>

      {submitError && (
        <div className="bookmob-tech-error" role="alert">
          <strong>Technical problem sending your request.</strong> Mandy may not get the notification right now. Tap <em>Send request</em> again to retry, or in the meantime email <a href="mailto:mandyzhang2400@gmail.com">mandyzhang2400@gmail.com</a> directly with your dates and contact info.
        </div>
      )}

      <div className="bookmob-cta-bar">
        <div className="bookmob-cta-row">
          <div className="bookmob-cta-price">
            <span className="bookmob-cta-price-val">
              {datesValid ? `${nights} night${nights !== 1 ? "s" : ""}` : "No charge yet"}
            </span>
            <span className="bookmob-cta-price-meta">
              Mandy replies in &lt;24h
            </span>
          </div>
          <button className="bookmob-cta-btn" onClick={submit} disabled={submitting || !valid}>
            <span>{submitting ? "Sending…" : "Send request"}</span>
            <span className="bookmob-cta-arrow">→</span>
          </button>
        </div>
      </div>

      <DateSheet open={sheetOpen} onClose={() => setSheetOpen(false)} dates={dates} setDates={setDates} />
    </div>
  );
}

function DateSheet({ open, onClose, dates, setDates }) {
  const [draft, setDraft] = useState({ checkin: dates.checkin, checkout: dates.checkout });
  const [bumpedTo, setBumpedTo] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft({ checkin: dates.checkin, checkout: dates.checkout });
      setBumpedTo(null);
    }
  }, [open, dates.checkin, dates.checkout]);

  const apply = (ci, co) => {
    const result = enforceWeekendMin(ci, co);
    setDraft({ checkin: result.checkin, checkout: result.checkout });
    setBumpedTo(result.bumped ? result.checkout : null);
  };
  const clear = () => { setDraft({ checkin: null, checkout: null }); setBumpedTo(null); };
  const confirm = () => { setDates(draft); onClose(); };

  return (
    <>
      <div className={"sheet-backdrop" + (open ? " open" : "")} onClick={onClose}></div>
      <div className={"sheet" + (open ? " open" : "")} role="dialog" aria-modal="true">
        <div className="sheet-handle"></div>
        <div className="sheet-head">
          <div className="sheet-title">Pick your dates</div>
          <button className="sheet-close" onClick={clear}>Clear</button>
        </div>
        <div className="sheet-body">
          <MobCalendar dates={draft} apply={apply} bumpedTo={bumpedTo} />
          <button
            className="sheet-cta"
            disabled={!(draft.checkin && draft.checkout)}
            onClick={confirm}
          >
            {draft.checkin && draft.checkout
              ? `Confirm ${nightsBetween(draft.checkin, draft.checkout)} night${nightsBetween(draft.checkin, draft.checkout) !== 1 ? "s" : ""}`
              : "Pick check-in and checkout"}
          </button>
        </div>
      </div>
    </>
  );
}

function MobCalendar({ dates, apply, bumpedTo }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const y = month.getFullYear(), m = month.getMonth();
  const startDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthName = month.toLocaleString("default", { month: "long", year: "numeric" });

  const ciDow = (dates.checkin && !dates.checkout) ? dates.checkin.getDay() : -1;
  const blockedCheckoutTime = (ciDow === 4 || ciDow === 5 || ciDow === 6)
    ? dates.checkin.getTime() + 86400000
    : null;

  const onDay = (day) => {
    const d = new Date(y, m, day);
    if (d < today) return;
    if (blockedCheckoutTime !== null && d.getTime() === blockedCheckoutTime) return;
    if (!dates.checkin || (dates.checkin && dates.checkout)) {
      apply(d, null);
    } else if (d <= dates.checkin) {
      apply(d, null);
    } else {
      apply(dates.checkin, d);
    }
  };

  const prevDisabled = y === today.getFullYear() && m === today.getMonth();

  return (
    <div className="mobcal">
      <div className="mobcal-head">
        <button onClick={() => !prevDisabled && setMonth(new Date(y, m - 1, 1))} disabled={prevDisabled} aria-label="Previous month">‹</button>
        <div className="mobcal-month">{monthName}</div>
        <button onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="mobcal-dow">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mobcal-grid">
        {Array.from({ length: startDay }).map((_, i) => <div key={"b"+i} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(y, m, day);
          const past = d < today;
          const blocked = blockedCheckoutTime !== null && d.getTime() === blockedCheckoutTime;
          const isStart = dates.checkin && d.getTime() === dates.checkin.getTime();
          const isEnd   = dates.checkout && d.getTime() === dates.checkout.getTime();
          let inRange = false;
          if (dates.checkin && dates.checkout) {
            inRange = d > dates.checkin && d < dates.checkout;
          }
          const cls = ["mobcal-day"];
          if (past || blocked) cls.push("past");
          if (isStart) cls.push("start");
          if (isEnd)   cls.push("end");
          if (inRange) cls.push("inrange");
          return (
            <div key={day} className={cls.join(" ")} onClick={() => !(past || blocked) && onDay(day)}>{day}</div>
          );
        })}
      </div>

      {bumpedTo ? (
        <div className="mobcal-bump" role="status">
          <span className="mobcal-bump-icon">↗</span>
          <span>Checkout extended to <strong>{bumpedTo.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</strong>, stays starting Thursday–Saturday require <strong>2 nights minimum</strong>.</span>
        </div>
      ) : (
        <div className="mobcal-rule">
          <span className="mobcal-rule-dot"></span>
          <span><strong>2-night minimum</strong> when check-in is on a Thursday, Friday, or Saturday.</span>
        </div>
      )}
    </div>
  );
}

function Confirmation({ data, onDone }) {
  const p = PROPERTIES.find(x => x.id === data.stayId) || PROPERTIES[0];
  const first = (data.info?.name || "").split(" ")[0] || "friend";
  const payMethodLabel = data.info?.payMethod === "venmo" ? "Venmo" : "Zelle";
  return (
    <div className="mob">
      <main className="mob-main" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="confirm-mob">
          <div className="confirm-mob-icon">✓</div>
          <h1 className="confirm-mob-title">Got it, {first}.</h1>
          <p className="confirm-mob-sub">
            Your request is on its way. Mandy replies within 24 hours with confirmation and a {payMethodLabel} request at {DISCOUNT_PCT}% off the Airbnb pre-tax price.
          </p>

          <div className="confirm-mob-card">
            <div className="confirm-mob-card-row"><span>Stay</span><span className="confirm-mob-card-row-val">{p.name}</span></div>
            <div className="confirm-mob-card-row"><span>Dates</span><span className="confirm-mob-card-row-val">{fmtRange(data.dates?.checkin, data.dates?.checkout)} · {data.nights} night{data.nights !== 1 ? "s" : ""}</span></div>
            <div className="confirm-mob-card-row"><span>Guests</span><span className="confirm-mob-card-row-val">{data.guests}</span></div>
            <div className="confirm-mob-card-row"><span>Pay via</span><span className="confirm-mob-card-row-val">{payMethodLabel}</span></div>
            <div className="confirm-mob-card-row"><span>Confirmation #</span><span className="confirm-mob-card-row-val">{data.conf}</span></div>
          </div>

          <div className="confirm-mob-next">
            <h3>What happens next</h3>
            <ol>
              <li>Mandy reviews your dates against the live Airbnb calendar.</li>
              <li>Within 24 hours, she replies with confirmation and the discounted total.</li>
              <li>You send the {payMethodLabel} payment, no card, no fee.</li>
              <li>24 hours before check-in, we send your keypad code.</li>
            </ol>
            <p className="confirm-mob-fallback">
              This site is relatively new, so if you don't hear back within 24 hours, please message Mandy directly at <a href="mailto:mandyzhang2400@gmail.com">mandyzhang2400@gmail.com</a>.
            </p>
          </div>

          <button className="confirm-mob-done" onClick={onDone}>Back to stays</button>
        </div>
      </main>
    </div>
  );
}

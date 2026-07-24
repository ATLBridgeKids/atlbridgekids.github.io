/* Atlanta Bridge Kids — shared client-side logic
   Handles nav, grade math from graduation year, and event rendering.
*/

// ---------- CONFIG ----------
// Replace these URLs after you publish the Google Sheet tabs to the web as CSV.
// File → Share → Publish to web → pick tab → CSV → copy the URL here.
const CONFIG = {
  eventsCsvUrl: "",    // e.g. "https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv"
  countsCsvUrl: "",    // Aggregate counts tab (event_id, signed_up, grade_pk, grade_k, grade_1 ... grade_12)
  signupFormUrl: "https://forms.gle/REPLACE-WITH-YOUR-SIGNUP-FORM",
  directoryFormUrl: "https://forms.gle/rcgYx6L8XjcE83sU6"
  // Directory download links (CSV/PDF) are set directly as hrefs in directory.html, not here.
  // IMPORTANT: those links must point to a SEPARATE spreadsheet file containing only opted-in
  // rows — never to the original signup/directory response spreadsheet. Google Sheets sharing
  // is file-wide, not per-tab, so link-sharing the raw response file would expose every family,
  // including ones who chose not to be shared. See SETUP.md for the safe way to set this up.
};

// ---------- Event format explainers (used by the "How this works" popup) ----------
const FORMATS = {
  tournament: {
    title: "How the Mini-Bridge Tournament works",
    body: `
      <p>Please arrive 15 minutes early so we can get organized and start on time.</p>
      <p>Players may come with a partner or will be matched with one for the day.</p>
      <p>Expect to play 12 boards over about two hours, followed by final awards.</p>
      <p>No bidding knowledge is required for mini-bridge, but players are expected to stay on task and keep voices at a low level throughout.</p>
    `
  },
  lesson_play: {
    title: "How Bridge Lesson + Supervised Play works",
    body: `
      <p>Each hour starts with a 10-minute lesson on a bridge concept, with examples.</p>
      <p>Kids then play hands specifically designed to reinforce that lesson.</p>
      <p>This repeats with a new lesson for the second hour.</p>
    `
  },
  lesson_minibridge: {
    title: "How Bridge Lesson + Duplicate Mini-Bridge Game works",
    body: `
      <p>A 10-minute lesson on a bridge concept, with a worksheet, kicks things off.</p>
      <p>That's followed by 6–10 boards of a duplicate mini-bridge game — similar to a tournament, just shorter.</p>
    `
  }
};

// ---------- Nav toggle (mobile hamburger) ----------
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
});

// ---------- Grade math from graduation year ----------
// U.S. school year rolls over ~August. A student graduating in year Y is in:
//   grade 12 during school year (Y-1)/Y
//   grade 11 during school year (Y-2)/(Y-1)
// School year "starts" for our purposes on Aug 1.
function currentGradeFromGradYear(gradYear) {
  const today = new Date();
  const schoolYearStart = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  // If gradYear = schoolYearStart + 1 → grade 12
  const grade = 12 - ((gradYear - 1) - schoolYearStart);
  return grade;
}

function gradeLabel(grade) {
  if (grade < 0) return "Pre-K";
  if (grade === 0) return "K";
  if (grade > 12) return "Post-grad";
  const suffix = (n) => {
    if (n >= 11 && n <= 13) return "th";
    const last = n % 10;
    return last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th";
  };
  return `${grade}${suffix(grade)}`;
}

// ---------- Tiny CSV parser (handles quoted commas + escaped quotes) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else { cell += c; }
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(v => v && v.trim() !== "")).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (r[i] ?? "").trim());
    return obj;
  });
}

async function fetchCsv(url) {
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return parseCsv(await res.text());
}

// ---------- Event helpers ----------
function isTbd(val) {
  return !val || /^tbd$/i.test(String(val).trim());
}

function parseEventDate(str) {
  // Accept YYYY-MM-DD or MM/DD/YYYY. Returns null for missing/TBD/unparseable.
  if (!str || isTbd(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str + "T00:00:00");
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[1]-1, +m[2]);
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function formatEventDate(d) {
  return {
    day: d.toLocaleDateString(undefined, { weekday: "short" }),
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    year: d.getFullYear(),
    full: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  };
}

function ymd(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Badge + label info for a single date or a date range. Handles TBD dates.
function formatDateRange(dateStr, dateEndStr) {
  const start = parseEventDate(dateStr);
  if (!start) {
    return { badgeTop: "", badgeMain: "Date TBD", full: "Date to be announced", tbd: true, isRange: false };
  }
  const end = dateEndStr ? parseEventDate(dateEndStr) : null;
  if (!end || end.getTime() === start.getTime()) {
    const dt = formatEventDate(start);
    return { badgeTop: dt.day, badgeMain: dt.date, full: dt.full, tbd: false, isRange: false, start, end: start };
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = sameMonth
    ? end.toLocaleDateString(undefined, { day: "numeric" })
    : end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const days = Math.round((end - start) / 86400000) + 1;
  const full = `${start.toLocaleDateString(undefined, { month: "long", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "long", day: "numeric" })}, ${end.getFullYear()}`;
  return { badgeTop: `${days}-day`, badgeMain: `${startLabel}–${endLabel}`, full, tbd: false, isRange: true, start, end };
}

function icsDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function buildEventDateTimes(ev) {
  // Returns null if the date itself isn't set yet.
  // Returns { allDay: true, start, end } if date is known but time isn't.
  // Returns { allDay: false, start, end } with real Date/time objects otherwise.
  const start = parseEventDate(ev.date);
  if (!start) return null;
  const end = ev.date_end ? (parseEventDate(ev.date_end) || start) : start;

  if (isTbd(ev.start_time)) {
    return { allDay: true, start, end };
  }

  const [sh, sm] = ev.start_time.split(":").map(Number);
  let eh, em;
  if (!isTbd(ev.end_time)) {
    [eh, em] = ev.end_time.split(":").map(Number);
  } else {
    eh = sh + 1; em = sm; // default 1hr duration if only end time is unset
  }
  const startDt = new Date(start); startDt.setHours(sh, sm, 0, 0);
  const endDt = new Date(end); endDt.setHours(eh, em, 0, 0);
  return { allDay: false, start: startDt, end: endDt };
}

function fullLocation(ev) {
  return ev.address ? `${ev.location ? ev.location + ", " : ""}${ev.address}` : (ev.location || "");
}

function googleCalUrl(ev) {
  const t = buildEventDateTimes(ev);
  if (!t) return "#";
  const datesParam = t.allDay
    ? `${ymd(t.start)}/${ymd(addDays(t.end, 1))}`
    : `${icsDate(t.start)}/${icsDate(t.end)}`;
  const timeNote = t.allDay ? "\n\nExact time TBD — check this page closer to the date." : "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title || "Atlanta Bridge Kids event",
    dates: datesParam,
    details: (ev.description || "") + timeNote + (ev.signup_url ? `\n\nSign up: ${ev.signup_url}` : ""),
    location: fullLocation(ev)
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsString(ev) {
  const t = buildEventDateTimes(ev);
  if (!t) return "";
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const desc = (ev.description || "") + (t.allDay ? " Exact time TBD." : "");
  const dtLines = t.allDay
    ? [`DTSTART;VALUE=DATE:${ymd(t.start)}`, `DTEND;VALUE=DATE:${ymd(addDays(t.end, 1))}`]
    : [`DTSTART:${icsDate(t.start)}`, `DTEND:${icsDate(t.end)}`];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atlanta Bridge Kids//EN",
    "BEGIN:VEVENT",
    `UID:${(ev.id || Date.now())}@atlbridgekids.github.io`,
    `DTSTAMP:${icsDate(new Date())}`,
    ...dtLines,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(desc)}`,
    `LOCATION:${esc(fullLocation(ev))}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function downloadIcs(ev) {
  const blob = new Blob([icsString(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ev.title || "event").replace(/[^\w-]+/g, "_")}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Load & merge events + counts ----------
async function loadEvents() {
  // Try published Sheet first; fall back to local events.json for setup phase.
  let events = null;
  try {
    if (CONFIG.eventsCsvUrl) {
      events = await fetchCsv(CONFIG.eventsCsvUrl);
    }
  } catch (e) { console.warn("Events CSV fetch failed, falling back:", e); }

  if (!events) {
    try {
      const res = await fetch("events.json", { cache: "no-store" });
      if (res.ok) events = await res.json();
    } catch (e) { /* ignore */ }
  }
  if (!events) events = [];

  // Optional counts overlay
  let counts = {};
  try {
    if (CONFIG.countsCsvUrl) {
      const rows = await fetchCsv(CONFIG.countsCsvUrl);
      if (rows) {
        rows.forEach(r => {
          if (r.event_id) counts[r.event_id] = r;
        });
      }
    }
  } catch (e) { console.warn("Counts CSV fetch failed:", e); }

  // Attach counts to matching events
  events.forEach(ev => {
    const c = counts[ev.id];
    if (c) {
      ev.signed_up = Number(c.signed_up || 0);
      ev.grade_counts = {};
      Object.keys(c).forEach(k => {
        if (k.startsWith("grade_") && c[k] && Number(c[k]) > 0) {
          ev.grade_counts[k.replace("grade_", "")] = Number(c[k]);
        }
      });
    }
  });

  return events;
}

// ---------- Rendering ----------
function eventCard(ev, { past = false, current = false } = {}) {
  const dr = formatDateRange(ev.date, ev.date_end);
  const type = (ev.type || "lesson").toLowerCase();
  const signupUrl = ev.signup_url || CONFIG.signupFormUrl;
  const noActions = past || current;

  let timeText = "";
  if (!isTbd(ev.start_time)) {
    timeText = `⏰ ${ev.start_time}${!isTbd(ev.end_time) ? "–" + ev.end_time : ""}`;
  } else if (ev.start_time) {
    // explicitly marked "TBD"
    timeText = "⏰ Time TBD";
  }

  const gradeChips = ev.grade_breakdown
    ? ev.grade_breakdown
    : (ev.grade_counts && Object.keys(ev.grade_counts).length
        ? Object.entries(ev.grade_counts)
            .sort((a,b) => (a[0]==="k"?-1: b[0]==="k"?1: Number(a[0]) - Number(b[0])))
            .map(([g, n]) => `${g === "k" ? "K" : g}: ${n}`).join(" · ")
        : "");

  const countsBlock = (ev.signed_up != null)
    ? `<div class="event-counts">
         <strong>${ev.signed_up}</strong> signed up
         ${gradeChips ? `<div class="grades">by grade — ${gradeChips}</div>` : ""}
       </div>`
    : "";

  const hasInfo = !!(ev.description || ev.address || (ev.format && FORMATS[ev.format]));
  const infoData = { title: ev.title, description: ev.description, location: ev.location, address: ev.address, format: ev.format };
  const infoLink = hasInfo
    ? `<button class="format-link" data-info='${JSON.stringify(infoData).replace(/'/g, "&apos;")}'>More info</button>`
    : "";

  let actions = "";
  if (!noActions) {
    const signupBtn = `<a class="btn btn-primary btn-small" href="${signupUrl}" target="_blank" rel="noopener">Sign up</a>`;
    if (dr.tbd) {
      actions = `<div class="event-actions">${signupBtn}${infoLink}<span class="disclaimer-inline" style="margin:0; padding:8px 10px;">Calendar link available once the date is set</span></div>`;
    } else {
      actions = `
        <div class="event-actions">
          ${signupBtn}
          <a class="btn btn-ghost btn-small" href="${googleCalUrl(ev)}" target="_blank" rel="noopener">Add to Google Calendar</a>
          <button class="btn btn-ghost btn-small" data-ics='${JSON.stringify(ev).replace(/'/g, "&apos;")}'>Download .ics</button>
          ${infoLink}
        </div>`;
    }
  } else if (infoLink) {
    actions = `<div class="event-actions">${infoLink}</div>`;
  }

  const cardClasses = [
    "event-card",
    past ? "past" : "",
    ev.featured ? "featured" : ""
  ].filter(Boolean).join(" ");

  return `
    <article class="${cardClasses}">
      <div class="event-head">
        <div class="event-date">
          ${dr.badgeTop ? `<span class="day">${dr.badgeTop}</span>` : ""}
          ${dr.badgeMain}
        </div>
        <div class="event-tags">
          ${current ? `<span class="live-tag">● Happening now</span>` : ""}
          ${ev.featured ? `<span class="featured-tag">★ Don't miss</span>` : ""}
          <span class="event-type ${type}">${ev.type || "Lesson"}</span>
        </div>
      </div>
      <h3 class="event-title">${ev.title || "Untitled event"}</h3>
      <div class="event-meta">
        ${timeText ? `<span>${timeText}</span>` : ""}
        ${ev.location ? `<span>📍 ${ev.location}</span>` : ""}
        ${ev.grades ? `<span>🎓 ${ev.grades}</span>` : ""}
      </div>
      ${countsBlock}
      ${actions}
    </article>
  `;
}

function openInfoModal(data) {
  const overlay = document.getElementById("info-modal-overlay");
  const titleEl = document.getElementById("info-modal-title");
  const bodyEl = document.getElementById("info-modal-body");
  if (!overlay || !titleEl || !bodyEl) return;

  const parts = [];
  if (data.description) parts.push(`<p>${data.description}</p>`);
  if (data.address) {
    const mapQuery = encodeURIComponent(`${data.location ? data.location + ", " : ""}${data.address}`);
    parts.push(`<p><strong>Address:</strong> ${data.address}<br><a href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" rel="noopener">Get directions ↗</a></p>`);
  }
  if (data.format && FORMATS[data.format]) {
    parts.push(`<hr style="border:none; border-top:1px solid var(--rule); margin:14px 0;">`);
    parts.push(`<h4 style="margin:0 0 8px; font-size:0.95rem; color:var(--navy);">${FORMATS[data.format].title.replace(/^How /, "How ")}</h4>`);
    parts.push(FORMATS[data.format].body);
  }

  titleEl.textContent = data.title || "Event details";
  bodyEl.innerHTML = parts.join("") || "<p>No additional details yet.</p>";
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeInfoModal() {
  const overlay = document.getElementById("info-modal-overlay");
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = "";
}

function attachInfoLinkHandlers(root) {
  root.querySelectorAll("[data-info]").forEach(btn => {
    btn.addEventListener("click", () => {
      try {
        const data = JSON.parse(btn.getAttribute("data-info").replace(/&apos;/g, "'"));
        openInfoModal(data);
      } catch (e) { console.error(e); }
    });
  });
}

function attachIcsHandlers(root) {
  root.querySelectorAll("[data-ics]").forEach(btn => {
    btn.addEventListener("click", () => {
      try {
        const ev = JSON.parse(btn.getAttribute("data-ics").replace(/&apos;/g, "'"));
        downloadIcs(ev);
      } catch (e) { console.error(e); }
    });
  });
}


async function renderEventsHome() {
  const upcomingEl = document.getElementById("upcoming-events");
  const pastEl = document.getElementById("past-events");
  const nextEl = document.getElementById("next-event");
  if (!upcomingEl && !pastEl) return;

  try {
    const events = await loadEvents();
    const now = new Date(); now.setHours(0,0,0,0);

    // Three buckets:
    //  - current: happening today, through the day AFTER it ends (a grace day)
    //  - upcoming: starts in the future, or has no set date yet (TBD)
    //  - past: fully over — the day after its grace day has come and gone
    // A "force_status" field on an event overrides this math if ever needed.
    const withDates = events.map(e => {
      const start = parseEventDate(e.date);
      const end = e.date_end ? (parseEventDate(e.date_end) || start) : start;
      const graceEnd = end ? addDays(end, 1) : null; // still "current" through this day
      let bucket;
      if (e.force_status === "past") bucket = "past";
      else if (e.force_status === "upcoming") bucket = "upcoming";
      else if (start && graceEnd && start <= now && now <= graceEnd) bucket = "current";
      else if (graceEnd && now > graceEnd) bucket = "past";
      else bucket = "upcoming";
      return { e, start, end, bucket };
    });

    const current = withDates.filter(x => x.bucket === "current").map(x => x.e);

    const upcoming = withDates
      .filter(x => x.bucket === "current" || x.bucket === "upcoming")
      .sort((a, b) => {
        // Current events always float to the top; otherwise sort by start date (TBD dates go last).
        if (a.bucket === "current" && b.bucket !== "current") return -1;
        if (b.bucket === "current" && a.bucket !== "current") return 1;
        const aKey = a.start ? a.start.getTime() : Infinity;
        const bKey = b.start ? b.start.getTime() : Infinity;
        return aKey - bKey;
      })
      .map(x => x.e);

    const past = withDates
      .filter(x => x.bucket === "past")
      .sort((a, b) => (b.end || 0) - (a.end || 0))
      .map(x => x.e);

    // Highlight banner — "Happening now" takes priority; otherwise "Next up" (soonest dated upcoming event)
    if (nextEl) {
      const liveEv = current[0];
      const nextEv = withDates.find(x => x.bucket === "upcoming" && x.start)?.e;
      const ev = liveEv || nextEv;
      if (ev) {
        const dr = formatDateRange(ev.date, ev.date_end);
        const timeBit = !isTbd(ev.start_time) ? " · " + ev.start_time : "";
        const label = liveEv ? "Happening now" : "Next up";
        const actionsHtml = liveEv
          ? `<div class="actions"><a class="btn btn-outline" href="#upcoming">See details</a></div>`
          : `<div class="actions">
               <a class="btn btn-primary" href="${ev.signup_url || CONFIG.signupFormUrl}" target="_blank" rel="noopener">Sign up</a>
               <a class="btn btn-outline" href="${googleCalUrl(ev)}" target="_blank" rel="noopener">Add to calendar</a>
             </div>`;
        nextEl.innerHTML = `
          <div class="eyebrow">${label}</div>
          <h2>${ev.title}</h2>
          <div class="meta">${dr.full}${timeBit}${ev.location ? " · " + ev.location : ""}</div>
          ${actionsHtml}
        `;
        nextEl.classList.toggle("live", !!liveEv);
        nextEl.hidden = false;
      } else {
        nextEl.hidden = true;
      }
    }

    if (upcomingEl) {
      upcomingEl.innerHTML = upcoming.length
        ? upcoming.map(ev => eventCard(ev, { current: current.includes(ev) })).join("")
        : `<div class="empty-state">No upcoming events posted yet. Check back soon.</div>`;
      attachIcsHandlers(upcomingEl);
      attachInfoLinkHandlers(upcomingEl);

      const countEl = document.getElementById("upcoming-count");
      if (countEl) countEl.textContent = upcoming.length ? `${upcoming.length} scheduled` : "";
    }

    if (pastEl) {
      pastEl.innerHTML = past.length
        ? past.slice(0, 10).map(ev => eventCard(ev, { past: true })).join("")
        : `<div class="empty-state">No past events on record yet.</div>`;
      attachInfoLinkHandlers(pastEl);

      const countEl = document.getElementById("past-count");
      if (countEl) countEl.textContent = past.length ? `${past.length} total` : "";
    }
  } catch (e) {
    console.error(e);
    if (upcomingEl) upcomingEl.innerHTML = `<div class="empty-state">Couldn't load events. Please refresh.</div>`;
  }
}

// Auto-run based on page
document.addEventListener("DOMContentLoaded", () => {
  renderEventsHome();

  // Format-explainer modal: close via X button, overlay click, or Escape
  const overlay = document.getElementById("info-modal-overlay");
  if (overlay) {
    const closeBtn = document.getElementById("info-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeInfoModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeInfoModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) closeInfoModal();
    });
  }
});

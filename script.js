const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const STYLES = ["salsa","bachata","kizomba"];
const qs = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));

const state = {
  events: [],
  view: "month",
  cursor: new Date(),
  filters: {
    date: "",
    location: "",
    styles: new Set(STYLES),
    search: ""
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  qs("#viewMode").addEventListener("change", e => { state.view = e.target.value; syncURL(); render(); });
  qs("#prevBtn").addEventListener("click", () => { shiftPeriod(-1); });
  qs("#nextBtn").addEventListener("click", () => { shiftPeriod(+1); });
  qs("#resetBtn").addEventListener("click", resetFilters);
  qs("#icsBtn").addEventListener("click", downloadICS);

  qs("#dateFilter").addEventListener("change", e => { state.filters.date = e.target.value ?? ""; syncURL(); render(); });
  qs("#locationFilter").addEventListener("change", e => { state.filters.location = e.target.value ?? ""; syncURL(); render(); });
  qsa(".typeFilter").forEach(chk => chk.addEventListener("change", () => {
    const v = new Set();
    qsa(".typeFilter").forEach(c => { if (c.checked) v.add(c.value); });
    state.filters.styles = v;
    syncURL(); render();
  }));
  qs("#searchFilter").addEventListener("input", e => { state.filters.search = e.target.value.trim(); syncURL(); render(); });

  await loadEvents();
  hydrateFiltersFromURL();
  populateLocations();
  render();
});

async function loadEvents() {
  try {
    const res = await fetch("events.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load events.json");
    const data = await res.json();
    state.events = data.map((e, idx) => ({
      id: e.id ?? `ev-${idx}`,
      title: e.title,
      style: (e.style || "").toLowerCase(),
      city: e.city,
      venue: e.venue || "",
      address: e.address || "",
      start: e.start,
      end: e.end || e.start,
      price: e.price || "",
      url: e.url || "",
      org: e.organizer || "",
      notes: e.notes || ""
    })).sort((a,b) => new Date(a.start) - new Date(b.start));
  } catch (err) {
    console.error(err);
    state.events = [];
  }
}

function populateLocations() {
  const sel = qs("#locationFilter");
  const cities = [...new Set(state.events.map(e => e.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  for (const c of cities) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
  if (state.filters.location) sel.value = state.filters.location;
}

function shiftPeriod(delta) {
  if (state.view === "month") {
    state.cursor.setMonth(state.cursor.getMonth() + delta);
  } else {
    state.cursor.setFullYear(state.cursor.getFullYear() + delta);
  }
  syncURL();
  render();
}

function resetFilters() {
  qs("#dateFilter").value = "";
  qs("#locationFilter").value = "";
  qs("#searchFilter").value = "";
  qsa(".typeFilter").forEach(c => c.checked = true);
  state.filters = { date:"", location:"", styles:new Set(STYLES), search:"" };
  state.view = "month";
  qs("#viewMode").value = "month";
  state.cursor = new Date();
  syncURL();
  render();
}

function render() {
  const periodLabel = qs("#periodLabel");
  const container = qs("#calendarContainer");
  container.innerHTML = "";
  qs("#listContainer").hidden = true;

  if (state.view === "month") {
    const year = state.cursor.getFullYear();
    const month = state.cursor.getMonth();
    periodLabel.textContent = `${state.cursor.toLocaleString('en-GB', { month:'long' })} ${year}`;
    renderMonth(container, year, month);
  } else {
    const year = state.cursor.getFullYear();
    periodLabel.textContent = `${year}`;
    renderYear(container, year);
  }
}

function renderMonth(container, year, monthIndex) {
  const wrap = document.createElement("div");
  wrap.className = "month-grid";

  for (const wd of WEEKDAYS) {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = wd;
    wrap.appendChild(el);
  }

  const firstOfMonth = new Date(year, monthIndex, 1);
  let startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  const totalCells = 42;
  const todayStr = toISODate(new Date());

  for (let cell = 0; cell < totalCells; cell++) {
    const dayEl = document.createElement("div");
    dayEl.className = "day";
    let dateObj;
    if (cell < startOffset) {
      const dayNum = prevMonthDays - startOffset + cell + 1;
      dateObj = new Date(year, monthIndex - 1, dayNum);
      dayEl.classList.add("outside");
    } else if (cell >= startOffset + daysInMonth) {
      const dayNum = cell - (startOffset + daysInMonth) + 1;
      dateObj = new Date(year, monthIndex + 1, dayNum);
      dayEl.classList.add("outside");
    } else {
      const dayNum = cell - startOffset + 1;
      dateObj = new Date(year, monthIndex, dayNum);
    }

    const iso = toISODate(dateObj);
    if (iso === todayStr) dayEl.classList.add("today");

    const header = document.createElement("div");
    header.className = "day-header";
    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = dateObj.getDate();
    header.appendChild(num);
    dayEl.appendChild(header);

    const dayEvents = getFilteredEvents().filter(ev => ev.start.startsWith(iso));
    for (const ev of dayEvents) {
      const evEl = document.createElement("div");
      evEl.className = `event ${ev.style}`;
      evEl.textContent = ev.title;
      evEl.title = `${ev.title} - ${new Date(ev.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
      evEl.addEventListener("click", () => showEvent(ev));
      dayEl.appendChild(evEl);
    }

    wrap.appendChild(dayEl);
  }

  container.appendChild(wrap);
}

function renderYear(container, year) {
  const grid = document.createElement("div");
  grid.className = "year-grid";

  for (let m = 0; m < 12; m++) {
    const card = document.createElement("div");
    card.className = "year-card";
    const h3 = document.createElement("h3");
    h3.textContent = new Date(year, m, 1).toLocaleString('en-GB', { month:'long' });
    card.appendChild(h3);

    const monthWrap = document.createElement("div");
    monthWrap.className = "month-grid";

    for (const wd of WEEKDAYS) {
      const el = document.createElement("div");
      el.className = "weekday";
      el.textContent = wd;
      monthWrap.appendChild(el);
    }

    const firstOfMonth = new Date(year, m, 1);
    let startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    for (let dayNum=1; dayNum<=daysInMonth; dayNum++) {
      const dateObj = new Date(year, m, dayNum);
      const iso = toISODate(dateObj);

      const dayEl = document.createElement("div");
      dayEl.className = "day";
      if (iso === toISODate(new Date())) dayEl.classList.add("today");
      if (dayNum === 1) dayEl.style.gridColumnStart = startOffset + 1;

      const header = document.createElement("div");
      header.className = "day-header";
      const num = document.createElement("div");
      num.className = "day-num";
      num.textContent = dayNum;
      header.appendChild(num);
      dayEl.appendChild(header);

      const dayEvents = getFilteredEvents().filter(ev => ev.start.startsWith(iso));
      for (const ev of dayEvents) {
        const evEl = document.createElement("div");
        evEl.className = `event ${ev.style}`;
        evEl.textContent = ev.title;
        evEl.title = `${ev.title} - ${new Date(ev.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
        evEl.addEventListener("click", () => showEvent(ev));
        dayEl.appendChild(evEl);
      }

      monthWrap.appendChild(dayEl);
    }

    card.appendChild(monthWrap);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function getFilteredEvents() {
  return state.events.filter(ev => {
    if (state.filters.date) {
      if (!ev.start.startsWith(state.filters.date)) return false;
    }
    if (state.filters.location) {
      if (ev.city !== state.filters.location) return false;
    }
    if (!state.filters.styles.has(ev.style)) return false;
    if (state.filters.search) {
      const s = state.filters.search.toLowerCase();
      if (![ev.title, ev.venue, ev.org].some(x => x.toLowerCase().includes(s))) return false;
    }
    return true;
  });
}

function toISODate(date) {
  return date.toISOString().slice(0,10);
}

function showEvent(ev) {
  const dlg = qs("#eventDialog");
  const content = qs("#eventContent");
  content.innerHTML = `
    <h3>${ev.title}</h3>
    <div class="meta">
      <strong>Style:</strong> ${capitalize(ev.style)}<br/>
      <strong>Location:</strong> ${ev.city}, ${ev.venue}<br/>
      <strong>Address:</strong> ${ev.address || 'N/A'}<br/>
      <strong>Start:</strong> ${new Date(ev.start).toLocaleString()}<br/>
      <strong>End:</strong> ${new Date(ev.end).toLocaleString()}<br/>
      <strong>Price:</strong> ${ev.price || 'Free'}<br/>
      <strong>Organizer:</strong> ${ev.org || 'N/A'}<br/>
      ${ev.notes ? `<em>${ev.notes}</em><br/>` : ''}
      ${ev.url ? `<a href="${ev.url}" target="_blank" rel="noopener noreferrer">More info</a>` : ''}
    </div>
  `;
  dlg.showModal();
}

function capitalize(str) {
  if (!str) return "";
  return str[0].toUpperCase() + str.slice(1);
}

function hydrateFiltersFromURL() {
  const params = new URLSearchParams(location.search);
  if (params.has("date")) {
    state.filters.date = params.get("date");
    qs("#dateFilter").value = state.filters.date;
  }
  if (params.has("location")) {
    state.filters.location = params.get("location");
  }
  if (params.has("styles")) {
    const styles = params.get("styles").split(",");
    state.filters.styles = new Set(styles.filter(s => STYLES.includes(s)));
  }
  if (params.has("search")) {
    state.filters.search = params.get("search");
    qs("#searchFilter").value = state.filters.search;
  }
  if (params.has("view")) {
    state.view = params.get("view");
    qs("#viewMode").value = state.view;
  }
  if (params.has("cursor")) {
    const dt = new Date(params.get("cursor"));
    if (!isNaN(dt)) state.cursor = dt;
  }
}

function syncURL() {
  const params = new URLSearchParams();
  if (state.filters.date) params.set("date", state.filters.date);
  if (state.filters.location) params.set("location", state.filters.location);
  if (state.filters.styles.size !== STYLES.length) params.set("styles", Array.from(state.filters.styles).join(","));
  if (state.filters.search) params.set("search", state.filters.search);
  if (state.view !== "month") params.set("view", state.view);
  if (state.cursor) params.set("cursor", state.cursor.toISOString());
  const newUrl = window.location.pathname + "?" + params.toString();
  history.replaceState(null, "", newUrl);
}

function downloadICS() {
  const events = getFilteredEvents();
  if (!events.length) {
    alert("No events to export.");
    return;
  }
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Denmark Dance Calendar//EN"
  ];

  for (const ev of events) {
    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`UID:${ev.id}@dancecalendar`);
    icsLines.push(`SUMMARY:${escapeICS(ev.title)}`);
    icsLines.push(`DESCRIPTION:${escapeICS(ev.org || "")} - ${escapeICS(ev.venue || "")}`);
    icsLines.push(`DTSTART:${formatDateICS(ev.start)}`);
    icsLines.push(`DTEND:${formatDateICS(ev.end)}`);
    if (ev.url) icsLines.push(`URL:${ev.url}`);
    icsLines.push("END:VEVENT");
  }

  icsLines.push("END:VCALENDAR");

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dance-events.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeICS(text) {
  return text.replace(/\\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;").replace(/\n/g,"\\n");
}

function formatDateICS(dateString) {
  const dt = new Date(dateString);
  return dt.toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
}

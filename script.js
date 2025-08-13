const STYLES = ["salsa", "bachata", "kizomba"];

const state = {
  events: [],
  filters: {
    date: "",
    location: "",
    styles: new Set(STYLES),
    search: ""
  },
  view: "month", // or "year"
  cursor: new Date()
};

document.addEventListener("DOMContentLoaded", async () => {
  state.events = await loadEvents();
  hydrateFiltersFromURL();
  renderFilters();
  renderCalendar();
  setupEventListeners();
});

async function loadEvents() {
  try {
    const resp = await fetch("events.json");
    if (!resp.ok) throw new Error("Failed to load events.json");
    return await resp.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

function renderFilters() {
  const styleContainer = document.querySelector("#styleFilters");
  styleContainer.innerHTML = "";
  for (const style of STYLES) {
    const id = `filter-${style}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = capitalize(style);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.checked = state.filters.styles.has(style);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.filters.styles.add(style);
      else state.filters.styles.delete(style);
      syncURL();
      renderCalendar();
    });
    label.prepend(checkbox);
    styleContainer.appendChild(label);
  }
  document.querySelector("#dateFilter").value = state.filters.date || "";
  document.querySelector("#locationFilter").value = state.filters.location || "";
  document.querySelector("#searchFilter").value = state.filters.search || "";
  document.querySelector("#viewMode").value = state.view;
}

function setupEventListeners() {
  document.querySelector("#dateFilter").addEventListener("change", (e) => {
    state.filters.date = e.target.value;
    syncURL();
    renderCalendar();
  });
  document.querySelector("#locationFilter").addEventListener("input", (e) => {
    state.filters.location = e.target.value.trim();
    syncURL();
    renderCalendar();
  });
  document.querySelector("#searchFilter").addEventListener("input", (e) => {
    state.filters.search = e.target.value.trim();
    syncURL();
    renderCalendar();
  });
  document.querySelector("#viewMode").addEventListener("change", (e) => {
    state.view = e.target.value;
    syncURL();
    renderCalendar();
  });
  document.querySelector("#downloadBtn").addEventListener("click", downloadICS);
  document.querySelector("#eventDialog").querySelector("button").addEventListener("click", () => {
    document.querySelector("#eventDialog").close();
  });
}

function renderCalendar() {
  const container = document.querySelector("#calendarContainer");
  container.innerHTML = "";

  if (state.view === "month") {
    renderMonthView(container, state.cursor.getFullYear(), state.cursor.getMonth());
  } else if (state.view === "year") {
    renderYearView(container, state.cursor.getFullYear());
  }
}

function renderMonthView(container, year, month) {
  const card = document.createElement("div");
  card.className = "month-card";

  const header = document.createElement("h2");
  header.textContent = `${year} - ${month + 1}`;
  card.appendChild(header);

  const monthWrap = document.createElement("div");
  monthWrap.className = "month-grid";

  // Weekday headers
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const wd of weekdays) {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = wd;
    monthWrap.appendChild(el);
  }

  const firstOfMonth = new Date(year, month, 1);
  let startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateObj = new Date(year, month, dayNum);
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

      // Create clickable link for event title
      const link = document.createElement("a");
      link.href = ev.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = ev.title;
      link.title = `${ev.title} - ${new Date(ev.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      evEl.appendChild(link);
      evEl.addEventListener("click", () => showEvent(ev));

      dayEl.appendChild(evEl);
    }

    monthWrap.appendChild(dayEl);
  }

  card.appendChild(monthWrap);
  container.appendChild(card);
}

function renderYearView(container, year) {
  const grid = document.createElement("div");
  grid.className = "year-grid";

  for (let m = 0; m < 12; m++) {
    const card = document.createElement("div");
    card.className = "month-card";

    const header = document.createElement("h3");
    header.textContent = `${year} - ${m + 1}`;
    card.appendChild(header);

    const monthWrap = document.createElement("div");
    monthWrap.className = "month-grid";

    // Weekday headers
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const wd of weekdays) {
      const el = document.createElement("div");
      el.className = "weekday";
      el.textContent = wd;
      monthWrap.appendChild(el);
    }

    const firstOfMonth = new Date(year, m, 1);
    let startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
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

        // Create clickable link for event title
        const link = document.createElement("a");
        link.href = ev.url || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = ev.title;
        link.title = `${ev.title} - ${new Date(ev.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

        evEl.appendChild(link);
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
      if (!ev.city.toLowerCase().includes(state.filters.location.toLowerCase())) return false;
    }
    if (!state.filters.styles.has(ev.style)) return false;
    if (state.filters.search) {
      const s = state.filters.search.toLowerCase();
      if (![ev.title, ev.venue, ev.organizer].some(x => x.toLowerCase().includes(s))) return false;
    }
    return true;
  });
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function showEvent(ev) {
  const dlg = document.querySelector("#eventDialog");
  const content = document.querySelector("#eventContent");
  content.innerHTML = `
    <h3>${ev.title}</h3>
    <div class="meta">
      <strong>Style:</strong> ${capitalize(ev.style)}<br/>
      <strong>Location:</strong> ${ev.city}, ${ev.venue}<br/>
      <strong>Address:</strong> ${ev.address || 'N/A'}<br/>
      <strong>Start:</strong> ${new Date(ev.start).toLocaleString()}<br/>
      <strong>End:</strong> ${new Date(ev.end).toLocaleString()}<br/>
      <strong>Price:</strong> ${ev.price || 'Free'}<br/>
      <strong>Organizer:</strong> ${ev.organizer || 'N/A'}<br/>
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
    document.querySelector("#dateFilter").value = state.filters.date;
  }
  if (params.has("location")) {
    state.filters.location = params.get("location");
    document.querySelector("#locationFilter").value = state.filters.location;
  }
  if (params.has("styles")) {
    const styles = params.get("styles").split(",");
    state.filters.styles = new Set(styles.filter(s => STYLES.includes(s)));
  }
  if (params.has("search")) {
    state.filters.search = params.get("search");
    document.querySelector("#searchFilter").value = state.filters.search;
  }
  if (params.has("view")) {
    state.view = params.get("view");
    document.querySelector("#viewMode").value = state.view;
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
    icsLines.push(`DESCRIPTION:${escapeICS(ev.organizer || "")} - ${escapeICS(ev.venue || "")}`);
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
  return text.replace(/\\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function formatDateICS(dateString) {
  const dt = new Date(dateString);
  return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}


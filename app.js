/* Family Calendar — vanilla JS, localStorage-backed */
(() => {
  "use strict";

  const STORAGE_KEY = "familyCalendar.v1";
  const DEFAULT_COLORS = ["#ef6c7a", "#4a90ff", "#2fb673", "#ffb020", "#9b6bff"];
  const DEFAULT_NAMES = ["Mom", "Dad", "Ava", "Leo", "Mia"];

  // ---------- State ----------
  const state = {
    viewYear: 0,
    viewMonth: 0, // 0-11
    members: [],  // {id, name, color, visible}
    events: [],   // {id, title, date, time, memberIds: [], location, notes}
    editingId: null,
    selectedWho: [], // for modal
  };

  // ---------- Persistence ----------
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        state.members = data.members || [];
        state.events = data.events || [];
      } catch {
        seedDefaults();
      }
    } else {
      seedDefaults();
    }
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ members: state.members, events: state.events })
    );
  }

  function seedDefaults() {
    state.members = DEFAULT_NAMES.map((name, i) => ({
      id: uid(),
      name,
      color: DEFAULT_COLORS[i],
      visible: true,
    }));
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const iso = (day) => formatDate(new Date(y, m, day));
    state.events = [
      {
        id: uid(),
        title: "Soccer practice",
        date: iso(today.getDate() + 1),
        time: "17:00",
        memberIds: [state.members[2].id],
        location: "Community field",
        notes: "",
      },
      {
        id: uid(),
        title: "Family dinner",
        date: iso(today.getDate()),
        time: "19:00",
        memberIds: state.members.map((m) => m.id),
        location: "Home",
        notes: "Pizza night",
      },
      {
        id: uid(),
        title: "Piano lesson",
        date: iso(today.getDate() + 3),
        time: "16:30",
        memberIds: [state.members[4].id],
        location: "Ms. Harper's studio",
        notes: "",
      },
      {
        id: uid(),
        title: "Dentist",
        date: iso(today.getDate() + 5),
        time: "09:15",
        memberIds: [state.members[3].id],
        location: "Smile Dental",
        notes: "",
      },
    ];
    save();
  }

  // ---------- Utils ----------
  function uid() { return Math.random().toString(36).slice(2, 10); }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function formatDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}${m ? ":" + pad(m) : ""}${ampm}`;
  }

  function monthLabel(y, m) {
    return new Date(y, m, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  function memberById(id) { return state.members.find((m) => m.id === id); }

  function eventsOn(date) {
    const iso = formatDate(date);
    return state.events
      .filter((e) => e.date === iso)
      .filter((e) => e.memberIds.some((id) => {
        const m = memberById(id);
        return m && m.visible;
      }) || e.memberIds.length === 0)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }

  function eventColor(e) {
    const first = e.memberIds.map(memberById).filter(Boolean)[0];
    return first ? first.color : "#7e8699";
  }

  // ---------- Rendering ----------
  function renderMembers() {
    const list = document.getElementById("membersList");
    list.innerHTML = "";
    state.members.forEach((m) => {
      const li = document.createElement("li");
      li.className = "member" + (m.visible ? "" : " off");
      li.style.setProperty("--mc", m.color);
      li.innerHTML = `
        <div class="avatar">${m.name.trim().charAt(0).toUpperCase()}</div>
        <div class="name">${escapeHtml(m.name)}</div>
        <div class="check"></div>
      `;
      li.addEventListener("click", () => {
        m.visible = !m.visible;
        save();
        renderMembers();
        renderCalendar();
        renderUpcoming();
      });
      list.appendChild(li);
    });
  }

  function renderUpcoming() {
    const ul = document.getElementById("upcomingList");
    ul.innerHTML = "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = state.events
      .filter((e) => {
        const d = parseDate(e.date);
        return d >= today && e.memberIds.some((id) => {
          const m = memberById(id);
          return m && m.visible;
        });
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || "").localeCompare(b.time || "");
      })
      .slice(0, 6);

    if (!upcoming.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Nothing on the horizon.";
      ul.appendChild(li);
      return;
    }

    upcoming.forEach((e) => {
      const d = parseDate(e.date);
      const li = document.createElement("li");
      li.style.setProperty("--mc", eventColor(e));
      const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const who = e.memberIds.map(memberById).filter(Boolean).map((m) => m.name).join(", ");
      li.innerHTML = `
        <div class="u-title">${escapeHtml(e.title)}</div>
        <div class="u-meta">${day}${e.time ? " · " + fmtTime(e.time) : ""}${who ? " · " + escapeHtml(who) : ""}</div>
      `;
      li.addEventListener("click", () => openEventModal(e));
      ul.appendChild(li);
    });
  }

  function renderCalendar() {
    const title = document.getElementById("monthTitle");
    title.textContent = monthLabel(state.viewYear, state.viewMonth);

    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    const firstOfMonth = new Date(state.viewYear, state.viewMonth, 1);
    const startDay = firstOfMonth.getDay(); // 0 Sun
    const startDate = new Date(firstOfMonth);
    startDate.setDate(1 - startDay);

    const today = new Date();

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const inMonth = d.getMonth() === state.viewMonth;
      const isToday = sameDay(d, today);
      const wknd = d.getDay() === 0 || d.getDay() === 6;

      const cell = document.createElement("div");
      cell.className = "cell"
        + (inMonth ? "" : " other")
        + (isToday ? " today" : "")
        + (wknd ? " weekend" : "");
      cell.dataset.date = formatDate(d);

      const dayNum = document.createElement("div");
      dayNum.className = "day-num";
      dayNum.textContent = d.getDate();
      cell.appendChild(dayNum);

      const events = eventsOn(d);
      const eventsWrap = document.createElement("div");
      eventsWrap.className = "events";

      const max = 3;
      events.slice(0, max).forEach((e) => {
        const pill = document.createElement("div");
        pill.className = "event";
        pill.style.setProperty("--mc", eventColor(e));
        pill.innerHTML = (e.time ? `<span class="time">${fmtTime(e.time)}</span>` : "")
          + escapeHtml(e.title);
        pill.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openEventModal(e);
        });
        eventsWrap.appendChild(pill);
      });

      if (events.length > max) {
        const more = document.createElement("button");
        more.className = "more";
        more.textContent = `+${events.length - max} more`;
        more.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openDayPeek(d, cell);
        });
        eventsWrap.appendChild(more);
      }

      cell.appendChild(eventsWrap);

      cell.addEventListener("click", () => {
        openEventModal(null, formatDate(d));
      });

      grid.appendChild(cell);
    }
  }

  function renderAll() {
    renderMembers();
    renderUpcoming();
    renderCalendar();
  }

  // ---------- Event Modal ----------
  function openEventModal(event = null, dateIso = null) {
    state.editingId = event ? event.id : null;
    document.getElementById("modalTitle").textContent = event ? "Edit event" : "New event";
    document.getElementById("evTitle").value = event ? event.title : "";
    document.getElementById("evDate").value = event ? event.date : (dateIso || formatDate(new Date()));
    document.getElementById("evTime").value = event ? (event.time || "") : "";
    document.getElementById("evLocation").value = event ? (event.location || "") : "";
    document.getElementById("evNotes").value = event ? (event.notes || "") : "";
    state.selectedWho = event
      ? [...event.memberIds]
      : state.members.slice(0, 1).map((m) => m.id);
    renderWhoChips();

    document.getElementById("deleteEventBtn").hidden = !event;
    document.getElementById("eventModal").hidden = false;
    setTimeout(() => document.getElementById("evTitle").focus(), 40);
    closeDayPeek();
  }

  function closeEventModal() {
    document.getElementById("eventModal").hidden = true;
    state.editingId = null;
  }

  function renderWhoChips() {
    const wrap = document.getElementById("whoChips");
    wrap.innerHTML = "";
    state.members.forEach((m) => {
      const on = state.selectedWho.includes(m.id);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (on ? " on" : "");
      chip.style.setProperty("--mc", m.color);
      chip.innerHTML = `<span class="dot">${m.name.charAt(0).toUpperCase()}</span>${escapeHtml(m.name)}`;
      chip.addEventListener("click", () => {
        if (on) state.selectedWho = state.selectedWho.filter((id) => id !== m.id);
        else state.selectedWho = [...state.selectedWho, m.id];
        renderWhoChips();
      });
      wrap.appendChild(chip);
    });
  }

  function saveEventFromForm(ev) {
    ev.preventDefault();
    const title = document.getElementById("evTitle").value.trim();
    const date = document.getElementById("evDate").value;
    const time = document.getElementById("evTime").value;
    const location = document.getElementById("evLocation").value.trim();
    const notes = document.getElementById("evNotes").value.trim();
    if (!title || !date) return;
    const memberIds = state.selectedWho.length ? state.selectedWho : [];

    if (state.editingId) {
      const idx = state.events.findIndex((e) => e.id === state.editingId);
      if (idx >= 0) {
        state.events[idx] = { ...state.events[idx], title, date, time, location, notes, memberIds };
      }
    } else {
      state.events.push({ id: uid(), title, date, time, location, notes, memberIds });
    }
    save();
    closeEventModal();
    renderAll();
  }

  function deleteCurrentEvent() {
    if (!state.editingId) return;
    if (!confirm("Delete this event?")) return;
    state.events = state.events.filter((e) => e.id !== state.editingId);
    save();
    closeEventModal();
    renderAll();
  }

  // ---------- Members Modal ----------
  function openMembersModal() {
    const wrap = document.getElementById("membersEdit");
    wrap.innerHTML = "";
    state.members.forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "me-row";
      row.innerHTML = `
        <input type="color" value="${m.color}" data-i="${i}" class="me-color" />
        <input type="text" value="${escapeAttr(m.name)}" data-i="${i}" class="me-name" maxlength="24" />
      `;
      wrap.appendChild(row);
    });
    document.getElementById("membersModal").hidden = false;
  }

  function closeMembersModal() {
    document.getElementById("membersModal").hidden = true;
  }

  function saveMembers() {
    const nameInputs = document.querySelectorAll(".me-name");
    const colorInputs = document.querySelectorAll(".me-color");
    nameInputs.forEach((inp) => {
      const i = parseInt(inp.dataset.i, 10);
      const v = inp.value.trim();
      if (v) state.members[i].name = v;
    });
    colorInputs.forEach((inp) => {
      const i = parseInt(inp.dataset.i, 10);
      state.members[i].color = inp.value;
    });
    save();
    closeMembersModal();
    renderAll();
  }

  // ---------- Day Peek ----------
  function openDayPeek(date, anchor) {
    const peek = document.getElementById("dayPeek");
    document.getElementById("peekDate").textContent = date.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric",
    });
    const ul = document.getElementById("peekList");
    ul.innerHTML = "";
    const events = eventsOn(date);
    if (!events.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No events yet.";
      ul.appendChild(li);
    } else {
      events.forEach((e) => {
        const li = document.createElement("li");
        li.style.setProperty("--mc", eventColor(e));
        li.innerHTML = `${e.time ? `<span class="t">${fmtTime(e.time)}</span>` : ""}${escapeHtml(e.title)}`;
        li.addEventListener("click", () => openEventModal(e));
        ul.appendChild(li);
      });
    }
    peek.hidden = false;
    document.getElementById("peekAddBtn").onclick = () => {
      closeDayPeek();
      openEventModal(null, formatDate(date));
    };
    positionPeek(peek, anchor);
  }

  function positionPeek(peek, anchor) {
    const r = anchor.getBoundingClientRect();
    const pw = 280, ph = peek.offsetHeight || 200;
    let left = r.right + 8;
    let top = r.top;
    if (left + pw > window.innerWidth - 8) left = r.left - pw - 8;
    if (left < 8) left = Math.max(8, r.left);
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    peek.style.left = left + "px";
    peek.style.top = top + "px";
  }

  function closeDayPeek() {
    document.getElementById("dayPeek").hidden = true;
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- Navigation ----------
  function navigate(delta) {
    state.viewMonth += delta;
    if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    if (state.viewMonth < 0)  { state.viewMonth = 11; state.viewYear--; }
    renderCalendar();
  }

  function goToday() {
    const t = new Date();
    state.viewYear = t.getFullYear();
    state.viewMonth = t.getMonth();
    renderCalendar();
  }

  // ---------- Init ----------
  function init() {
    load();
    const today = new Date();
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();

    document.getElementById("todayLabel").textContent = today.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric",
    });

    document.getElementById("prevBtn").addEventListener("click", () => navigate(-1));
    document.getElementById("nextBtn").addEventListener("click", () => navigate(1));
    document.getElementById("todayBtn").addEventListener("click", goToday);
    document.getElementById("newEventBtn").addEventListener("click", () => openEventModal());

    document.getElementById("closeModalBtn").addEventListener("click", closeEventModal);
    document.getElementById("cancelBtn").addEventListener("click", closeEventModal);
    document.getElementById("eventForm").addEventListener("submit", saveEventFromForm);
    document.getElementById("deleteEventBtn").addEventListener("click", deleteCurrentEvent);
    document.getElementById("eventModal").addEventListener("click", (e) => {
      if (e.target.id === "eventModal") closeEventModal();
    });

    document.getElementById("editMembersBtn").addEventListener("click", openMembersModal);
    document.getElementById("closeMembersBtn").addEventListener("click", closeMembersModal);
    document.getElementById("saveMembersBtn").addEventListener("click", saveMembers);
    document.getElementById("membersModal").addEventListener("click", (e) => {
      if (e.target.id === "membersModal") closeMembersModal();
    });

    document.getElementById("allOnBtn").addEventListener("click", () => {
      state.members.forEach((m) => (m.visible = true));
      save(); renderAll();
    });
    document.getElementById("allOffBtn").addEventListener("click", () => {
      state.members.forEach((m) => (m.visible = false));
      save(); renderAll();
    });

    document.getElementById("closePeekBtn").addEventListener("click", closeDayPeek);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeEventModal();
        closeMembersModal();
        closeDayPeek();
      }
      if (e.key === "ArrowLeft"  && !isTyping(e)) navigate(-1);
      if (e.key === "ArrowRight" && !isTyping(e)) navigate(1);
      if (e.key === "t" && !isTyping(e)) goToday();
      if (e.key === "n" && !isTyping(e)) openEventModal();
    });

    document.addEventListener("click", (e) => {
      const peek = document.getElementById("dayPeek");
      if (peek.hidden) return;
      if (!peek.contains(e.target) && !e.target.classList.contains("more")) {
        closeDayPeek();
      }
    });

    renderAll();
  }

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

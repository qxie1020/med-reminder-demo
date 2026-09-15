(() => {
  "use strict";

  const searchInput = document.querySelector("#searchInput");
  const medicationList = document.querySelector("#medicationList");
  const toast = document.querySelector("#toast");
  const filterTabs = [...document.querySelectorAll(".filter-tab")];
  const sortButtons = [...document.querySelectorAll(".sort-btn")];
  const timeItems = [...document.querySelectorAll(".time-item")];
  const sections = [...document.querySelectorAll(".time-section")];
  const timelinePanel = document.querySelector(".timeline-panel");
  const contentGrid = document.querySelector(".content-grid");
  const timelineTitle = timelinePanel?.querySelector(".timeline-title-row h2");
  const timelineMeta = timelinePanel?.querySelector(".timeline-title-row span");
  const timeList = document.querySelector("#timeList");
  const drawer = document.querySelector("#medDrawer");
  const drawerBackdrop = document.querySelector("#drawerBackdrop");
  const drawerClose = document.querySelector("#drawerClose");

  const totals = {
    total: 0,
    completed: 0,
    pending: 0,
    stat: 0,
    patients: 0
  };

  const state = {
    filter: "all",
    sort: "timeline",
    search: "",
    selectedPatientKey: ""
  };

  let toastTimer = null;
  let patientNavList = null;
  let patientGroups = [];

  const timelineOrder = ["stat", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];
  const allRows = [...document.querySelectorAll(".med-row")];
  const rowOrigins = new Map();

  sections.forEach(section => {
    const body = section.querySelector(".time-body");
    if (!body) return;
    [...body.querySelectorAll(".med-row")].forEach((row, index) => {
      rowOrigins.set(row, { body, index });
    });
  });

  function normalize(value = "") {
    return value.toString().trim().toLowerCase().replace(/\s+/g, " ");
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  function getRows() {
    return allRows;
  }

  function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function getTimeRank(value) {
    const index = timelineOrder.indexOf(value);
    return index === -1 ? timelineOrder.length : index;
  }

  function getPatientMeta(row) {
    const patient = row.querySelector(".patient-info");
    const bedBadge = row.querySelector(".bed-badge");
    const name = patient?.querySelector("b")?.childNodes?.[0]?.textContent?.trim() || "未命名病人";
    const mrn = patient?.querySelector("small")?.textContent?.trim() || "--";
    const bed = bedBadge?.childNodes?.[0]?.textContent?.trim() || "--";
    const bedExtra = bedBadge?.querySelector("small")?.textContent?.trim() || "";

    return {
      // 病歷號理論上應唯一；示意資料仍以病歷號＋床號＋姓名組合，避免錯誤資料把不同病人合併。
      key: `${mrn}|${bed}|${bedExtra}|${name}`,
      name,
      gender: patient?.querySelector("em")?.textContent?.trim() || "",
      age: patient?.querySelector("b span")?.textContent?.trim() || "",
      mrn,
      bed,
      bedExtra
    };
  }

  function refreshTotals() {
    const rows = getRows();
    totals.total = rows.length;
    totals.completed = rows.filter(row => row.dataset.status === "done").length;
    totals.pending = rows.filter(row => row.dataset.status === "pending").length;
    totals.stat = rows.filter(row => row.dataset.stat === "true" && row.dataset.status === "pending").length;
    totals.patients = new Set(rows.map(row => getPatientMeta(row).key)).size;
  }

  function updateProgressUI() {
    refreshTotals();
    const percent = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;

    const completedCount = document.querySelector("#completedCount");
    const totalCount = document.querySelector("#totalCount");
    const pendingCount = document.querySelector("#pendingCount");
    const progressPercent = document.querySelector("#progressPercent");
    const progressBar = document.querySelector("#progressBar");
    const allTabCount = document.querySelector("#allTabCount");
    const pendingTabCount = document.querySelector("#pendingTabCount");
    const doneTabCount = document.querySelector("#doneTabCount");
    const statTabCount = document.querySelector("#statTabCount");
    const statSummaryCount = document.querySelector("#statSummaryCount");
    const patientCount = document.querySelector("#patientCount");

    if (completedCount) completedCount.textContent = totals.completed;
    if (totalCount) totalCount.textContent = totals.total;
    if (pendingCount) pendingCount.textContent = totals.pending;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (allTabCount) allTabCount.textContent = totals.total;
    if (pendingTabCount) pendingTabCount.textContent = totals.pending;
    if (doneTabCount) doneTabCount.textContent = totals.completed;
    if (statTabCount) statTabCount.textContent = totals.stat;
    if (statSummaryCount) statSummaryCount.textContent = totals.stat;
    if (patientCount) patientCount.textContent = totals.patients;
  }

  function rowMatches(row) {
    const text = normalize(`${row.dataset.search || ""} ${row.textContent || ""}`);
    const matchesSearch = !state.search || text.includes(state.search);

    let matchesFilter = true;
    if (state.filter === "pending") matchesFilter = row.dataset.status === "pending";
    if (state.filter === "done") matchesFilter = row.dataset.status === "done";
    if (state.filter === "stat") matchesFilter = row.dataset.stat === "true" && row.dataset.status === "pending";

    return matchesSearch && matchesFilter;
  }

  function applyFilters() {
    getRows().forEach(row => {
      row.hidden = !rowMatches(row);
    });

    if (state.sort === "person") {
      sections.forEach(section => section.hidden = true);
      refreshPatientModeVisibility();
      return;
    }

    patientGroups.forEach(group => group.hidden = true);
    sections.forEach(section => {
      const rows = [...section.querySelectorAll(".med-row")];
      section.hidden = !rows.some(row => !row.hidden);
    });
  }

  function setFilter(filter) {
    state.filter = filter;
    filterTabs.forEach(tab => {
      const active = tab.dataset.filter === filter;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    applyFilters();
  }

  function setSectionExpanded(section, expanded) {
    if (!section) return;
    section.classList.toggle("expanded", expanded);
    section.classList.toggle("collapsed", !expanded);

    const header = section.querySelector(":scope > .time-header, :scope > .patient-header");
    const arrow = section.querySelector(":scope > .time-header .arrow, :scope > .patient-header .arrow");
    if (header) header.setAttribute("aria-expanded", String(expanded));
    if (arrow) arrow.textContent = expanded ? "⌃" : "⌄";
  }

  function updateSectionBadges() {
    sections.forEach(section => {
      const body = section.querySelector(".time-body");
      const rows = getRows().filter(row => rowOrigins.get(row)?.body === body);
      const pending = rows.filter(row => row.dataset.status === "pending").length;
      const patientTotal = new Set(rows.map(row => getPatientMeta(row).key)).size;
      const doneAll = rows.length > 0 && pending === 0;
      const summary = section.querySelector(".section-title small");
      const badge = section.querySelector(".pending-count");
      const timeItem = timeItems.find(item => item.dataset.time === section.dataset.sectionTime);
      const timeCount = timeItem?.querySelector("[data-count]");

      if (summary) {
        summary.classList.add("section-metrics");
        summary.innerHTML = `
          <span class="section-metric med-count"><i aria-hidden="true"></i><b>${rows.length}</b>筆</span>
          <span class="section-metric patient-count"><i aria-hidden="true"></i><b>${patientTotal}</b>位</span>
        `;
      }

      if (timeCount) timeCount.textContent = `${rows.length} 筆`;

      section.classList.toggle("completed", doneAll);
      if (!badge) return;

      if (doneAll) {
        badge.textContent = "已完成";
        badge.classList.add("done-count");
      } else {
        badge.classList.remove("done-count");
        badge.textContent = `${pending} 待執行`;
      }
    });
  }

  function clearPatientTimeChips() {
    getRows().forEach(row => row.querySelector(".row-time-chip")?.remove());
  }

  function ensurePatientNavList() {
    if (patientNavList || !timelinePanel) return patientNavList;
    patientNavList = document.createElement("div");
    patientNavList.className = "patient-nav-list";
    patientNavList.id = "patientNavList";
    patientNavList.hidden = true;
    timelinePanel.appendChild(patientNavList);
    return patientNavList;
  }

  function getPatientTimeLabel(time) {
    return time === "stat" ? "立即給藥" : time;
  }

  function selectPatient(patientKey, options = {}) {
    if (!patientKey) return;
    state.selectedPatientKey = patientKey;

    patientGroups.forEach(group => {
      const hasVisible = group.dataset.hasVisible === "true";
      group.hidden = !hasVisible || group.dataset.patientKey !== patientKey;
    });

    patientNavList?.querySelectorAll(".patient-nav-item").forEach(button => {
      const active = button.dataset.patientTarget === patientKey && !button.hidden;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });

    if (options.scroll) {
      const selected = patientGroups.find(group => group.dataset.patientKey === patientKey);
      requestAnimationFrame(() => selected?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function refreshPatientModeVisibility() {
    if (state.sort !== "person") return;

    const visibleKeys = [];

    patientGroups.forEach(group => {
      const rows = [...group.querySelectorAll(".med-row")];
      const hasVisible = rows.some(row => !row.hidden);
      group.dataset.hasVisible = String(hasVisible);

      group.querySelectorAll(".patient-time-section").forEach(timeSection => {
        const timeRows = [...timeSection.querySelectorAll(".med-row")];
        timeSection.hidden = !timeRows.some(row => !row.hidden);
      });

      const navButton = [...(patientNavList?.querySelectorAll(".patient-nav-item") || [])]
        .find(button => button.dataset.patientTarget === group.dataset.patientKey);
      if (navButton) navButton.hidden = !hasVisible;
      if (hasVisible) visibleKeys.push(group.dataset.patientKey || "");
    });

    if (timelineMeta) timelineMeta.textContent = `${visibleKeys.length} 位`;

    const selectedStillVisible = visibleKeys.includes(state.selectedPatientKey);
    const nextKey = selectedStillVisible ? state.selectedPatientKey : (visibleKeys[0] || "");

    if (nextKey) {
      selectPatient(nextKey);
    } else {
      patientGroups.forEach(group => group.hidden = true);
      patientNavList?.querySelectorAll(".patient-nav-item").forEach(button => button.classList.remove("active"));
    }
  }

  function buildPatientView() {
    if (!medicationList) return;

    patientGroups.forEach(group => group.remove());
    patientGroups = [];

    ensurePatientNavList();
    if (patientNavList) patientNavList.innerHTML = "";

    const grouped = new Map();
    getRows().forEach(row => {
      const meta = getPatientMeta(row);
      if (!grouped.has(meta.key)) grouped.set(meta.key, { meta, rows: [] });
      grouped.get(meta.key).rows.push(row);
    });

    const patients = [...grouped.values()].sort((a, b) => {
      return a.meta.bed.localeCompare(b.meta.bed, "zh-Hant", { numeric: true }) ||
        a.meta.name.localeCompare(b.meta.name, "zh-Hant");
    });

    patients.forEach(({ meta, rows }, index) => {
      rows.sort((a, b) => getTimeRank(a.dataset.time) - getTimeRank(b.dataset.time));

      const group = document.createElement("section");
      group.className = "patient-section expanded";
      group.dataset.patientKey = meta.key;
      group.id = `patient-group-${index}`;

      group.innerHTML = `
        <header class="patient-header" aria-label="${meta.name} 給藥內容">
          <span class="patient-group-bed">${meta.bed}${meta.bedExtra ? `<small>${meta.bedExtra}</small>` : ""}</span>
          <span class="patient-group-heading">
            <strong>${meta.name}</strong>
            <small>${meta.gender}${meta.gender && meta.age ? " · " : ""}${meta.age}${meta.mrn ? ` · ${meta.mrn}` : ""}</small>
          </span>
          <span class="patient-group-summary"></span>
        </header>
        <div class="patient-body"></div>
      `;

      const body = group.querySelector(".patient-body");
      const byTime = new Map();
      rows.forEach(row => {
        const time = row.dataset.time || "--";
        if (!byTime.has(time)) byTime.set(time, []);
        byTime.get(time).push(row);
      });

      [...byTime.entries()]
        .sort((a, b) => getTimeRank(a[0]) - getTimeRank(b[0]))
        .forEach(([time, timeRows]) => {
          const timeSection = document.createElement("section");
          timeSection.className = `patient-time-section${time === "stat" ? " stat" : ""}`;
          timeSection.dataset.patientTime = time;
          timeSection.innerHTML = `
            <div class="patient-time-header">
              <i class="patient-time-dot" aria-hidden="true"></i>
              <span class="patient-time-title">
                <strong>${getPatientTimeLabel(time)}</strong>
                <small>${timeRows.length} 筆給藥</small>
              </span>
              <span class="patient-time-status"></span>
            </div>
            <div class="patient-time-body"></div>
          `;

          const timeBody = timeSection.querySelector(".patient-time-body");
          timeRows.forEach(row => timeBody.appendChild(row));
          body?.appendChild(timeSection);
        });

      medicationList.appendChild(group);
      patientGroups.push(group);

      if (patientNavList) {
        const pending = rows.filter(row => row.dataset.status === "pending").length;
        const nav = document.createElement("button");
        nav.className = "patient-nav-item";
        nav.type = "button";
        nav.dataset.patientTarget = meta.key;
        nav.dataset.targetId = group.id;
        nav.innerHTML = `
          <span>
            <b>${meta.bed}${meta.bedExtra ? ` ${meta.bedExtra}` : ""}</b>
            <small>${meta.name}</small>
          </span>
          <em>${pending ? `${pending} 待給藥` : "已完成"}</em>
        `;
        patientNavList.appendChild(nav);
      }
    });

    updatePatientGroups();
  }

  function updatePatientGroups() {
    patientGroups.forEach(group => {
      const rows = [...group.querySelectorAll(".med-row")];
      const pending = rows.filter(row => row.dataset.status === "pending").length;
      const stat = rows.filter(row => row.dataset.status === "pending" && row.dataset.stat === "true").length;
      const summary = group.querySelector(".patient-group-summary");

      group.classList.toggle("completed", rows.length > 0 && pending === 0);
      if (summary) {
        summary.classList.toggle("done", pending === 0);
        summary.classList.toggle("stat", stat > 0);
        if (pending === 0) summary.textContent = "今日已完成";
        else if (stat > 0) summary.textContent = `${stat} STAT · ${pending} 待給藥`;
        else summary.textContent = `${pending} 待給藥`;
      }

      group.querySelectorAll(".patient-time-section").forEach(timeSection => {
        const timeRows = [...timeSection.querySelectorAll(".med-row")];
        const timePending = timeRows.filter(row => row.dataset.status === "pending").length;
        const timeStat = timeRows.some(row => row.dataset.status === "pending" && row.dataset.stat === "true");
        const status = timeSection.querySelector(".patient-time-status");
        timeSection.classList.toggle("completed", timeRows.length > 0 && timePending === 0);
        if (status) {
          status.classList.toggle("done", timePending === 0);
          status.classList.toggle("stat", timeStat);
          status.textContent = timePending === 0 ? "已完成" : (timeStat ? "STAT" : `${timePending} 待給藥`);
        }
      });

      const navButton = [...(patientNavList?.querySelectorAll(".patient-nav-item") || [])]
        .find(button => button.dataset.patientTarget === group.dataset.patientKey);
      const navBadge = navButton?.querySelector("em");
      if (navBadge) navBadge.textContent = pending ? `${pending} 待給藥` : "已完成";
      navButton?.classList.toggle("completed", pending === 0);
    });
  }

  function restoreTimelineRows() {
    sections.forEach(section => {
      const body = section.querySelector(".time-body");
      if (!body) return;
      getRows()
        .filter(row => rowOrigins.get(row)?.body === body)
        .sort((a, b) => rowOrigins.get(a).index - rowOrigins.get(b).index)
        .forEach(row => body.appendChild(row));
    });
    clearPatientTimeChips();
  }

  function showPatientMode() {
    state.sort = "person";
    buildPatientView();
    sections.forEach(section => section.hidden = true);

    if (timelinePanel) timelinePanel.hidden = false;
    if (contentGrid) {
      contentGrid.classList.remove("person-mode");
      contentGrid.classList.add("patient-mode");
    }
    if (timeList) timeList.hidden = true;
    if (patientNavList) patientNavList.hidden = false;
    if (timelinePanel) timelinePanel.classList.add("patient-nav-mode");
    if (timelineTitle) timelineTitle.textContent = "病人導覽";
    if (timelineMeta) timelineMeta.textContent = `${patientGroups.length} 位`;

    applyFilters();
  }

  function showTimelineMode() {
    state.sort = "timeline";
    restoreTimelineRows();
    patientGroups.forEach(group => group.remove());
    patientGroups = [];

    if (patientNavList) patientNavList.hidden = true;
    if (timelinePanel) {
      timelinePanel.hidden = false;
      timelinePanel.classList.remove("patient-nav-mode");
    }
    if (contentGrid) {
      contentGrid.classList.remove("person-mode", "patient-mode");
    }
    if (timeList) timeList.hidden = false;
    if (timelineTitle) timelineTitle.textContent = "時段導覽";
    if (timelineMeta) timelineMeta.textContent = "今日";

    sections
      .slice()
      .sort((a, b) => getTimeRank(a.dataset.sectionTime) - getTimeRank(b.dataset.sectionTime))
      .forEach(section => medicationList?.appendChild(section));

    updateSectionBadges();
    applyFilters();
  }

  function getRowDetails(row) {
    const patient = row.querySelector(".patient-info");
    const patientName = patient?.querySelector("b")?.childNodes?.[0]?.textContent?.trim() || "--";
    const gender = patient?.querySelector("em")?.textContent?.trim() || "--";
    const age = patient?.querySelector("b span")?.textContent?.trim() || "--";
    const mrn = patient?.querySelector("small")?.textContent?.trim() || "--";
    const bedMain = row.querySelector(".bed-badge")?.childNodes?.[0]?.textContent?.trim() || "--";
    const bedExtra = row.querySelector(".bed-badge small")?.textContent?.trim() || "";
    const drug = row.querySelector(".drug-info b")?.textContent?.trim() || "--";
    const route = row.querySelector(".drug-info small")?.textContent?.trim() || "--";
    const time = row.dataset.time === "stat" ? "立即給藥（STAT）" : (row.dataset.time || "--");
    const isDone = row.dataset.status === "done";
    const isStat = row.dataset.stat === "true" && !isDone;
    const statusText = row.querySelector(".state-pill")?.textContent?.trim() || (isDone ? "已完成" : "待給藥");

    return {
      patientName,
      gender,
      age,
      mrn,
      bed: `${bedMain}${bedExtra ? ` ${bedExtra}` : ""}`,
      drug,
      route,
      time,
      statusText,
      statusClass: isDone ? "done" : (isStat ? "stat" : "pending")
    };
  }

  function openMedicationDrawer(row) {
    if (!drawer || !drawerBackdrop || !row) return;

    const details = getRowDetails(row);
    const fields = {
      drawerBed: details.bed,
      drawerPatientName: details.patientName,
      drawerGender: details.gender,
      drawerAge: details.age,
      drawerMrn: details.mrn,
      drawerDrug: details.drug,
      drawerRoute: details.route,
      drawerTime: details.time,
      drawerStatus: details.statusText
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    const status = document.querySelector("#drawerStatus");
    if (status) {
      status.classList.remove("done", "stat");
      if (details.statusClass === "done") status.classList.add("done");
      if (details.statusClass === "stat") status.classList.add("stat");
    }

    drawerBackdrop.hidden = false;
    requestAnimationFrame(() => {
      drawerBackdrop.classList.add("show");
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.classList.add("drawer-open");
      drawerClose?.focus();
    });
  }

  function closeMedicationDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawer.classList.remove("open");
    drawerBackdrop.classList.remove("show");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    setTimeout(() => {
      if (!drawerBackdrop.classList.contains("show")) drawerBackdrop.hidden = true;
    }, 230);
  }

  function completeMedication(row, button) {
    if (!row || !button || row.dataset.status === "done") return;

    const wasStat = row.dataset.stat === "true";

    row.dataset.status = "done";
    row.classList.remove("pending", "stat-med-row");
    row.classList.add("done");

    const statusRound = row.querySelector(".status-round");
    if (statusRound) statusRound.textContent = "✓";

    button.classList.remove("pending-pill", "stat-pill");
    button.classList.add("done-pill");
    button.textContent = `已完成 ${getCurrentTime()}`;

    updateProgressUI();
    updateSectionBadges();
    updatePatientGroups();
    applyFilters();
    showToast(wasStat ? "STAT 給藥已完成" : "給藥已完成");
  }

  if (searchInput) {
    searchInput.addEventListener("input", e => {
      state.search = normalize(e.target.value);
      applyFilters();
    });

    searchInput.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        searchInput.value = "";
        state.search = "";
        applyFilters();
        searchInput.blur();
      }
    });
  }

  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => setFilter(tab.dataset.filter || "all"));
  });

  sections.forEach(section => {
    const header = section.querySelector(".time-header");
    if (!header) return;
    header.addEventListener("click", () => {
      setSectionExpanded(section, !section.classList.contains("expanded"));
    });
  });

  timeItems.forEach(item => {
    item.addEventListener("click", () => {
      if (state.sort !== "timeline") return;

      timeItems.forEach(btn => btn.classList.remove("active"));
      item.classList.add("active");

      const time = item.dataset.time;
      const target = document.querySelector(`.time-section[data-section-time="${CSS.escape(time)}"]`);
      if (!target) return;

      if (time === "stat") setFilter("stat");
      else if (state.filter === "stat") setFilter("all");

      target.hidden = false;
      setSectionExpanded(target, true);
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  });

  sortButtons.forEach(button => {
    button.addEventListener("click", () => {
      const nextSort = button.dataset.sort || "timeline";
      if (nextSort === state.sort) return;

      sortButtons.forEach(btn => btn.classList.toggle("active", btn === button));

      if (nextSort === "person") {
        showPatientMode();
        showToast("已切換為依病人檢視");
      } else {
        showTimelineMode();
        showToast("已切換為依時間軸檢視");
      }
    });
  });

  if (timelinePanel) {
    timelinePanel.addEventListener("click", e => {
      const patientNav = e.target.closest(".patient-nav-item");
      if (!patientNav || state.sort !== "person" || patientNav.hidden) return;
      selectPatient(patientNav.dataset.patientTarget || "", { scroll: false });
    });
  }

  if (medicationList) {
    medicationList.addEventListener("click", e => {
      const pendingButton = e.target.closest(".pending-pill");
      if (pendingButton) {
        e.stopPropagation();
        completeMedication(pendingButton.closest(".med-row"), pendingButton);
        return;
      }

      const doneButton = e.target.closest(".done-pill");
      if (doneButton) {
        e.stopPropagation();
        showToast("此筆給藥已完成");
        return;
      }

      const row = e.target.closest(".med-row");
      if (row) openMedicationDrawer(row);
    });

    medicationList.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest("button")) return;
      const row = e.target.closest(".med-row");
      if (!row) return;
      e.preventDefault();
      openMedicationDrawer(row);
    });
  }

  getRows().forEach(row => {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `${row.querySelector(".patient-info b")?.textContent?.trim() || "病人"} 給藥詳情`);
  });

  drawerClose?.addEventListener("click", closeMedicationDrawer);
  drawerBackdrop?.addEventListener("click", closeMedicationDrawer);

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      if (!button.classList.contains("active")) {
        showToast(`${button.querySelector("b")?.textContent || "功能"}：目前為介面示意`);
      }
    });
  });

  document.querySelector(".logout")?.addEventListener("click", () => showToast("登出功能為介面示意"));
  document.querySelector(".profile-btn")?.addEventListener("click", () => showToast("XXX 護理師"));
  document.querySelector(".icon-btn")?.addEventListener("click", () => showToast("設定功能為介面示意"));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && drawer?.classList.contains("open")) {
      closeMedicationDrawer();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });

  sections.forEach(section => setSectionExpanded(section, section.classList.contains("expanded")));
  updateProgressUI();
  updateSectionBadges();
  applyFilters();
})();

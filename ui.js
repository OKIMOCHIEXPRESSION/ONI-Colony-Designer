// ============================================================
// ui.js — DOM operations, event binding, panel updates
//
// Depends: i18n.js, data.js, store.js, renderer.js
// Language: English-first via I18n.t(). Call I18n.applyDOM()
//           plus _refreshDynamic() to switch at runtime.
// ============================================================

const UI = (() => {

  const collapsedBuildingGroups = new Set();

  // ── Building name helper ──────────────────────────────────
  function _buildingName(b) {
    return I18n.getLang() === "en"
      ? (b.name_en || b.name_ja || b.id)
      : (b.name_ja  || b.name_en || b.id);
  }

  // ── Layer name helper ─────────────────────────────────────
  function _layerName(lk) {
    const def = LAYERS[lk];
    if (!def) return lk;
    return I18n.getLang() === "en"
      ? (def.name_en || def.name_ja || lk)
      : (def.name_ja  || def.name_en || lk);
  }

  // ── Room type name helper ─────────────────────────────────
  function _roomTypeName(type) {
    return I18n.getLang() === "en"
      ? (type.name_en || type.name_ja || type.id)
      : (type.name_ja  || type.name_en || type.id);
  }

  // ── Icon abbreviation ─────────────────────────────────────
  function _iconLabel(b) {
    const words = (b.name_en || b.id || "")
      .split(/\s+|_/)
      .filter(Boolean);
    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  }

  // ── Language switch ───────────────────────────────────────
  function setLang(lang) {
    I18n.setLang(lang);       // persists to localStorage, calls applyDOM()
    _refreshDynamic();        // rebuild JS-generated DOM
  }

  /**
   * Refresh all JS-generated text that isn't covered by data-i18n attributes.
   * Called after every language switch.
   */
  function _refreshDynamic() {
    // Active layer label
    const activeLayer = Store.getState().activeLayer;
    const lbl = document.getElementById("active-layer-label");
    if (lbl) lbl.textContent = I18n.t("infobar.editing") + _layerName(activeLayer);

    // Building names in sidebar
    document.querySelectorAll(".cat-label[data-cat]").forEach(el => {
      el.textContent = el.getAttribute("data-cat");   // always EN category key
    });
    document.querySelectorAll(".building-btn").forEach(btn => {
      const b = btn._buildingData;
      if (!b) return;
      const nameEl = btn.querySelector(".b-name");
      if (nameEl) nameEl.textContent = _buildingName(b);
    });

    // Selected building label
    const sel = Store.getState().selectedBuilding;
    const selLbl = document.getElementById("selected-label");
    if (selLbl && sel) {
      selLbl.textContent = `${_buildingName(sel)} (${sel.w}×${sel.h})`;
    }

    // Building count suffix
    _refreshCountLabel();

    // Room panel (re-render with new strings)
    const { detectedRooms } = Store.getState();
    if (detectedRooms) updateRoomPanel(detectedRooms);
  }

  // ── Undo/Redo button state ────────────────────────────────
  function updateUndoButtons() {
    const canUndo = Store.canUndo();
    const canRedo = Store.canRedo();
    ["btn-undo","btn-undo-m"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !canUndo;
    });
    ["btn-redo","btn-redo-m"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !canRedo;
    });
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent   = msg;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 2000);
  }

  // ── Zoom label ────────────────────────────────────────────
  function updateZoomLabel() {
    const { zoom } = Store.getState();
    document.getElementById("zoom-label").textContent = Math.round(zoom * 100) + "%";
  }

  // ── Tool switch ───────────────────────────────────────────
  function setTool(t) {
    Store.setState({ tool: t });
    document.querySelectorAll(".tool-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(`#tool-${t}, #tool-${t}-m`).forEach(el => el.classList.add("active"));

    // Switching tools always cancels an in-progress rectangle selection.
    const { selection, areaClipboard } = Store.getState();
    if (selection.active) Store.setState({ selection: { ...selection, active: false } });

    if (t === "copy") {
      // Re-entering Copy Tool reactivates paste mode if a clipboard already
      // exists (spec v1.4 "Re-entering Paste Mode"), so the user can paste
      // again without redrawing a selection. No clipboard yet → leave paste
      // mode off; the next drag on the canvas will start a fresh selection.
      Store.setState({ pasteMode: Boolean(areaClipboard) });
    } else {
      Store.setState({ pasteMode: false });
    }

    if (typeof Input !== "undefined") Input.refreshCursor();
    if (typeof Renderer !== "undefined") Renderer.draw();
  }

  // ── Layer switch ──────────────────────────────────────────
  function switchLayer(lk) {
    Store.setState({ activeLayer: lk });
    document.querySelectorAll(".layer-tab")
      .forEach(t => t.classList.toggle("active", t.dataset.layer === lk));
    const lbl = document.getElementById("active-layer-label");
    if (lbl) lbl.textContent = I18n.t("infobar.editing") + _layerName(lk);
    buildSidebar(lk);
    Renderer.draw();
  }

  // ── Right panel tab switch ────────────────────────────────
  function switchRightTab(tab) {
    document.getElementById("panel-stats").style.display = tab === "stats" ? "" : "none";
    document.getElementById("panel-rooms").style.display = tab === "rooms" ? "" : "none";
    document.getElementById("tab-stats").classList.toggle("active", tab === "stats");
    document.getElementById("tab-rooms").classList.toggle("active", tab === "rooms");
  }

  // ── Building count label ──────────────────────────────────
  function _refreshCountLabel() {
    const el = document.getElementById("count-label");
    if (!el) return;
    const countText = el.getAttribute("data-count") || "0";
    el.textContent = countText + I18n.t("infobar.buildings");
  }

  // ── Stats panel ───────────────────────────────────────────
  function updateStats() {
    let power = 0, gen = 0, oxygen = 0, food = 0, water = 0, total = 0;

    for (const lk of LAYER_ORDER) {
      for (const b of Object.values(Store.getLayerGrid(lk))) {
        if (b.ref || b.fixed) continue;
        total++;
        if (b.power < 0) power += Math.abs(b.power); else gen += b.power;
        oxygen += (b.oxygen || 0);
        food   += (b.food   || 0);
        if ((b.water || 0) < 0) water += Math.abs(b.water);
      }
    }

    document.getElementById("stat-power").textContent   = power + " W";
    document.getElementById("stat-gen").textContent     = gen + " W";
    document.getElementById("stat-gen").className       = gen >= power ? "stat-ok" : "stat-warn";
    document.getElementById("stat-oxygen").textContent  = oxygen + " g/s";
    document.getElementById("stat-food").textContent    = food + " kcal";
    document.getElementById("stat-water").textContent   = water.toFixed(2) + " kg/s";

    const bal  = gen - power;
    const balEl = document.getElementById("stat-balance");
    balEl.textContent = (bal >= 0 ? "+" : "") + bal + " W";
    balEl.className   = "stat-val " + (bal >= 0 ? "stat-ok" : "stat-warn");

    // Building count
    const countEl = document.getElementById("count-label");
    if (countEl) {
      countEl.setAttribute("data-count", total);
      countEl.textContent = total + I18n.t("infobar.buildings");
    }

    // Layer tab badges
    for (const lk of LAYER_ORDER) {
      const cnt = Object.values(Store.getLayerGrid(lk)).filter(b => !b.ref && !b.fixed).length;
      const el  = document.getElementById("cnt-" + lk);
      if (el) el.textContent = cnt;
    }
  }

  // ── Rooms panel ───────────────────────────────────────────
  function updateRoomPanel(detectedRooms) {
    const list = document.getElementById("room-list");

    if (!detectedRooms || detectedRooms.length === 0) {
      list.innerHTML = `<div id="no-rooms" data-i18n-html="room.no_rooms">${I18n.t("room.no_rooms")}</div>`;
      return;
    }

    list.innerHTML = "";

    detectedRooms.forEach((room, idx) => {
      const valid   = room.classifications.filter(c => c.status === "valid");
      const partial = room.classifications.filter(c =>
        c.status === "missing_required" || c.status === "size_small" || c.status === "size_large"
      );

      const card = document.createElement("div");
      card.className = "room-card " + (valid.length > 0 ? "room-ok" : partial.length > 0 ? "room-warn" : "room-invalid");

      const typeNames = valid.length > 0
        ? valid.map(c => _roomTypeName(c.type)).join(" / ")
        : I18n.t("room.unknown");

      let html = `<div class="room-card-header">
        <span class="room-type-name">${typeNames}</span>
        <span class="room-size">${room.size}${I18n.t("room.tiles")}</span>
      </div>`;

      if (valid.length > 0) {
        html += `<div class="room-status room-ok">${I18n.t("room.valid")}</div>`;
      } else if (partial.length > 0) {
        html += `<div class="room-detail">${partial[0].reason}</div>`;
      }

      card.innerHTML = html;

      card.addEventListener("mouseenter", () => {
        Store.setState({ highlightedRoom: idx });
        Renderer.draw();
      });
      card.addEventListener("mouseleave", () => {
        Store.setState({ highlightedRoom: null });
        Renderer.draw();
      });
      card.addEventListener("click", () => {
        const cur = Store.getState().highlightedRoom;
        Store.setState({ highlightedRoom: cur === idx ? null : idx });
        Renderer.draw();
      });

      list.appendChild(card);
    });
  }

  // ── Sidebar build ─────────────────────────────────────────
  function buildSidebar(filterLayer) {
    const catEl    = document.getElementById("categories");
    const catElM   = document.getElementById("categories-m");
    const legendEl = document.getElementById("legend-items");
    catEl.innerHTML    = "";
    if (catElM) catElM.innerHTML = "";
    legendEl.innerHTML = "";

    for (const [cat, def] of Object.entries(BUILDINGS)) {
      if (filterLayer !== "all" && def.layer !== filterLayer) continue;

      // Category label — always the English category key (same as used in data.js)
      const label = document.createElement("div");
      label.className = "cat-label";
      label.setAttribute("data-cat", cat);
      label.textContent = cat;
      catEl.appendChild(label);

      function createBuildingButton(b) {
        const btn = document.createElement("button");
        btn.className = "building-btn";
        const lc = LAYERS[def.layer].color;
        btn.innerHTML = [
          `<span class="b-icon" title="${b.icon}" style="background:${b.color}22;color:${b.color}">${_iconLabel(b)}</span>`,
          `<span class="b-name">${_buildingName(b)}</span>`,
          `<span class="b-layer-dot" style="background:${lc}"></span>`,
          `<span class="b-size">${b.w}×${b.h}</span>`,
        ].join("");

        btn._buildingData = { ...b, layer: def.layer };
        btn.addEventListener("click", () => {
          document.querySelectorAll(".building-btn").forEach(x => x.classList.remove("selected"));
          btn.classList.add("selected");
          Store.setState({ selectedBuilding: { ...b, layer: def.layer } });
          switchLayer(def.layer);
          const lbl = document.getElementById("selected-label");
          if (lbl) lbl.textContent = `${_buildingName(b)} (${b.w}×${b.h})`;
          setTool("place");
        });

        return btn;
      }

      const groupedItems = new Map();
      for (const b of def.items) {
        if (!b.group) continue;
        if (!groupedItems.has(b.group)) groupedItems.set(b.group, []);
        groupedItems.get(b.group).push(b);
      }

      if (groupedItems.size === 0) {
        for (const b of def.items) catEl.appendChild(createBuildingButton(b));
      } else {
        // Keep ungrouped definitions usable in a partially grouped category.
        for (const b of def.items) {
          if (!b.group) catEl.appendChild(createBuildingButton(b));
        }

        for (const [groupName, items] of groupedItems) {
          const groupKey = JSON.stringify([cat, groupName]);
          const group = document.createElement("div");
          group.className = "building-group";
          group.dataset.groupKey = groupKey;

          const header = document.createElement("button");
          header.type = "button";
          header.className = "building-group-header";
          header.dataset.groupKey = groupKey;
          header.setAttribute("aria-expanded", "true");

          const chevron = document.createElement("span");
          chevron.className = "building-group-chevron";
          chevron.setAttribute("aria-hidden", "true");
          const title = document.createElement("span");
          title.className = "building-group-title";
          title.textContent = groupName;
          header.append(chevron, title);

          const contents = document.createElement("div");
          contents.className = "building-group-items";
          for (const b of items) contents.appendChild(createBuildingButton(b));

          header.addEventListener("click", () => toggleBuildingGroup(groupKey));
          group.append(header, contents);
          catEl.appendChild(group);
        }
      }

      const li = document.createElement("div");
      li.className = "legend-item";
      li.innerHTML = `<div class="legend-dot" style="background:${CAT_COLORS[cat] || '#666'}"></div><span>${cat}</span>`;
      legendEl.appendChild(li);
    }

    // Mirror to mobile drawer
    if (catElM) catElM.innerHTML = catEl.innerHTML;

    // Re-attach mobile events (since we cloned HTML)
    if (catElM) {
      catElM.querySelectorAll(".building-btn").forEach((btn, i) => {
        const src = catEl.querySelectorAll(".building-btn")[i];
        if (!src) return;
        btn._buildingData = src._buildingData;
        btn.addEventListener("click", () => {
          if (src._buildingData) src.click();
          document.getElementById("palette-drawer")?.classList.remove("open");
          document.getElementById("palette-toggle")?.classList.remove("active");
        });
      });
      catElM.querySelectorAll(".building-group-header").forEach(header => {
        header.addEventListener("click", () => toggleBuildingGroup(header.dataset.groupKey));
      });
    }

    syncBuildingGroups();
  }

  function toggleBuildingGroup(groupKey) {
    if (collapsedBuildingGroups.has(groupKey)) collapsedBuildingGroups.delete(groupKey);
    else collapsedBuildingGroups.add(groupKey);
    syncBuildingGroups();
  }

  function syncBuildingGroups() {
    document.querySelectorAll(".building-group").forEach(group => {
      const collapsed = collapsedBuildingGroups.has(group.dataset.groupKey);
      group.classList.toggle("collapsed", collapsed);
      const header = group.querySelector(":scope > .building-group-header");
      if (header) header.setAttribute("aria-expanded", String(!collapsed));
    });
  }

  // ── Search filter ─────────────────────────────────────────
  function filterSidebar(query) {
    const q = query.trim().toLowerCase();
    document.querySelectorAll(".building-btn").forEach(btn => {
      const b = btn._buildingData;
      const nameEN = (b?.name_en || "").toLowerCase();
      const nameJA = (b?.name_ja || "").toLowerCase();
      btn.style.display = (nameEN.includes(q) || nameJA.includes(q)) ? "" : "none";
    });
    document.querySelectorAll(".building-group").forEach(group => {
      const any = Array.from(group.querySelectorAll(".building-btn"))
        .some(btn => btn.style.display !== "none");
      group.style.display = any ? "" : "none";
      group.classList.toggle("search-match", Boolean(q) && any);
    });
    document.querySelectorAll(".cat-label").forEach(label => {
      let el = label.nextElementSibling, any = false;
      while (el && !el.classList.contains("cat-label")) {
        if (el.classList.contains("building-btn") && el.style.display !== "none") any = true;
        if (el.classList.contains("building-group") && el.style.display !== "none") any = true;
        el = el.nextElementSibling;
      }
      label.style.display = any ? "" : "none";
    });
  }

  // ── Context menu ──────────────────────────────────────────
  function showContextMenu(x, y, col, row, layerKey) {
    Store.setState({ rightClick: { col, row, layer: layerKey } });
    const menu = document.getElementById("context-menu");
    menu.style.display = "block";
    menu.style.left    = x + "px";
    menu.style.top     = y + "px";
  }

  function hideContextMenu() {
    document.getElementById("context-menu").style.display = "none";
  }

  // ── Language button bootstrap ─────────────────────────────
  // Runs immediately when the module is evaluated (after DOM ready via app.js).
  (() => {
    const langBtn = document.getElementById("btn-lang");
    if (langBtn) {
      // Apply initial language (English by default, from I18n)
      I18n.applyDOM();
      langBtn.addEventListener("click", () => {
        const next = I18n.getLang() === "en" ? "ja" : "en";
        setLang(next);
      });
    }
  })();

  // ── Public API ────────────────────────────────────────────
  return {
    updateUndoButtons,
    showToast,
    updateZoomLabel,
    setTool,
    switchLayer,
    switchRightTab,
    updateStats,
    updateRoomPanel,
    buildSidebar,
    filterSidebar,
    showContextMenu,
    hideContextMenu,
  };

})();

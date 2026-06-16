// ============================================================
// ui.js — DOM 操作・イベントバインド・パネル更新
//
// 依存: data.js, store.js, renderer.js
// ============================================================

const UI = (() => {

  // ── Undo/Redo ボタン状態更新 ─────────────────────────────────
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

  // ── トースト ──────────────────────────────────────────────
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent  = msg;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 2000);
  }

  // ── ズーム ───────────────────────────────────────────────
  function updateZoomLabel() {
    const { zoom } = Store.getState();
    document.getElementById("zoom-label").textContent = Math.round(zoom * 100) + "%";
  }

  // ── ツール切り替え ────────────────────────────────────────
  function setTool(t) {
    Store.setState({ tool: t });
    // デスクトップ・スマホ両方のツールボタンを更新
    document.querySelectorAll(".tool-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(`#tool-${t}, #tool-${t}-m`).forEach(el => el.classList.add("active"));
    // カーソルは input.js が管理
    if (typeof Input !== "undefined") Input.refreshCursor();
  }

  // ── レイヤー切り替え ─────────────────────────────────────
  function switchLayer(lk) {
    Store.setState({ activeLayer: lk });
    document.querySelectorAll(".layer-tab")
      .forEach(t => t.classList.toggle("active", t.dataset.layer === lk));
    document.getElementById("active-layer-label").textContent = `編集中: ${LAYERS[lk].name}`;
    buildSidebar(lk);
    Renderer.draw();
  }

  // ── 右パネルタブ ─────────────────────────────────────────
  function switchRightTab(tab) {
    document.getElementById("panel-stats").style.display = tab === "stats" ? "" : "none";
    document.getElementById("panel-rooms").style.display = tab === "rooms" ? "" : "none";
    document.getElementById("tab-stats").classList.toggle("active", tab === "stats");
    document.getElementById("tab-rooms").classList.toggle("active", tab === "rooms");
  }

  // ── 統計パネル更新 ────────────────────────────────────────
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

    document.getElementById("count-label").textContent = total + "棟";

    // レイヤータブのカウントバッジ
    for (const lk of LAYER_ORDER) {
      const cnt = Object.values(Store.getLayerGrid(lk)).filter(b => !b.ref && !b.fixed).length;
      const el  = document.getElementById("cnt-" + lk);
      if (el) el.textContent = cnt;
    }
  }

  // ── 部屋パネル更新 ────────────────────────────────────────
  function updateRoomPanel(detectedRooms) {
    const list = document.getElementById("room-list");

    if (detectedRooms.length === 0) {
      list.innerHTML = `<div id="no-rooms">タイルで囲まれた<br>エリアを作ると<br>部屋を検出します</div>`;
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

      let html = `<div class="room-card-header">
        <span class="room-type-name">${valid.length > 0 ? valid.map(c => c.type.name).join(" / ") : "未判定の空間"}</span>
        <span class="room-size">${room.size}マス</span>
      </div>`;

      if (valid.length > 0) {
        html += `<div class="room-status room-ok">✓ 有効な部屋</div>`;
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

  // ── サイドバー構築 ────────────────────────────────────────
  function buildSidebar(filterLayer) {
    const catEl     = document.getElementById("categories");
    const catElM    = document.getElementById("categories-m"); // スマホ用
    const legendEl  = document.getElementById("legend-items");
    catEl.innerHTML    = "";
    if (catElM) catElM.innerHTML = "";
    legendEl.innerHTML = "";

    for (const [cat, def] of Object.entries(BUILDINGS)) {
      if (filterLayer !== "all" && def.layer !== filterLayer) continue;

      for (const target of [catEl, catElM].filter(Boolean)) {
        const label = document.createElement("div");
        label.className   = "cat-label";
        label.textContent = cat;
        target.appendChild(label);

        for (const b of def.items) {
          const btn = document.createElement("button");
          btn.className = "building-btn";
          const lc = LAYERS[def.layer].color;
          btn.innerHTML = [
            `<span class="b-icon" style="background:${b.color}22;color:${b.color}">${b.icon}</span>`,
            `<span>${b.name}</span>`,
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
            if (lbl) lbl.textContent = `${b.name} (${b.w}×${b.h})`;
            setTool("place");
          });

          target.appendChild(btn);
        }
      }

      const li = document.createElement("div");
      li.className = "legend-item";
      li.innerHTML = `<div class="legend-dot" style="background:${CAT_COLORS[cat] || '#666'}"></div><span>${cat}</span>`;
      legendEl.appendChild(li);
    }
  }

  // ── 検索フィルター ────────────────────────────────────────
  function filterSidebar(query) {
    const q = query.toLowerCase();
    document.querySelectorAll(".building-btn").forEach(btn => {
      btn.style.display = btn.textContent.toLowerCase().includes(q) ? "" : "none";
    });
    document.querySelectorAll(".cat-label").forEach(label => {
      let el = label.nextElementSibling, any = false;
      while (el && el.classList.contains("building-btn")) {
        if (el.style.display !== "none") any = true;
        el = el.nextElementSibling;
      }
      label.style.display = any ? "" : "none";
    });
  }

  // ── コンテキストメニュー ──────────────────────────────────
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

  // ── 公開API ──────────────────────────────────────────────
  return { updateUndoButtons,
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

// ============================================================
// app.js — ビジネスロジック + 初期化
//
// 依存ロード順: data.js → store.js → rooms.js → renderer.js → ui.js → input.js
//
// App オブジェクトを公開し、input.js から呼ばれる操作関数を提供する。
// ============================================================

const App = (() => {

  // ── 配置 ────────────────────────────────────────────────

  function placeBuilding(col, row) {
    const { selectedBuilding, activeLayer } = Store.getState();
    if (!selectedBuilding) return;
    if (col < 0 || row < 0
      || col + selectedBuilding.w > GRID_COLS
      || row + selectedBuilding.h > GRID_ROWS) return;

    const grid = Store.getLayerGrid(activeLayer);
    const b    = { ...selectedBuilding };

    for (let dc = 0; dc < b.w; dc++) {
      for (let dr = 0; dr < b.h; dr++) {
        const key    = `${col + dc},${row + dr}`;
        const before = grid[key] ?? null;
        const after  = (dc === 0 && dr === 0)
          ? b
          : { ...b, ref: `${col},${row}` };
        Store.recordCellDiff(key, before, after);
        Store.setCell(activeLayer, key, after);
      }
    }
    _afterEdit();
  }

  function eraseBuilding(col, row) {
    const { activeLayer } = Store.getState();
    const grid   = Store.getLayerGrid(activeLayer);
    const key    = `${col},${row}`;
    const b      = grid[key];
    if (!b) return;
    if (b.fixed) { UI.showToast("製造ポッドは削除できません"); return; }

    const refKey = b.ref || key;
    const main   = grid[refKey];
    if (!main) { delete grid[key]; return; }

    const [rc, rr] = refKey.split(",").map(Number);
    for (let dc = 0; dc < main.w; dc++) {
      for (let dr = 0; dr < main.h; dr++) {
        const k      = `${rc + dc},${rr + dr}`;
        const before = grid[k] ?? null;
        Store.recordCellDiff(k, before, null);
        Store.setCell(activeLayer, k, null);
      }
    }
    _afterEdit();
  }

  function _afterEdit() {
    UI.updateStats();
    const rooms = RoomDetector.detect();
    Store.setState({ detectedRooms: rooms });
    UI.updateRoomPanel(rooms);
    Renderer.draw();
    Input.refreshMinimap();
  }

  // ── 全消去 ──────────────────────────────────────────────

  function clearActiveLayerWithHistory() {
    const { activeLayer } = Store.getState();
    const grid  = Store.getLayerGrid(activeLayer);
    const diffs = [];
    for (const [key, val] of Object.entries(grid)) {
      if (val && val.fixed) continue;
      diffs.push({ key, layer: activeLayer, before: val, after: null });
    }
    Store.clearActiveLayer();
    if (activeLayer === "base") {
      for (const [key, val] of Object.entries(Store.getLayerGrid("base"))) {
        diffs.push({ key, layer: activeLayer, before: null, after: val });
      }
    }
    Store.pushCommand("全消去", activeLayer, diffs);
    UI.updateUndoButtons();
    _afterEdit();
  }

  // ── ロード ──────────────────────────────────────────────

  function loadColony(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data  = JSON.parse(ev.target.result);
        const diffs = [];
        for (const lk of LAYER_ORDER) {
          for (const [key, val] of Object.entries(Store.getLayerGrid(lk))) {
            diffs.push({ key, layer: lk, before: val, after: null });
          }
        }
        Store.deserialize(data);
        for (const lk of LAYER_ORDER) {
          for (const [key, val] of Object.entries(Store.getLayerGrid(lk))) {
            diffs.push({ key, layer: lk, before: null, after: val });
          }
        }
        Store.pushCommand("ファイル読込", "multi", diffs);
        UI.updateUndoButtons();
        _afterEdit();
        UI.showToast("読み込みました");
      } catch {
        UI.showToast("読み込みエラー");
      }
    };
    reader.readAsText(file);
  }

  // ── Undo / Redo ─────────────────────────────────────────

  function performUndo() {
    if (!Store.canUndo()) return;
    Store.commitStroke();
    const info = Store.getHistoryInfo();
    Store.undo();
    UI.updateUndoButtons();
    _afterEdit();
    UI.showToast(`Undo: ${info.lastLabel}`);
  }

  function performRedo() {
    if (!Store.canRedo()) return;
    const info = Store.getHistoryInfo();
    Store.redo();
    UI.updateUndoButtons();
    _afterEdit();
    UI.showToast(`Redo: ${info.nextLabel}`);
  }

  // ── ズーム ──────────────────────────────────────────────

  function applyZoom(newZoom, pivotX, pivotY) {
    const { zoom, panX, panY } = Store.getState();
    const clamped = Math.max(0.15, Math.min(6, newZoom));
    Store.setState({
      zoom: clamped,
      panX: pivotX - (pivotX - panX) * (clamped / zoom),
      panY: pivotY - (pivotY - panY) * (clamped / zoom),
    });
    UI.updateZoomLabel();
    Renderer.draw();
    Input.refreshMinimap();
  }

  /** グリッド全体がビューに収まるようにズーム/パンを調整（Fキー） */
  function fitView() {
    if (!_canvas) return;
    const margin  = 40;
    const scaleX  = (_canvas.width  - margin * 2) / (GRID_COLS * CELL_SIZE);
    const scaleY  = (_canvas.height - margin * 2) / (GRID_ROWS * CELL_SIZE);
    const zoom    = Math.min(scaleX, scaleY);
    const gridW   = GRID_COLS * CELL_SIZE * zoom;
    const gridH   = GRID_ROWS * CELL_SIZE * zoom;
    const panX    = (_canvas.width  - gridW) / 2;
    const panY    = (_canvas.height - gridH) / 2;
    Store.setState({ zoom, panX, panY });
    UI.updateZoomLabel();
    Renderer.draw();
    Input.refreshMinimap();
  }

  // ── 保存 ────────────────────────────────────────────────

  function saveColony() {
    const data = JSON.stringify(Store.serialize(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "oni-colony.json";
    a.click();
    UI.showToast("保存しました");
  }

  // ── UI イベント ──────────────────────────────────────────

  function _setupUIEvents() {
    // ツールボタン
    document.getElementById("tool-place").addEventListener("click", () => UI.setTool("place"));
    document.getElementById("tool-erase").addEventListener("click", () => UI.setTool("erase"));

    // Undo/Redo ボタン
    document.getElementById("btn-undo").addEventListener("click", performUndo);
    document.getElementById("btn-redo").addEventListener("click", performRedo);

    // 全消去
    document.getElementById("btn-clear").addEventListener("click", () => {
      if (!confirm("現在のレイヤーの建物を全て削除しますか？")) return;
      clearActiveLayerWithHistory();
    });

    // ズームボタン
    document.getElementById("btn-zoom-in").addEventListener("click", () => {
      applyZoom(Store.getState().zoom * 1.25, _canvas.width / 2, _canvas.height / 2);
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
      applyZoom(Store.getState().zoom / 1.25, _canvas.width / 2, _canvas.height / 2);
    });
    document.getElementById("btn-zoom-reset").addEventListener("click", fitView);

    // 保存・読込
    document.getElementById("btn-save").addEventListener("click", saveColony);
    document.getElementById("btn-load").addEventListener("click",
      () => document.getElementById("load-input").click()
    );
    document.getElementById("load-input").addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) loadColony(file);
      e.target.value = "";
    });

    // レイヤータブ
    document.querySelectorAll(".layer-tab").forEach(tab =>
      tab.addEventListener("click", () => UI.switchLayer(tab.dataset.layer))
    );

    // 可視トグルボタン
    ["plumbing","gas","electrical","automation"].forEach(lk => {
      const btn = document.getElementById("vis-" + lk);
      if (!btn) return;
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        const { layerVisible } = Store.getState();
        const next = { ...layerVisible, [lk]: !layerVisible[lk] };
        Store.setState({ layerVisible: next });
        btn.classList.toggle("on", next[lk]);
        Renderer.draw();
        Input.refreshMinimap();
      });
    });

    // 右パネルタブ
    document.querySelectorAll(".right-tab").forEach(tab =>
      tab.addEventListener("click", () => UI.switchRightTab(tab.dataset.panel))
    );

    // コンテキストメニュー
    document.addEventListener("click", UI.hideContextMenu);

    document.getElementById("ctx-delete").addEventListener("click", () => {
      const { rightClick } = Store.getState();
      if (rightClick.col < 0) return;
      const prevLayer = Store.getState().activeLayer;
      Store.setState({ activeLayer: rightClick.layer });
      Store.beginStroke(rightClick.layer, "消去");
      eraseBuilding(rightClick.col, rightClick.row);
      Store.commitStroke();
      UI.updateUndoButtons();
      Store.setState({ activeLayer: prevLayer, rightClick: { col: -1, row: -1, layer: null } });
    });

    document.getElementById("ctx-copy").addEventListener("click", () => {
      const { rightClick } = Store.getState();
      if (rightClick.col < 0) return;
      const grid = Store.getLayerGrid(rightClick.layer);
      const key  = `${rightClick.col},${rightClick.row}`;
      const b    = grid[key];
      if (!b) return;
      const main = b.ref ? grid[b.ref] : b;
      Store.setState({ clipboard: main });
      UI.showToast("コピー: " + main.name);
    });

    // スマホ: ボトムバーのツールボタン
    document.getElementById("tool-place-m")?.addEventListener("click", () => UI.setTool("place"));
    document.getElementById("tool-erase-m")?.addEventListener("click", () => UI.setTool("erase"));
    document.getElementById("btn-undo-m")?.addEventListener("click", performUndo);
    document.getElementById("btn-redo-m")?.addEventListener("click", performRedo);
    document.getElementById("btn-zoom-reset-m")?.addEventListener("click", fitView);

    // スマホ: パレットドロワーの閉じるボタン
    document.getElementById("palette-close")?.addEventListener("click", () => {
      document.getElementById("palette-drawer")?.classList.remove("open");
      document.getElementById("palette-toggle")?.classList.remove("active");
    });

    // スマホ: 検索ボックス (drawer内)
    document.getElementById("search-box-m")?.addEventListener("input", e =>
      UI.filterSidebar(e.target.value)
    );

    // 検索
    document.getElementById("search-box").addEventListener("input", e =>
      UI.filterSidebar(e.target.value)
    );

    // スマホ: ボトムバーの建物パレット開閉
    const paletteToggle = document.getElementById("palette-toggle");
    const paletteDrawer = document.getElementById("palette-drawer");
    if (paletteToggle && paletteDrawer) {
      paletteToggle.addEventListener("click", () => {
        paletteDrawer.classList.toggle("open");
        paletteToggle.classList.toggle("active");
      });
      // パレット外タップで閉じる
      document.getElementById("main-canvas")?.addEventListener("pointerdown", () => {
        paletteDrawer.classList.remove("open");
        paletteToggle.classList.remove("active");
      });
    }
  }

  // ── 起動 ────────────────────────────────────────────────

  let _canvas = null;

  function init() {
    _canvas = document.getElementById("main-canvas");

    Renderer.init(_canvas);
    new ResizeObserver(() => {
      Renderer.resize();
      Input.refreshMinimap();
    }).observe(_canvas.parentElement);

    Input.init(_canvas);
    _setupUIEvents();

    UI.buildSidebar("base");
    UI.updateStats();
    UI.updateUndoButtons();

    const rooms = RoomDetector.detect();
    Store.setState({ detectedRooms: rooms });
    UI.updateRoomPanel(rooms);

    Renderer.resize();
    // 初期表示: グリッドが画面中央に収まるように
    setTimeout(() => {
      fitView();
      Input.refreshMinimap();
    }, 50);
  }

  document.addEventListener("DOMContentLoaded", init);

  return { placeBuilding, eraseBuilding, applyZoom, fitView, performUndo, performRedo };

})();

// ============================================================
// input.js — 統合ポインター入力管理
//
// すべてのユーザー入力（マウス・タッチ・ペン）をPointer Events APIで統一。
// キーボードショートカットもここで管理。
//
// 依存: store.js, renderer.js, ui.js, app.js(の公開関数)
//
// 【設計】
//   - Pointer Events に統一（MouseEvent/TouchEvent は使わない）
//   - 2本指: パン + ピンチズーム
//   - 1本指/左クリック: 配置 or 消去（ツールによる）
//   - 中ボタン/スペース+ドラッグ: パン
//   - 右クリック/長押し: コンテキストメニュー
//   - ホイール: ズーム
//   - WASD / 矢印キー: パン
//   - F: 全体表示
//   - Ctrl+Z / Ctrl+Y: Undo/Redo
// ============================================================

const Input = (() => {

  // ── 定数 ─────────────────────────────────────────────────
  const LONG_PRESS_MS    = 500;   // 長押し判定ミリ秒
  const LONG_PRESS_PX    = 8;     // 長押し判定: この距離以上動いたらキャンセル
  const PAN_KEY_SPEED    = 12;    // WASDパン速度 (px/frame)
  const MINIMAP_SIZE     = 140;   // ミニマップのサイズ(px)
  const MINIMAP_MARGIN   = 12;

  // ── 内部状態 ─────────────────────────────────────────────
  const _pointers   = new Map();  // pointerId → { x, y, type }
  let _spaceDown    = false;      // スペースキー押下でパンモード
  let _isPanning    = false;      // パン中フラグ
  let _panStart     = null;       // { panX, panY, px, py } パン開始時のビューポート
  let _isDrawing    = false;      // 描画ストローク中
  let _drawOp       = null;       // "place" | "erase"

  // 長押し
  let _longPressTimer  = null;
  let _longPressOrigin = null;    // { x, y }

  // ピンチ
  let _pinchStartDist   = null;
  let _pinchStartZoom   = null;
  let _pinchStartMid    = null;   // { x, y } キャンバス上のピンチ中心
  let _pinchStartPan    = null;   // { panX, panY }

  // WASDキーパン
  const _keysDown  = new Set();
  let _rafId       = null;

  // ミニマップ
  let _minimapCanvas  = null;
  let _minimapCtx     = null;
  let _minimapDragging = false;

  // キャンバス参照
  let _canvas = null;

  // ── 初期化 ───────────────────────────────────────────────
  function init(canvasEl) {
    _canvas = canvasEl;
    _setupPointerEvents(canvasEl);
    _setupWheel(canvasEl);
    _setupKeyboard();
    _setupMinimap();
    _startKeyLoop();
  }

  // ── Pointer Events ───────────────────────────────────────

  function _setupPointerEvents(canvas) {
    canvas.addEventListener("pointerdown",   _onPointerDown,   { passive: false });
    canvas.addEventListener("pointermove",   _onPointerMove,   { passive: false });
    canvas.addEventListener("pointerup",     _onPointerUp);
    canvas.addEventListener("pointercancel", _onPointerCancel);
    canvas.addEventListener("contextmenu",   e => e.preventDefault());
  }

  function _onPointerDown(e) {
    e.preventDefault();
    _canvas.setPointerCapture(e.pointerId);
    _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    // 2本指以上: ピンチ/パン開始
    if (_pointers.size === 2) {
      _cancelLongPress();
      _commitDrawIfNeeded();
      _startPinch();
      return;
    }

    const rect = _canvas.getBoundingClientRect();
    const px   = e.clientX - rect.left;
    const py   = e.clientY - rect.top;

    // 中ボタン or スペース押下: パン
    if (e.button === 1 || _spaceDown) {
      _startPan(px, py);
      return;
    }

    // 右クリック: コンテキストメニュー
    if (e.button === 2) {
      _triggerContextMenu(px, py);
      return;
    }

    // 左ボタン / タッチ: 長押し計測開始 & 描画開始準備
    _longPressOrigin = { x: px, y: py };
    _longPressTimer  = setTimeout(() => {
      _cancelLongPress();
      _triggerContextMenu(px, py);
    }, LONG_PRESS_MS);

    const { tool } = Store.getState();
    if (tool === "place" || tool === "erase") {
      _startDraw(tool, px, py);
    }
  }

  function _onPointerMove(e) {
    e.preventDefault();
    if (!_pointers.has(e.pointerId)) return;
    _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    const rect = _canvas.getBoundingClientRect();
    const px   = e.clientX - rect.left;
    const py   = e.clientY - rect.top;

    // ─ 長押しキャンセル判定 ─
    if (_longPressOrigin) {
      const dx = px - _longPressOrigin.x;
      const dy = py - _longPressOrigin.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_PX) _cancelLongPress();
    }

    // ─ 2本指ピンチ/パン ─
    if (_pointers.size === 2) {
      _updatePinch();
      return;
    }

    // ─ マウスカーソル更新 ─
    Store.setState({ lastMouse: { x: px, y: py } });
    const { col, row } = Renderer.toGrid(px, py);
    const posEl = document.getElementById("pos-label");
    if (posEl) posEl.textContent = `(${col}, ${row})`;

    // ─ パン ─
    if (_isPanning) {
      _updatePan(px, py);
      return;
    }

    // ─ 描画ドラッグ ─
    if (_isDrawing) {
      if (_drawOp === "place") App.placeBuilding(col, row);
      else if (_drawOp === "erase") App.eraseBuilding(col, row);
      return;
    }

    Renderer.draw();
  }

  function _onPointerUp(e) {
    const rect = _canvas.getBoundingClientRect();
    const px   = e.clientX - rect.left;
    const py   = e.clientY - rect.top;

    _cancelLongPress();
    _pointers.delete(e.pointerId);

    if (_pointers.size < 2) {
      _pinchStartDist = null; // ピンチ終了
    }

    if (_isPanning && _pointers.size === 0) {
      _isPanning = false;
      _panStart  = null;
      _updateCursor();
      return;
    }

    if (_isDrawing && _pointers.size === 0) {
      _commitDrawIfNeeded();
      return;
    }

    Renderer.draw();
  }

  function _onPointerCancel(e) {
    _cancelLongPress();
    _pointers.delete(e.pointerId);
    if (_isDrawing) _commitDrawIfNeeded();
    _isPanning = false;
    _updateCursor();
  }

  // ── パン ─────────────────────────────────────────────────

  function _startPan(px, py) {
    _isPanning = true;
    const { panX, panY } = Store.getState();
    _panStart  = { panX, panY, px, py };
    _canvas.style.cursor = "grabbing";
  }

  function _updatePan(px, py) {
    if (!_panStart) return;
    const dx      = px - _panStart.px;
    const dy      = py - _panStart.py;
    let newPanX   = _panStart.panX + dx;
    let newPanY   = _panStart.panY + dy;

    // パン範囲制限（グリッドが完全に画面外に出ないように）
    const { zoom }  = Store.getState();
    const gridW     = GRID_COLS * CELL_SIZE * zoom;
    const gridH     = GRID_ROWS * CELL_SIZE * zoom;
    const margin    = 80;
    newPanX = Math.max(margin - gridW, Math.min(_canvas.width  - margin, newPanX));
    newPanY = Math.max(margin - gridH, Math.min(_canvas.height - margin, newPanY));

    Store.setState({ panX: newPanX, panY: newPanY });
    Renderer.draw();
    _updateMinimap();
  }

  // ── ピンチズーム ─────────────────────────────────────────

  function _startPinch() {
    const pts   = [..._pointers.values()];
    const rect  = _canvas.getBoundingClientRect();
    const p0    = { x: pts[0].x - rect.left, y: pts[0].y - rect.top };
    const p1    = { x: pts[1].x - rect.left, y: pts[1].y - rect.top };
    _pinchStartDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    _pinchStartZoom = Store.getState().zoom;
    _pinchStartMid  = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    _pinchStartPan  = { panX: Store.getState().panX, panY: Store.getState().panY };
  }

  function _updatePinch() {
    if (!_pinchStartDist) return;
    const pts  = [..._pointers.values()];
    const rect = _canvas.getBoundingClientRect();
    const p0   = { x: pts[0].x - rect.left, y: pts[0].y - rect.top };
    const p1   = { x: pts[1].x - rect.left, y: pts[1].y - rect.top };

    const dist    = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const mid     = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const scale   = dist / _pinchStartDist;
    const newZoom = Math.max(0.15, Math.min(6, _pinchStartZoom * scale));

    // ピンチ中心を固定しながらズーム + ピンチ移動をパンに反映
    const panX = _pinchStartMid.x - (_pinchStartMid.x - _pinchStartPan.panX) * (newZoom / _pinchStartZoom) + (mid.x - _pinchStartMid.x);
    const panY = _pinchStartMid.y - (_pinchStartMid.y - _pinchStartPan.panY) * (newZoom / _pinchStartZoom) + (mid.y - _pinchStartMid.y);

    Store.setState({ zoom: newZoom, panX, panY });
    UI.updateZoomLabel();
    Renderer.draw();
    _updateMinimap();
  }

  // ── 描画ストローク ────────────────────────────────────────

  function _startDraw(op, px, py) {
    _isDrawing = true;
    _drawOp    = op;
    Store.beginStroke(Store.getState().activeLayer, op === "place" ? "配置" : "消去");

    const { col, row } = Renderer.toGrid(px, py);
    if (op === "place") App.placeBuilding(col, row);
    else                App.eraseBuilding(col, row);
  }

  function _commitDrawIfNeeded() {
    if (!_isDrawing) return;
    _isDrawing = false;
    _drawOp    = null;
    Store.commitStroke();
    UI.updateUndoButtons();
    _updateCursor();
  }

  // ── コンテキストメニュー ──────────────────────────────────

  function _triggerContextMenu(px, py) {
    const { col, row }    = Renderer.toGrid(px, py);
    const key             = `${col},${row}`;
    const { activeLayer } = Store.getState();

    let foundLayer = null;
    if (Store.getLayerGrid(activeLayer)[key]) foundLayer = activeLayer;
    if (!foundLayer) {
      for (const lk of LAYER_ORDER) {
        if (Store.getLayerGrid(lk)[key]) { foundLayer = lk; break; }
      }
    }

    if (foundLayer) {
      UI.showContextMenu(px, py, col, row, foundLayer);
    }
  }

  // ── 長押しキャンセル ─────────────────────────────────────

  function _cancelLongPress() {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    _longPressOrigin = null;
  }

  // ── マウスホイールズーム ──────────────────────────────────

  function _setupWheel(canvas) {
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const rect   = canvas.getBoundingClientRect();
      const px     = e.clientX - rect.left;
      const py     = e.clientY - rect.top;
      // トラックパッドは小さいdeltaY、マウスホイールは大きいdeltaY
      const factor = Math.abs(e.deltaY) < 50 ? 0.003 : 0.001;
      const scale  = 1 - e.deltaY * factor;
      App.applyZoom(Store.getState().zoom * scale, px, py);
      _updateMinimap();
    }, { passive: false });
  }

  // ── キーボード ───────────────────────────────────────────

  function _setupKeyboard() {
    document.addEventListener("keydown", _onKeyDown);
    document.addEventListener("keyup",   _onKeyUp);
  }

  function _onKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    // Undo / Redo
    if (e.ctrlKey && e.key === "z") { e.preventDefault(); App.performUndo(); return; }
    if (e.ctrlKey && e.key === "y") { e.preventDefault(); App.performRedo(); return; }

    // スペース: パンモード
    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      _spaceDown = true;
      _updateCursor();
      return;
    }

    // レイヤー切替 1-5
    const LAYER_KEY = { "1":"base","2":"plumbing","3":"gas","4":"electrical","5":"automation" };
    if (LAYER_KEY[e.key]) { UI.switchLayer(LAYER_KEY[e.key]); return; }

    // ツール
    if (e.key === "p" || e.key === "P") { UI.setTool("place"); return; }
    if (e.key === "e" || e.key === "E") { UI.setTool("erase"); return; }

    // F: 全体表示
    if (e.key === "f" || e.key === "F") { App.fitView(); return; }

    // Escape: 選択解除
    if (e.key === "Escape") {
      Store.setState({ selectedBuilding: null });
      const lbl = document.getElementById("selected-label");
      if (lbl) lbl.textContent = "建物を選択してください";
      document.querySelectorAll(".building-btn").forEach(x => x.classList.remove("selected"));
      return;
    }

    // Vキー: ペースト
    if (e.key === "v" || e.key === "V") {
      const { clipboard, lastMouse } = Store.getState();
      if (clipboard && lastMouse) {
        const { col, row } = Renderer.toGrid(lastMouse.x, lastMouse.y);
        Store.setState({ selectedBuilding: clipboard });
        Store.beginStroke(Store.getState().activeLayer, "ペースト");
        App.placeBuilding(col, row);
        Store.commitStroke();
        UI.updateUndoButtons();
      }
      return;
    }

    // WASD / 矢印キー: パン
    _keysDown.add(e.code);
  }

  function _onKeyUp(e) {
    if (e.code === "Space") {
      _spaceDown = false;
      _isPanning = false;
      _panStart  = null;
      _updateCursor();
    }
    _keysDown.delete(e.code);
  }

  // WASDキーパンループ
  function _startKeyLoop() {
    const loop = () => {
      _rafId = requestAnimationFrame(loop);
      if (_keysDown.size === 0) return;

      let dx = 0, dy = 0;
      if (_keysDown.has("KeyW") || _keysDown.has("ArrowUp"))    dy += PAN_KEY_SPEED;
      if (_keysDown.has("KeyS") || _keysDown.has("ArrowDown"))  dy -= PAN_KEY_SPEED;
      if (_keysDown.has("KeyA") || _keysDown.has("ArrowLeft"))  dx += PAN_KEY_SPEED;
      if (_keysDown.has("KeyD") || _keysDown.has("ArrowRight")) dx -= PAN_KEY_SPEED;
      if (dx === 0 && dy === 0) return;

      const { panX, panY, zoom } = Store.getState();
      const gridW  = GRID_COLS * CELL_SIZE * zoom;
      const gridH  = GRID_ROWS * CELL_SIZE * zoom;
      const margin = 80;
      const newPanX = Math.max(margin - gridW, Math.min(_canvas.width  - margin, panX + dx));
      const newPanY = Math.max(margin - gridH, Math.min(_canvas.height - margin, panY + dy));
      Store.setState({ panX: newPanX, panY: newPanY });
      Renderer.draw();
      _updateMinimap();
    };
    _rafId = requestAnimationFrame(loop);
  }

  // ── カーソル更新 ─────────────────────────────────────────

  function _updateCursor() {
    if (!_canvas) return;
    if (_spaceDown || _isPanning) {
      _canvas.style.cursor = _isPanning ? "grabbing" : "grab";
    } else {
      const { tool } = Store.getState();
      _canvas.style.cursor = tool === "erase" ? "cell" : "crosshair";
    }
  }

  // ── ミニマップ ───────────────────────────────────────────

  function _setupMinimap() {
    _minimapCanvas = document.getElementById("minimap-canvas");
    if (!_minimapCanvas) return;
    _minimapCtx    = _minimapCanvas.getContext("2d");
    _minimapCanvas.width  = MINIMAP_SIZE;
    _minimapCanvas.height = Math.round(MINIMAP_SIZE * GRID_ROWS / GRID_COLS);

    // ミニマップドラッグでビューポート移動
    _minimapCanvas.addEventListener("pointerdown", _onMinimapPointerDown);
    _minimapCanvas.addEventListener("pointermove", _onMinimapPointerMove);
    _minimapCanvas.addEventListener("pointerup",   () => { _minimapDragging = false; });
  }

  function _onMinimapPointerDown(e) {
    e.preventDefault();
    _minimapDragging = true;
    _minimapCanvas.setPointerCapture(e.pointerId);
    _panToMinimap(e);
  }

  function _onMinimapPointerMove(e) {
    if (!_minimapDragging) return;
    _panToMinimap(e);
  }

  function _panToMinimap(e) {
    const rect  = _minimapCanvas.getBoundingClientRect();
    const mx    = (e.clientX - rect.left) / rect.width;
    const my    = (e.clientY - rect.top)  / rect.height;
    const { zoom } = Store.getState();
    const gridW    = GRID_COLS * CELL_SIZE * zoom;
    const gridH    = GRID_ROWS * CELL_SIZE * zoom;
    // クリックしたグリッド位置をビューポート中央にする
    const panX  = _canvas.width  / 2 - mx * gridW;
    const panY  = _canvas.height / 2 - my * gridH;
    Store.setState({ panX, panY });
    Renderer.draw();
    _updateMinimap();
  }

  function _updateMinimap() {
    if (!_minimapCtx || !_minimapCanvas) return;

    const mw  = _minimapCanvas.width;
    const mh  = _minimapCanvas.height;
    const ctx = _minimapCtx;

    ctx.clearRect(0, 0, mw, mh);
    ctx.fillStyle = "#0d1018";
    ctx.fillRect(0, 0, mw, mh);

    // 建物を小さく描画
    const scaleX = mw / GRID_COLS;
    const scaleY = mh / GRID_ROWS;

    for (const lk of LAYER_ORDER) {
      const alpha = lk === Store.getState().activeLayer ? 1 : 0.4;
      ctx.globalAlpha = alpha;
      for (const [key, b] of Object.entries(Store.getLayerGrid(lk))) {
        if (b.ref) continue;
        const [c, r] = key.split(",").map(Number);
        ctx.fillStyle = b.fixed ? "#ff6a00" : b.color;
        ctx.fillRect(c * scaleX, r * scaleY, b.w * scaleX, b.h * scaleY);
      }
    }
    ctx.globalAlpha = 1;

    // 現在のビューポートを枠で表示
    const { zoom, panX, panY } = Store.getState();
    const cs   = CELL_SIZE * zoom;
    const vx   = -panX / cs / GRID_COLS;
    const vy   = -panY / cs / GRID_ROWS;
    const vw   = _canvas.width  / cs / GRID_COLS;
    const vh   = _canvas.height / cs / GRID_ROWS;

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(
      Math.max(0, vx * mw),
      Math.max(0, vy * mh),
      Math.min(mw, vw * mw),
      Math.min(mh, vh * mh)
    );

    // 外枠
    ctx.strokeStyle = "rgba(90,130,255,0.4)";
    ctx.lineWidth   = 1;
    ctx.strokeRect(0, 0, mw, mh);
  }

  // ── 公開API ──────────────────────────────────────────────

  /** ミニマップを再描画する（Renderer.draw後に呼ぶ） */
  function refreshMinimap() { _updateMinimap(); }

  /** カーソルを現在の状態に合わせて更新 */
  function refreshCursor()  { _updateCursor();  }

  return { init, refreshMinimap, refreshCursor };

})();

// ============================================================
// renderer.js — Canvas 描画モジュール
//
// 依存: data.js (LAYERS, LAYER_ORDER, GRID_COLS, GRID_ROWS, CELL_SIZE)
//       store.js (Store.getState, Store.getLayerGrid)
//
// DOM のサイズ変更や部屋ハイライトなど、状態は Store から読む。
// ============================================================

const Renderer = (() => {

  let _canvas = null;
  let _ctx    = null;

  // ── 初期化 ───────────────────────────────────────────────
  function init(canvasEl) {
    _canvas = canvasEl;
    _ctx    = canvasEl.getContext("2d");
  }

  function resize() {
    const container = _canvas.parentElement;
    _canvas.width  = container.clientWidth;
    _canvas.height = container.clientHeight;
    draw();
  }

  // ── 座標変換 ─────────────────────────────────────────────
  function _cs() {
    return CELL_SIZE * Store.getState().zoom;
  }

  function toGrid(px, py) {
    const { panX, panY } = Store.getState();
    const s = _cs();
    return {
      col: Math.floor((px - panX) / s),
      row: Math.floor((py - panY) / s),
    };
  }

  function _toScreen(col, row) {
    const { panX, panY } = Store.getState();
    const s = _cs();
    return { x: col * s + panX, y: row * s + panY };
  }

  function _iconLabel(b) {
    const words = (b.name_en || b.id || "")
      .split(/\s+|_/)
      .filter(Boolean);
    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  }

  // ── グリッド線 ───────────────────────────────────────────
  function _drawGrid() {
    const { panX, panY } = Store.getState();
    const s = _cs();
    const ctx = _ctx;

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = c * s + panX;
      ctx.beginPath(); ctx.moveTo(x, panY); ctx.lineTo(x, GRID_ROWS * s + panY); ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = r * s + panY;
      ctx.beginPath(); ctx.moveTo(panX, y); ctx.lineTo(GRID_COLS * s + panX, y); ctx.stroke();
    }

    // 5マスごとに明るい線
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let c = 0; c <= GRID_COLS; c += 5) {
      const x = c * s + panX;
      ctx.beginPath(); ctx.moveTo(x, panY); ctx.lineTo(x, GRID_ROWS * s + panY); ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r += 5) {
      const y = r * s + panY;
      ctx.beginPath(); ctx.moveTo(panX, y); ctx.lineTo(GRID_COLS * s + panX, y); ctx.stroke();
    }
  }

  // ── 部屋塗り ─────────────────────────────────────────────
  function _drawRooms() {
    const { detectedRooms, highlightedRoom } = Store.getState();
    const s   = _cs();
    const ctx = _ctx;

    detectedRooms.forEach((room, idx) => {
      const isHighlighted = highlightedRoom === idx;
      const valid   = room.classifications.some(c => c.status === "valid");
      const partial = room.classifications.some(c =>
        c.status === "missing_required" || c.status === "size_small" || c.status === "size_large"
      );

      let fillColor, alpha;
      if      (valid)   { fillColor = "#4aaa70"; alpha = isHighlighted ? 0.35 : 0.12; }
      else if (partial) { fillColor = "#d08030"; alpha = isHighlighted ? 0.30 : 0.08; }
      else              { fillColor = "#6a7080"; alpha = isHighlighted ? 0.20 : 0.05; }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = fillColor;
      for (const [c, r] of room.cells) {
        const sc = _toScreen(c, r);
        ctx.fillRect(sc.x, sc.y, s, s);
      }
      ctx.restore();

      // ハイライト中は部屋名ラベルを中央に表示
      if (isHighlighted) {
        const validTypes = room.classifications.filter(c => c.status === "valid");
        const label = validTypes.length > 0
          ? validTypes.map(c => {
            const t = c.type;
            return (typeof I18n !== 'undefined')
              ? (I18n.getLang() === 'en' ? (t.name_en || t.name_ja || t.id) : (t.name_ja || t.name_en || t.id))
              : (t.name_en || t.name_ja || t.id);
          }).join(" / ")
          : `${room.size} tiles`;

        const minC = Math.min(...room.cells.map(([c]) => c));
        const maxC = Math.max(...room.cells.map(([c]) => c));
        const minR = Math.min(...room.cells.map(([, r]) => r));
        const cx   = ((minC + maxC) / 2 + 0.5) * s + Store.getState().panX;
        const cy   = (minR + 0.5) * s + Store.getState().panY;

        ctx.save();
        ctx.font          = `bold ${Math.max(10, Math.min(14, s * 0.7))}px sans-serif`;
        ctx.textAlign     = "center";
        ctx.textBaseline  = "middle";
        const tw          = ctx.measureText(label).width;
        ctx.fillStyle     = "rgba(0,0,0,0.6)";
        ctx.fillRect(cx - tw / 2 - 4, cy - 9, tw + 8, 18);
        ctx.fillStyle     = valid ? "#4aaa70" : "#d08030";
        ctx.fillText(label, cx, cy);
        ctx.restore();
      }
    });
  }

  // ── 1レイヤーの建物を描画 ────────────────────────────────
  function _drawLayer(layerKey, alpha) {
    const grid = Store.getLayerGrid(layerKey);
    const s    = _cs();
    const ctx  = _ctx;

    ctx.save();
    ctx.globalAlpha = alpha;

    for (const [key, b] of Object.entries(grid)) {
      if (b.ref) continue;
      const [c, r] = key.split(",").map(Number);
      const sc = _toScreen(c, r);
      const bw = b.w * s;
      const bh = b.h * s;

      // ── 製造ポッド（固定・特別描画） ──
      if (b.fixed) {
        ctx.fillStyle   = "#ff6a0022";
        ctx.strokeStyle = "#ff6a00";
        ctx.lineWidth   = 2;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.roundRect(sc.x + 1, sc.y + 1, bw - 2, bh - 2, 3);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (s > 8) {
          ctx.fillStyle    = "#ff6a00";
          ctx.font         = `bold ${Math.min(s * 0.45, 12)}px sans-serif`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          const podLabel = (typeof I18n !== "undefined" && I18n.getLang() === "ja")
            ? b.name_ja : b.name_en;
          ctx.fillText(podLabel, sc.x + bw / 2, sc.y + bh / 2);
        }
        continue;
      }

      // ── 通常建物 ──
      ctx.fillStyle = b.color + "cc";
      ctx.beginPath();
      ctx.roundRect(sc.x + 1, sc.y + 1, bw - 2, bh - 2, 3);
      ctx.fill();

      ctx.strokeStyle = b.color;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(sc.x + 1, sc.y + 1, bw - 2, bh - 2, 3);
      ctx.stroke();

      // アイコン（ズームが十分大きい時のみ）
      if (s > 8) {
        ctx.fillStyle    = "rgba(255,255,255,0.9)";
        ctx.font         = `${Math.min(s * 0.6, 16)}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(_iconLabel(b), sc.x + bw / 2, sc.y + bh / 2);
      }

      // 建物名ラベル（幅が広い建物のみ）
      if (s > 16 && (b.w > 1 || b.h > 2)) {
        ctx.fillStyle    = "rgba(255,255,255,0.4)";
        ctx.font         = `${Math.max(7, s * 0.26)}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(b.name_en || b.name_ja || b.id, sc.x + bw / 2, sc.y + bh - 2);
      }
    }

    ctx.restore();
  }

  // ── グリッド境界 ─────────────────────────────────────────
  function _drawBorder() {
    const { panX, panY, activeLayer } = Store.getState();
    const s   = _cs();
    const ctx = _ctx;

    ctx.strokeStyle = "rgba(90,130,255,0.25)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(panX, panY, GRID_COLS * s, GRID_ROWS * s);

    const ac = LAYERS[activeLayer].color;
    ctx.strokeStyle = ac + "44";
    ctx.lineWidth   = 2;
    ctx.strokeRect(panX - 1, panY - 1, GRID_COLS * s + 2, GRID_ROWS * s + 2);
  }

  // ── ホバープレビュー ─────────────────────────────────────
  function _drawHoverPreview() {
    const { selectedBuilding, tool, lastMouse } = Store.getState();
    if (!selectedBuilding || (tool !== "place") || !lastMouse) return;

    const { col, row } = toGrid(lastMouse.x, lastMouse.y);
    const left  = col - selectedBuilding.w + 1;
    const top   = row - selectedBuilding.h + 1;
    const sc    = _toScreen(left, top);
    const s     = _cs();
    const valid = left >= 0 && top >= 0
               && col < GRID_COLS
               && row < GRID_ROWS;

    _ctx.fillStyle   = valid ? "rgba(90,160,255,0.18)" : "rgba(255,80,80,0.18)";
    _ctx.strokeStyle = valid ? "rgba(90,160,255,0.8)"  : "rgba(255,80,80,0.8)";
    _ctx.lineWidth   = 1;
    _ctx.beginPath();
    _ctx.roundRect(
      sc.x + 1, sc.y + 1,
      selectedBuilding.w * s - 2,
      selectedBuilding.h * s - 2,
      3
    );
    _ctx.fill();
    _ctx.stroke();
  }

  // ── 矩形選択（Copy Tool） ────────────────────────────────
  function _drawSelectionRect() {
    const { tool, selection } = Store.getState();
    if (tool !== "copy" || !selection.active) return;

    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);

    const s  = _cs();
    const sc = _toScreen(minC, minR);
    const w  = (maxC - minC + 1) * s;
    const h  = (maxR - minR + 1) * s;

    _ctx.save();
    _ctx.fillStyle   = "rgba(90,160,255,0.15)";
    _ctx.strokeStyle = "rgba(90,160,255,0.9)";
    _ctx.lineWidth   = 1.5;
    _ctx.setLineDash([6, 3]);
    _ctx.fillRect(sc.x, sc.y, w, h);
    _ctx.strokeRect(sc.x, sc.y, w, h);
    _ctx.restore();
  }

  // ── ペースト プレビュー（半透明ゴースト・状態は変更しない） ──
  function _drawPastePreview() {
    const { pasteMode, areaClipboard, lastMouse, selection } = Store.getState();
    if (!pasteMode || !areaClipboard || !lastMouse) return;
    if (selection.active) return; // dragging a fresh selection takes visual priority

    const { col: anchorCol, row: anchorRow } = toGrid(lastMouse.x, lastMouse.y);
    const s = _cs();

    _ctx.save();
    _ctx.globalAlpha = 0.5;
    for (const obj of areaClipboard.objects) {
      const def = BUILDING_MAP[obj.objectId];
      if (!def) continue;

      const left = anchorCol + obj.relX;
      const top  = anchorRow + obj.relY;
      const sc   = _toScreen(left, top);
      const bw   = def.w * s;
      const bh   = def.h * s;

      _ctx.fillStyle = def.color + "cc";
      _ctx.beginPath();
      _ctx.roundRect(sc.x + 1, sc.y + 1, bw - 2, bh - 2, 3);
      _ctx.fill();
      _ctx.strokeStyle = def.color;
      _ctx.lineWidth   = 1;
      _ctx.stroke();
    }
    _ctx.restore();
  }

  // ── メイン描画 ───────────────────────────────────────────
  function draw() {
    if (!_canvas) return;
    const { activeLayer, layerVisible } = Store.getState();
    const s   = _cs();
    const ctx = _ctx;

    // 背景
    ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    ctx.fillStyle = "#0d1018";
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    _drawGrid();
    _drawRooms();

    // 非アクティブレイヤーを薄く重ねる
    for (const lk of LAYER_ORDER) {
      if (lk === activeLayer) continue;
      if (lk !== "base" && !layerVisible[lk]) continue;
      _drawLayer(lk, LAYERS[lk].dimAlpha);
    }

    // アクティブレイヤーをフル不透明度で描画
    _drawLayer(activeLayer, LAYERS[activeLayer].alpha);

    _drawBorder();
    _drawHoverPreview();
    _drawSelectionRect();
    _drawPastePreview();
  }

  return { init, resize, draw, toGrid };

})();

// ============================================================
// rooms.js — 部屋検出エンジン
//
// 依存: data.js (GRID_COLS, GRID_ROWS, ROOM_TYPES, BUILDING_MAP)
//       store.js (Store.getState)
//
// DOM / Canvas には一切触れない純粋ロジック。
// ============================================================

const RoomDetector = (() => {

  // ── セル属性判定 ───────────────────────────────────────

  /** グリッド外または solid な建物が占めるセルは「壁」とみなす */
  function isSolid(col, row) {
    if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return true;
    const b = _getMainBuilding("base", col, row);
    return b ? !!b.solid : false;
  }

  /** ドア・エアロック: 壁扱いだが境界として部屋を閉じる */
  function isDoor(col, row) {
    const b = _getMainBuilding("base", col, row);
    return b ? !!b.isDoor : false;
  }

  /** 指定セルの主建物（ref先を解決済み）を返す。なければ null */
  function _getMainBuilding(layerKey, col, row) {
    const grid = Store.getLayerGrid(layerKey);
    const b = grid[`${col},${row}`];
    if (!b) return null;
    return b.ref ? (grid[b.ref] || null) : b;
  }

  // ── フラッドフィル ─────────────────────────────────────

  /**
   * (startCol, startRow) から非solidセルを BFS で広げ、
   * 連結した空気セルのリスト [[c,r], ...] を返す。
   * 既訪問セット visited に追加しながら進む。
   */
  function floodFill(startCol, startRow, visited) {
    const key0 = `${startCol},${startRow}`;
    if (visited.has(key0)) return null;
    if (isSolid(startCol, startRow)) return null;

    const cells = [];
    const queue = [[startCol, startRow]];

    while (queue.length > 0) {
      const [c, r] = queue.shift();
      const k = `${c},${r}`;
      if (visited.has(k)) continue;
      if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) continue;
      if (isSolid(c, r) || isDoor(c, r)) continue;

      visited.add(k);
      cells.push([c, r]);

      queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }

    return cells.length > 0 ? cells : null;
  }

  // ── 閉鎖判定 ──────────────────────────────────────────

  /**
   * 領域が完全に囲まれているか確認する。
   * 隣接セルがソリッド / ドア / 同じ領域内 のいずれかならOK。
   * グリッド外に出ると開放空間として false を返す。
   */
  function isEnclosed(cells) {
    const cellSet = new Set(cells.map(([c, r]) => `${c},${r}`));

    for (const [c, r] of cells) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= GRID_COLS || nr >= GRID_ROWS) return false;
        if (!isSolid(nc, nr) && !isDoor(nc, nr) && !cellSet.has(`${nc},${nr}`)) return false;
      }
    }
    return true;
  }

  // ── 建物収集 ──────────────────────────────────────────

  /** 領域セル内に存在する建物 id の Set を返す */
  function getBuildingIds(cells) {
    const ids = new Set();
    const grid = Store.getLayerGrid("base");
    for (const [c, r] of cells) {
      const b = grid[`${c},${r}`];
      if (!b || b.ref) continue;
      ids.add(b.id);
    }
    return ids;
  }

  // ── 部屋タイプ判定 ────────────────────────────────────

  /**
   * cells と buildingIds から、各 ROOM_TYPE に対して判定結果を返す。
   * 戻り値: Array<{ type, status, reason }>
   *   status: "valid" | "size_small" | "size_large" | "missing_required"
   */
  function classifyRoom(cells, buildingIds) {
    const size = cells.length;
    const results = [];

    for (const rt of ROOM_TYPES) {
      // ── サイズ違反 ──
      if (size < rt.minTiles) {
        results.push({ type: rt, status: "size_small",
          reason: (typeof I18n !== "undefined" && I18n.getLang() === "ja")
              ? `部屋が小さすぎます (${size} / ${rt.minTiles}マス以上必要)`
              : `Too small (${size} / min ${rt.minTiles} tiles)` });
        continue;
      }
      if (size > rt.maxTiles) {
        results.push({ type: rt, status: "size_large",
          reason: (typeof I18n !== "undefined" && I18n.getLang() === "ja")
              ? `部屋が大きすぎます (${size} / ${rt.maxTiles}マス以下必要)`
              : `Too large (${size} / max ${rt.maxTiles} tiles)` });
        continue;
      }

      // ── 禁止建物 ──
      const hasForbidden = rt.forbidden.some(id => buildingIds.has(id));
      if (hasForbidden) continue;

      // ── 必須建物（OR条件） ──
      if (rt.required.length > 0) {
        const hasRequired = rt.required.some(id => buildingIds.has(id));
        if (!hasRequired) {
          const names = rt.required
            .map(id => BUILDING_MAP[id]?.name_en || BUILDING_MAP[id]?.name_ja || id)
            .join(" or ");
          results.push({ type: rt, status: "missing_required",
            reason: (typeof I18n !== "undefined" && I18n.getLang() === "ja")
              ? `必須: ${names}`
              : `Requires: ${names}` });
          continue;
        }
      }

      results.push({ type: rt, status: "valid",
        reason: (typeof I18n !== "undefined" && I18n.getLang() === "ja")
              ? "✓ 条件を満たしています"
              : "✓ Requirements met" });
    }

    return results;
  }

  // ── メイン検出処理 ────────────────────────────────────

  /**
   * グリッド全体をスキャンして閉鎖空間を検出し、
   * 部屋情報の配列を返す。
   *
   * 戻り値: Array<{
   *   cells: [[c,r], ...],
   *   size: number,
   *   buildingIds: Set<string>,
   *   classifications: Array<{type, status, reason}>
   * }>
   */
  function detect() {
    const visited = new Set();
    const rooms = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const k = `${c},${r}`;
        if (visited.has(k)) continue;
        if (isSolid(c, r) || isDoor(c, r)) { visited.add(k); continue; }

        const cells = floodFill(c, r, visited);
        if (!cells || cells.length < 4) continue;

        if (isEnclosed(cells)) {
          const buildingIds     = getBuildingIds(cells);
          const classifications = classifyRoom(cells, buildingIds);
          rooms.push({ cells, size: cells.length, buildingIds, classifications });
        }
      }
    }

    return rooms;
  }

  return { detect };

})();

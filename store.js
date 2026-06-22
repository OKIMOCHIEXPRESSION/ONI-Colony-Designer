// ============================================================
// store.js — アプリケーション状態 + Undo/Redo 履歴管理
//
// 【Undo/Redo の設計】
//
//   コマンドパターン + セル差分（diff）方式
//
//   1コマンド = {
//     label  : string            // 表示用ラベル（将来のUI用）
//     layer  : string            // 変更対象レイヤー（単一）
//     diffs  : CellDiff[]        // 変更されたセルの差分リスト
//   }
//
//   CellDiff = {
//     key    : "col,row"         // セルキー
//     before : buildingObj|null  // 変更前の値（null = なし）
//     after  : buildingObj|null  // 変更後の値（null = 削除）
//   }
//
//   【メモリ効率】
//   スナップショット全体ではなく「変化したセルだけ」を記録する。
//   100セル同時変更でも数KBに収まり、100ステップ×複数レイヤーでも問題ない。
//
//   【ドラッグ描画の扱い】
//   app.js が beginStroke() / commitStroke() でフレームを括り、
//   1回のマウス操作（down→up）を1コマンドとして記録する。
//   途中のセル変更は _pendingDiffs に蓄積し、commit 時にまとめてpushする。
//
//   【複数レイヤーにまたがる操作（全消去など）】
//   app.js から pushCommand() に複数レイヤーの diffs を渡す。
//   コマンド自体はレイヤーをまたいだ CellDiff[] の配列として保持する。
//   layer フィールドは "multi" を使う。
//
//   【将来拡張】
//   - 部屋テンプレ配置   → commitStroke() か pushCommand() を呼ぶだけ
//   - 複数セル一括コピー → 同上
//   - redo ツリー化      → _future を木構造に変更するだけで対応可能
// ============================================================

const Store = (() => {

  // ── 内部状態 ────────────────────────────────────────────────
  let _state = {
    zoom:  1,
    panX:  40,
    panY:  20,

    tool:             "place",
    selectedBuilding: null,
    activeLayer:      "base",
    clipboard:        null,

    // ── Area selection / copy / paste (Task-UX-001 / R5: ghost-based paste) ──
    // Runtime-only. Never serialized (see serialize()/deserialize()).
    areaClipboard: null,   // { width, height, objects: [{layer, objectType, objectId, relX, relY}] }
    selection: {
      active:   false,
      startCol: 0,
      startRow: 0,
      endCol:   0,
      endRow:   0,
    },
    // Ghost: a draggable, 50%-opacity preview of the clipboard. Position is
    // explicit grid coordinates (no cursor tracking) — dragged via pointer
    // deltas, confirmed via tap. See app.js copySelection()/pasteAreaClipboard().
    ghostX:      0,
    ghostY:      0,
    ghostActive: false,

    layers: {
      base:       {},
      plumbing:   {},
      gas:        {},
      electrical: {},
      automation: {},
    },

    layerVisible: {
      plumbing:   true,
      gas:        true,
      electrical: true,
      automation: true,
    },

    isDragging:      false,
    isPanning:       false,
    panStart:        null,
    lastMouse:       null,
    rightClick:      { col: -1, row: -1, layer: null },

    detectedRooms:   [],
    highlightedRoom: null,
  };

  // ── 履歴スタック ─────────────────────────────────────────────
  const HISTORY_LIMIT = 100;

  let _past   = [];   // コマンドスタック（undoable）。末尾が最新
  let _future = [];   // Redo スタック。Undoするたびに積まれる

  // ストローク中の差分バッファ（commit前）
  let _pendingDiffs  = null;   // null = ストローク未開始
  let _pendingLayer  = null;
  let _pendingLabel  = "";
  // ストローク中に触ったセルのキーセット（同一セルへの重複記録防止）
  let _pendingTouched = null;

  // ── 公開API: 状態アクセス ─────────────────────────────────────

  function getState()              { return _state; }
  function setState(patch)         { Object.assign(_state, patch); }
  function getLayerGrid(layerKey)  { return _state.layers[layerKey]; }

  // ── 公開API: 直接グリッドを書き換える低レベル操作 ─────────────
  // これらは履歴を記録しない。履歴記録はapp.jsが責務を持つ。

  function setCell(layerKey, key, value) {
    if (value === null || value === undefined) {
      delete _state.layers[layerKey][key];
    } else {
      _state.layers[layerKey][key] = value;
    }
  }

  // ── 公開API: Undo/Redo 履歴記録 ──────────────────────────────

  /**
   * ドラッグ操作開始を宣言する。
   * beginStroke → (セル変更を記録しながら操作) → commitStroke
   * という流れで1ストロークを1コマンドにまとめる。
   *
   * @param {string} layerKey - 操作対象レイヤー
   * @param {string} label    - 履歴ラベル（例: "配置", "消去"）
   */
  function beginStroke(layerKey, label) {
    _pendingDiffs   = [];
    _pendingLayer   = layerKey;
    _pendingLabel   = label;
    _pendingTouched = new Set();
  }

  /**
   * ストローク中のセル変更を1件記録する。
   * before は呼び出し前の値、after は書き込み後の値をapp.jsが渡す。
   * 同一セルへの2回目の記録はスキップ（最初の before を保持するため）。
   *
   * @param {string}      key    - "col,row"
   * @param {Object|null} before - 変更前の値
   * @param {Object|null} after  - 変更後の値
   */
  function recordCellDiff(key, before, after) {
    if (!_pendingDiffs) return;            // beginStroke 未呼び出し
    if (_pendingTouched.has(key)) return;  // 同一セルは最初の before のみ
    _pendingTouched.add(key);
    _pendingDiffs.push({ key, before, after });
  }

  /**
   * ストロークを確定してコマンドとして履歴に積む。
   * 変化がなければ何もしない。
   */
  function commitStroke() {
    if (!_pendingDiffs || _pendingDiffs.length === 0) {
      _pendingDiffs = null;
      return false;
    }
    // diffs に layer を付与（_applyDiffs が diff 単体から layer を読むため）
    const layer = _pendingLayer;
    const diffs = _pendingDiffs.map(d => ({ ...d, layer }));
    _pushCommand({
      label:  _pendingLabel,
      layer,
      diffs,
    });
    _pendingDiffs   = null;
    _pendingLayer   = null;
    _pendingLabel   = "";
    _pendingTouched = null;

    return true;
  }

  /**
   * ストロークを中断してすべての変更を元に戻す。
   * コマンド履歴には何も積まない。
   * 2本指ジェスチャー開始時やpointercancel時に使う。
   */
  function cancelStroke() {
    if (!_pendingDiffs) return;
    // _pendingDiffs の after→before 方向でセルを巻き戻す
    const layer = _pendingLayer;
    for (const diff of _pendingDiffs) {
      const targetLayer = diff.layer || layer;
      const value = diff.before;   // restore original value
      if (value === null || value === undefined) {
        delete _state.layers[targetLayer][diff.key];
      } else {
        _state.layers[targetLayer][diff.key] = value;
      }
    }
    _pendingDiffs   = null;
    _pendingLayer   = null;
    _pendingLabel   = "";
    _pendingTouched = null;
  }

  /**
   * 単発操作（全消去・ロードなど）を直接コマンドとして記録する。
   * ストローク管理が不要な場合に使う。
   *
   * @param {string}     label   - 履歴ラベル
   * @param {string}     layer   - レイヤーキー（複数レイヤー変更なら "multi"）
   * @param {CellDiff[]} diffs   - 変更差分リスト
   */
  function pushCommand(label, layer, diffs) {
    if (diffs.length === 0) return;
    _pushCommand({ label, layer, diffs });
  }

  // ── Undo / Redo ──────────────────────────────────────────────

  /**
   * 1コマンド分 Undo する。
   * @returns {boolean} - undo 実行したか
   */
  function undo() {
    if (_past.length === 0) return false;
    const cmd = _past.pop();
    _applyDiffs(cmd.diffs, /* reverse = */ true);
    _future.push(cmd);
    return true;
  }

  /**
   * 1コマンド分 Redo する。
   * @returns {boolean} - redo 実行したか
   */
  function redo() {
    if (_future.length === 0) return false;
    const cmd = _future.pop();
    _applyDiffs(cmd.diffs, /* reverse = */ false);
    _past.push(cmd);
    return true;
  }

  /** Undo が可能か */
  function canUndo() { return _past.length > 0; }

  /** Redo が可能か */
  function canRedo() { return _future.length > 0; }

  /** 現在の履歴情報（デバッグ・UI用） */
  function getHistoryInfo() {
    return {
      undoCount:  _past.length,
      redoCount:  _future.length,
      lastLabel:  _past.length > 0 ? _past[_past.length - 1].label : null,
      nextLabel:  _future.length > 0 ? _future[_future.length - 1].label : null,
    };
  }

  // ── 保存・読込 ───────────────────────────────────────────────

  function serialize() {
    return { version: 2, layers: _state.layers };
  }

  function deserialize(data) {
    if (data.version === 2 && data.layers) {
      _state.layers = data.layers;
    } else if (data.grid) {
      _state.layers.base = data.grid;
    }
  }

  // ── グリッド操作ヘルパー（履歴なし） ─────────────────────────

  /** 全レイヤーをリセットして製造ポッドを再配置 */
  function resetLayers() {
    _state.layers = {
      base:       {},
      plumbing:   {},
      gas:        {},
      electrical: {},
      automation: {},
    };
    _placePrintingPod();
  }

  /** アクティブレイヤーのみクリアして製造ポッドを再配置（必要なら） */
  function clearActiveLayer() {
    _state.layers[_state.activeLayer] = {};
    if (_state.activeLayer === "base") _placePrintingPod();
  }

  // ── 内部ヘルパー ─────────────────────────────────────────────

  /** コマンドを past に積む。HISTORY_LIMIT 超過時は古いものを捨てる。 */
  function _pushCommand(cmd) {
    _past.push(cmd);
    if (_past.length > HISTORY_LIMIT) _past.shift(); // 先頭（最古）を削除
    _future = []; // 新規操作でredo履歴をクリア
  }

  /**
   * diff リストをグリッドに適用する。
   * reverse=true なら after→before（Undo方向）、false なら before→after（Redo方向）
   */
  /**
   * diff リストをグリッドに適用する。
   * - reverse=false → before→after  （Redo / 通常適用）
   * - reverse=true  → after→before  （Undo）
   *
   * 各 diff の layer フィールドを使う（multiコマンドに対応）。
   * layer が省略されている場合はコマンドの layer を使う（呼び出し元で付与）。
   */
  function _applyDiffs(diffs, reverse) {
    for (const diff of diffs) {
      const targetLayer = diff.layer;
      const value       = reverse ? diff.before : diff.after;
      if (value === null || value === undefined) {
        delete _state.layers[targetLayer][diff.key];
      } else {
        _state.layers[targetLayer][diff.key] = value;
      }
    }
  }

  function _placePrintingPod() {
    const b    = { ...PRINTING_POD };
    const grid = _state.layers.base;
    for (let dc = 0; dc < b.w; dc++) {
      for (let dr = 0; dr < b.h; dr++) {
        const key = `${POD_COL + dc},${POD_ROW + dr}`;
        grid[key] = (dc === 0 && dr === 0)
          ? b
          : { ...b, ref: `${POD_COL},${POD_ROW}` };
      }
    }
  }

  // 初期化
  _placePrintingPod();

  return {
    // 状態アクセス
    getState,
    setState,
    getLayerGrid,
    setCell,
    // グリッド操作
    resetLayers,
    clearActiveLayer,
    // 保存・読込
    serialize,
    deserialize,
    // 履歴記録
    beginStroke,
    recordCellDiff,
    commitStroke,
    cancelStroke,
    pushCommand,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    getHistoryInfo,
  };

})();

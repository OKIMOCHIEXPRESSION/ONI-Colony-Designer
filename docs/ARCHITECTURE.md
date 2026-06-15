# アーキテクチャ

ONI Colony Designer の内部設計です。記載内容は現在のコードベースに基づきます。

---

## 概要

クライアントサイドのみで動作するシングルページアプリケーションです。  
状態は `Store` に集約し、`Renderer` が Canvas を描画します。入力は `Input` が受け取り、操作は `App` が実行します。

```
index.html
  ├── data.js      定数・建物・部屋ルール
  ├── store.js     状態 + Undo/Redo + 永続化
  ├── rooms.js     部屋検出（純粋ロジック）
  ├── renderer.js  Canvas 描画
  ├── ui.js        DOM 更新
  ├── input.js     入力処理
  └── app.js       オーケストレーション
```

---

## data.js — 静的データ

### グリッド定数

| シンボル | 値 | 用途 |
|----------|-----|------|
| `GRID_COLS` | 40 | 列数（0 始まり） |
| `GRID_ROWS` | 30 | 行数 |
| `CELL_SIZE` | 18 | zoom=1 時の 1 タイル px |
| `POD_COL`, `POD_ROW` | 18, 13 | 製造ポッド原点 |

### レイヤー

```javascript
LAYER_ORDER = ["base", "plumbing", "gas", "electrical", "automation"]

LAYERS[layerId] = { name, color, alpha, dimAlpha }
```

非アクティブレイヤーは `layerVisible` が true のとき `dimAlpha` で重ね描画されます。`base` は常に描画対象です。

### 建物マスタ

```javascript
BUILDINGS = {
  "カテゴリ名": { layer: "base"|..., items: [Building, ...] }
}
```

**Building プロパティ**

| プロパティ | 説明 |
|------------|------|
| `id` | 一意 ID（部屋判定・`BUILDING_MAP` 用） |
| `name`, `color`, `icon` | 表示 |
| `w`, `h` | タイルサイズ |
| `power` | 正=発電 W / 負=消費 W |
| `oxygen` | 酸素 g/s |
| `food` | 食料 kcal/cycle |
| `water` | 正=生産 / 負=消費 kg/s |
| `solid` | 壁扱い（部屋境界） |
| `isDoor` | ドア扱い（境界として閉じるが内部は通過不可） |
| `isGeyser` | 間欠泉フラグ |
| `fixed` | 削除不可（製造ポッド） |

**その他のエクスポート**

| シンボル | 説明 |
|----------|------|
| `PRINTING_POD` | 製造ポッド定義（4×4, `fixed: true`） |
| `BUILDING_MAP` | `id → Building` 逆引き |
| `CAT_COLORS` | カテゴリ凡例色 |
| `ROOM_TYPES` | 部屋タイプ判定ルール（13 種） |

### 部屋タイプ（`ROOM_TYPES`）

兵舎・寝室・大広間・洗面所・トイレ・厨房・農場・娯楽室・研究室・病院・牧場・発電所・自然保護区。

各タイプは以下で判定されます。

- `minTiles` / `maxTiles` — 内部空気セル数
- `required` — いずれか 1 つ必須（OR）
- `forbidden` — 1 つでもあれば不成立

---

## store.js — 状態管理

### 状態（`getState()`）

| フィールド | 初期値 | 説明 |
|------------|--------|------|
| `zoom` | 1 | 0.15〜6（`app.js` でクランプ） |
| `panX`, `panY` | 40, 20 | ビューポートオフセット |
| `tool` | `"place"` | `"place"` \| `"erase"` |
| `selectedBuilding` | null | パレット選択中の建物 |
| `activeLayer` | `"base"` | 編集中レイヤー |
| `clipboard` | null | コピーした建物（原点オブジェクト） |
| `layers` | 5 レイヤー分の `{}` | セル辞書 `"col,row" → building` |
| `layerVisible` | 全非 base = true | 重ね表示フラグ |
| `detectedRooms` | `[]` | `RoomDetector.detect()` の結果 |
| `highlightedRoom` | null | 部屋リストで選択中のインデックス |
| `lastMouse` | null | ホバープレビュー用 `{x,y}` |
| `rightClick` | `{col:-1,...}` | コンテキストメニュー座標 |

起動時 `_placePrintingPod()` で `base` レイヤーに製造ポッドを配置します。

### 公開 API

| メソッド | 説明 |
|----------|------|
| `getState()` / `setState(patch)` | 状態の読み書き |
| `getLayerGrid(layerKey)` | ミュータブルなセル辞書 |
| `setCell(layer, key, value)` | セル更新（履歴なし） |
| `beginStroke(layer, label)` | ストローク開始 |
| `recordCellDiff(key, before, after)` | ストローク内 diff 記録 |
| `commitStroke()` | ストロークを 1 コマンドとして確定 |
| `pushCommand(label, layer, diffs)` | 単発コマンド記録（全消去・読込等） |
| `undo()` / `redo()` | 履歴操作 |
| `canUndo()` / `canRedo()` | 可否 |
| `getHistoryInfo()` | `{ undoCount, redoCount, lastLabel, nextLabel }` |
| `serialize()` | `{ version: 2, layers }` |
| `deserialize(data)` | v2 または旧 `{ grid }` 形式を読込 |
| `clearActiveLayer()` | アクティブレイヤー削除（base 時はポッド再配置） |
| `resetLayers()` | 全レイヤーリセット + ポッド再配置 |

### Undo/Redo 設計

- **コマンドパターン + セル差分** — 変更セルのみ記録
- **上限** — `HISTORY_LIMIT = 100`
- **ストローク** — `beginStroke` → 複数 `recordCellDiff` → `commitStroke` で 1 操作
- **multi レイヤー** — `pushCommand(..., "multi", diffs)`、`diff` ごとに `layer` フィールド

```javascript
// CellDiff
{ key: "col,row", layer: "base", before: object|null, after: object|null }
```

---

## rooms.js — 部屋検出

`RoomDetector.detect()` — 引数なし。`Store` の `base` レイヤーを参照。

### アルゴリズム

1. グリッドを走査
2. `solid` でも `isDoor` でもないセルから BFS（`floodFill`）
3. 4 マス未満はスキップ
4. `isEnclosed` — 外周が solid / door / 領域内のみなら閉鎖
5. 領域内の建物 `id` を収集し `ROOM_TYPES` と照合（`classifyRoom`）

### 返却値

```javascript
{
  cells: [[col, row], ...],
  size: number,
  buildingIds: Set<string>,
  classifications: [{
    type: RoomType,  // ROOM_TYPES の要素（name, color, ...）
    status: "valid" | "size_small" | "size_large" | "missing_required",
    reason: string
  }]
}
```

`ui.js` / `renderer.js` は `classifications` の `status` で色分け表示します。

---

## renderer.js — Canvas 描画

描画順:

1. 背景 `#0d1018`
2. グリッド線（5 マスごと強調）
3. 部屋ハイライト（valid=緑 / partial=橙 / その他=灰）
4. 非アクティブレイヤー（`dimAlpha`）
5. アクティブレイヤー（`alpha`）
6. グリッド境界（アクティブレイヤー色）
7. 配置プレビュー（範囲内=青 / 範囲外=赤）

**公開 API:** `init`, `resize`, `draw`, `toGrid`

---

## ui.js — DOM 更新

| 関数 | 役割 |
|------|------|
| `buildSidebar(layer)` | 建物パレット・凡例構築 |
| `updateStats()` | 統計パネル・レイヤーカウント |
| `updateRoomPanel(rooms)` | 部屋リスト |
| `switchLayer` / `setTool` | ツールバー状態 |
| `updateUndoButtons` / `updateZoomLabel` | ボタン・ラベル |
| `showContextMenu` / `hideContextMenu` | 右クリックメニュー |
| `showToast` | 通知 |

統計は全レイヤーを走査し、`ref` と `fixed` を除く建物を集計します。

---

## input.js — 入力

Pointer Events でマウス・タッチ・ペンを統一処理。

| 入力 | 動作 |
|------|------|
| 1 本指 / 左クリック | 配置・消去 |
| 2 本指 | ピンチズーム + パン |
| 中ボタン / Space+drag | パン |
| 右クリック / 500ms 長押し | コンテキストメニュー |
| ホイール | ズーム |
| WASD / 矢印 | パン（RAF ループ） |
| キーボード | レイヤー・ツール・Undo/Redo・ペースト等 |

ミニマップ（140px 幅）で全体俯瞰とビューポート移動。

---

## app.js — オーケストレーション

| 処理 | 説明 |
|------|------|
| `placeBuilding` / `eraseBuilding` | 配置・消去（マルチタイル対応） |
| `clearActiveLayerWithHistory` | 確認後、レイヤー全消去 |
| `saveColony` / `loadColony` | JSON 入出力 |
| `performUndo` / `performRedo` | 履歴操作 + UI 更新 |
| `applyZoom` / `fitView` | ズーム・全体表示 |
| `init` | モジュール初期化、`DOMContentLoaded` |

編集のたび `_afterEdit()` で統計更新・部屋再検出・再描画・ミニマップ更新を行います。

---

## セルデータモデル（ランタイム）

```javascript
// 原点セル
{ id, name, w, h, color, icon, power, oxygen, food, water, solid?, isDoor?, fixed?, layer? }

// 副タイル
{ ...building, ref: "originCol,originRow" }
```

---

## レスポンシブ

| 条件 | 変更 |
|------|------|
| ≤ 1024px | サイドバー縮小、トップバーラベル非表示 |
| ≤ 767px | サイドバー・右パネル非表示、ボトムバー + パレットドロワー |
| ≤ 767px landscape | ボトムバー非表示、狭いサイドバー表示 |

---

## 変更時の参照先

| 変更内容 | ファイル |
|----------|----------|
| 建物・定数・部屋ルール | `data.js` |
| 状態・履歴・保存形式 | `store.js` |
| 部屋検出ロジック | `rooms.js` |
| 描画 | `renderer.js` |
| 入力・ショートカット | `input.js` |
| UI レイアウト | `index.html`, `style.css`, `ui.js` |

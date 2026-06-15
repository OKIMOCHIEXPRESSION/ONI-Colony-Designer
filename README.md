# ONI Colony Designer

**Oxygen Not Included（酸素が足りない）** 向けの Web ベース拠点設計ツールです。  
40×30 タイルのグリッド上に建物を配置し、5 レイヤーで拠点を計画できます。部屋判定と資源統計をリアルタイムで確認できます。

> 本プロジェクトは Klei Entertainment とは無関係の非公式ファンツールです。

---

## 主な機能

| 機能 | 説明 |
|------|------|
| **マルチレイヤー編集** | 基本 / 配管 / ガス管 / 電気 / 自動化の 5 レイヤー |
| **建物パレット** | 12 カテゴリ・約 100 種の建物、検索フィルター |
| **配置・消去** | ドラッグによる連続配置・消去、配置プレビュー |
| **Undo / Redo** | 最大 100 ステップの操作履歴（ストローク単位） |
| **コピー・ペースト** | 右クリックメニューでコピー、`V` キーでペースト |
| **部屋検出** | タイルで囲まれた空間を検出し、13 種類の部屋タイプを判定 |
| **統計パネル** | 電力収支・酸素生産・食料・水消費を集計 |
| **保存・読込** | JSON（`oni-colony.json`）のエクスポート / インポート |
| **ビュー操作** | ズーム・パン・全体表示（F）、ミニマップ |
| **レイヤー表示切替** | 非アクティブレイヤー（配管〜自動化）の重ね表示 ON/OFF |
| **レスポンシブ UI** | デスクトップ・タブレット・スマートフォン対応 |

起動時、グリッド中央付近（18, 13）に **製造ポッド（4×4）** が自動配置されます。削除はできません。

---

## クイックスタート

### 必要環境

- モダンブラウザ（Chrome / Firefox / Edge / Safari 最新版）
- ローカル HTTP サーバー（`file://` 直開きは非推奨）
- Tabler Icons CDN へのネットワーク接続（UI アイコン用）

### 起動方法

```bash
# 例: Python 3
python -m http.server 8080

# 例: Node.js (npx)
npx serve .
```

ブラウザで `http://localhost:8080` を開いてください。

---

## 操作ガイド

### マウス・タッチ

| 操作 | 動作 |
|------|------|
| 左クリック / 1 本指タップ | 配置 or 消去（ツールによる） |
| ドラッグ | 連続配置 / 消去 |
| 右クリック / 長押し (500ms) | コンテキストメニュー（削除・コピー） |
| 中ボタン / Space + ドラッグ | パン |
| ホイール | ズーム（カーソル位置を中心、0.15〜6 倍） |
| 2 本指ピンチ | ズーム + パン |
| ミニマップクリック | ビューポート移動 |

### キーボードショートカット

| キー | 動作 |
|------|------|
| `1`〜`5` | レイヤー切替 |
| `P` | 配置ツール |
| `E` | 消去ツール |
| `F` | 全体表示 |
| `WASD` / 矢印キー | パン |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `V` | クリップボードからペースト |
| `Esc` | 建物選択解除 |

---

## プロジェクト構成

```
oni-blueprint-designer/
├── index.html      # UI レイアウト
├── style.css       # スタイル（ダークテーマ・レスポンシブ）
├── data.js         # 定数・建物マスタ・部屋タイプ定義
├── store.js        # 状態管理・Undo/Redo・シリアライズ
├── rooms.js        # 部屋検出エンジン
├── renderer.js     # Canvas 描画
├── ui.js           # DOM 更新・パネル
├── input.js        # Pointer Events・キーボード入力
├── app.js          # ビジネスロジック・初期化
└── docs/
    └── ARCHITECTURE.md
```

### モジュール依存関係

```
data.js → store.js → rooms.js → renderer.js → ui.js → input.js → app.js
```

---

## 保存ファイル形式

保存ボタンで `oni-colony.json` がダウンロードされます。

```json
{
  "version": 2,
  "layers": {
    "base": { "18,13": { "id": "printing_pod", "name": "製造ポッド", "w": 4, "h": 4, ... } },
    "plumbing": {},
    "gas": {},
    "electrical": {},
    "automation": {}
  }
}
```

- 各セルキーは `"列,行"` 形式
- 複数タイル建物は原点セルに本体、他セルに `ref: "列,行"` で参照
- 旧形式（`{ grid: {...} }` のみ）も読込時に `base` レイヤーとして互換処理されます

---

## 技術スタック

- Vanilla JavaScript（IIFE モジュール、ビルド不要）
- HTML5 Canvas 2D
- Pointer Events API
- [Tabler Icons](https://tabler.io/icons)（CDN）

---

## 開発メモ

### 建物の追加

`data.js` の `BUILDINGS` にエントリを追加します。部屋判定で使う場合は `id` を `ROOM_TYPES` の `required` / `forbidden` と整合させてください。

```javascript
{
  id: "electrolyzer",
  name: "電解装置",
  w: 2, h: 2,
  color: "#4a90d9",
  icon: "O₂",
  power: -120, oxygen: 888, food: 0, water: -1,
  solid: false,   // true = 壁扱い（部屋境界）
  isDoor: false,  // true = ドア扱い
}
```

### レイヤー

| ID | 名称 |
|----|------|
| `base` | 基本 |
| `plumbing` | 配管 |
| `gas` | ガス管 |
| `electrical` | 電気 |
| `automation` | 自動化 |

### グリッド定数（`data.js`）

| 定数 | 値 |
|------|-----|
| `GRID_COLS` | 40 |
| `GRID_ROWS` | 30 |
| `CELL_SIZE` | 18 px（zoom = 1 時） |

---

## 関連ドキュメント

- [アーキテクチャ詳細](docs/ARCHITECTURE.md)

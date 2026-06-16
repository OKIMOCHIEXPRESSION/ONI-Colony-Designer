# ONI Colony Designer

Oxygen Not Included 用のコロニー設計・レイアウト作成ツールです。

ブラウザ上で建築物を配置し、コロニー構造を事前設計できます。

## 現在の実装状況

### 建築物データベース

* 建築物216件を実装
* Oxygen Not Included Base Game 対応
* 英語名 (`name_en`) / 日本語名 (`name_ja`) 対応
* カテゴリ分類対応
* 建築物サイズ（width / height）対応
* 建築物ごとの配置原点 (`origin: "bottom_right"`) 対応

### 配置システム

* グリッド配置
* 建築物選択
* 複数サイズ建築物対応
* Bottom Right アンカー配置
* 既存保存形式との互換性維持

### レイヤー

実装済み:

* Building Layer
* Power Layer
* Gas Layer
* Liquid Layer
* Room Layer

### データ構造

建築物データは以下の形式で管理されています。

```javascript
{
  id: "electrolyzer",
  category: "Oxygen",
  name_en: "Electrolyzer",
  name_ja: "電解装置",
  width: 2,
  height: 2,
  origin: "bottom_right",
  icon: "electrolyzer"
}
```

## データソース

建築物マスターは `building_master.xlsx` を唯一の正として管理しています。

反映済み内容:

* Category
* English Name
* Japanese Name
* Width
* Height

## 今後の予定

### 優先度高

* 建築物設置ルール実装
* 特殊建築物制約実装
* 建築物検証機能

対象例:

* Steam Turbine
* Bunker Door
* Travel Tube
* Monument

### 優先度中

* ポート情報データベース
* 配管接続可視化
* ガス接続可視化
* 電力接続可視化
* Automation接続可視化

### 優先度低

* 建築物アイコン実装
* UI改善
* テンプレート拡充

## 開発方針

* `building_master.xlsx` を唯一の正とする
* 英語名を内部基準とする
* 日本語表示切替に対応する
* 保存データの後方互換性を維持する
* Oxygen Not Included 実ゲーム仕様を優先する

## ライセンス

This project is a fan-made planning tool for Oxygen Not Included.

Oxygen Not Included is © Klei Entertainment.

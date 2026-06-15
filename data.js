// ============================================================
// data.js — 静的データ定義（ゲーム内データ・定数）
// 追加・変更はこのファイルだけで完結する
// ============================================================

// ── グリッド定数 ─────────────────────────────────────────────
const GRID_COLS = 40;
const GRID_ROWS = 30;
const CELL_SIZE = 18; // px（zoom=1 のときの1マスサイズ）

// 製造ポッドの固定配置位置（グリッド中央寄り）
const POD_COL = 18;
const POD_ROW = 13;

// ── レイヤー定義 ─────────────────────────────────────────────
// alpha      : アクティブ時の描画不透明度
// dimAlpha   : 非アクティブ時の重ね表示不透明度
const LAYERS = {
  base:       { name: "基本",   color: "#a0a8b8", alpha: 1.0,  dimAlpha: 0.18 },
  plumbing:   { name: "配管",   color: "#4a9adf", alpha: 0.92, dimAlpha: 0.15 },
  gas:        { name: "ガス管", color: "#6ac87a", alpha: 0.92, dimAlpha: 0.15 },
  electrical: { name: "電気",   color: "#f0c040", alpha: 0.92, dimAlpha: 0.15 },
  automation: { name: "自動化", color: "#c060e0", alpha: 0.92, dimAlpha: 0.15 },
};

// レイヤーの描画順（bottom → top）
const LAYER_ORDER = ["base", "plumbing", "gas", "electrical", "automation"];

// ── 製造ポッド（固定・削除不可） ─────────────────────────────
const PRINTING_POD = {
  id: "printing_pod",
  name: "製造ポッド",
  color: "#ff6a00",
  icon: "🔴",
  w: 4, h: 4,
  power: 0, oxygen: 0, food: 0, water: 0,
  fixed: true,
  layer: "base",
  solid: false,
};

// ── 建物データ ───────────────────────────────────────────────
// 各カテゴリ: { layer: レイヤーキー, items: [建物, ...] }
//
// 建物プロパティ:
//   id, name, color, icon  : 表示用
//   w, h                   : ゲーム内セルサイズ
//   power                  : 正=発電量W / 負=消費量W
//   oxygen                 : 酸素生産 g/s
//   food                   : 食料生産 kcal/cycle
//   water                  : 正=水生産 / 負=水消費 kg/s
//   solid   (bool)         : 壁・タイル扱い（部屋判定に使用）
//   isDoor  (bool)         : ドア扱い（境界として壁判定するが通路）
//   isGeyser(bool)         : 間欠泉・火山フラグ
//   fixed   (bool)         : 削除不可（製造ポッドのみ）
//
const BUILDINGS = {

  // ────────── baseレイヤー ──────────

  "基本": { layer: "base", items: [
    { id: "ladder",       name: "梯子",             color: "#7c7c7c", icon: "↕",  w: 1, h: 1, power:    0, oxygen:   0, food:    0, water:    0, solid: false },
    { id: "tile",         name: "タイル",           color: "#5a6475", icon: "▪",  w: 1, h: 1, power:    0, oxygen:   0, food:    0, water:    0, solid: true  },
    { id: "mesh_tile",    name: "メッシュタイル",   color: "#8a9475", icon: "▫",  w: 1, h: 1, power:    0, oxygen:   0, food:    0, water:    0, solid: true  },
    { id: "tile_bunker",  name: "バンカータイル",   color: "#4a5060", icon: "█",  w: 1, h: 1, power:    0, oxygen:   0, food:    0, water:    0, solid: true  },
    { id: "tile_glass",   name: "ガラスタイル",     color: "#a0c8e0", icon: "▪",  w: 1, h: 1, power:    0, oxygen:   0, food:    0, water:    0, solid: true  },
    { id: "door",         name: "ドア",             color: "#8b6914", icon: "🚪", w: 1, h: 2, power:    0, oxygen:   0, food:    0, water:    0, solid: true,  isDoor: true },
    { id: "airlock",      name: "エアロック",       color: "#6a5acd", icon: "⊞",  w: 2, h: 3, power:    0, oxygen:   0, food:    0, water:    0, solid: true,  isDoor: true },
    { id: "travel_tube",  name: "トラベルチューブ", color: "#4a9acd", icon: "⟶",  w: 1, h: 1, power:  -10, oxygen:   0, food:    0, water:    0, solid: false },
  ]},

  "酸素": { layer: "base", items: [
    { id: "electrolyzer", name: "電解装置",       color: "#4a90d9", icon: "O₂", w: 2, h: 2, power: -120, oxygen: 888, food:  0, water:  -1, solid: false },
    { id: "algae_deox",   name: "藻類脱酸素機",   color: "#5aad5a", icon: "🌿", w: 1, h: 2, power:  -60, oxygen:  40, food:  0, water:   0, solid: false },
    { id: "rust_deox",    name: "錆脱酸素機",     color: "#c87941", icon: "⚗",  w: 2, h: 2, power:    0, oxygen:  90, food:  0, water:   0, solid: false },
    { id: "deodorizer",   name: "脱臭機",         color: "#d4a017", icon: "💨", w: 1, h: 2, power:    0, oxygen:   0, food:  0, water:   0, solid: false },
    { id: "air_filter",   name: "エアフィルター", color: "#709090", icon: "⊛",  w: 2, h: 2, power: -120, oxygen:   0, food:  0, water:   0, solid: false },
  ]},

  "電力": { layer: "base", items: [
    { id: "manual_gen",    name: "手動発電機",           color: "#e08c2b", icon: "⚡", w: 2, h: 2, power:  400, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "coal_gen",      name: "石炭発電機",           color: "#666666", icon: "🔥", w: 4, h: 3, power:  600, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "hamster_wheel", name: "ハムスターホイール",   color: "#c8b400", icon: "🐹", w: 2, h: 2, power:  400, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "nat_gas_gen",   name: "天然ガス発電機",       color: "#4db8d0", icon: "♨",  w: 4, h: 3, power:  800, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "petroleum_gen", name: "石油発電機",           color: "#303030", icon: "⛽", w: 4, h: 3, power: 2000, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "wood_gen",      name: "木材発電機",           color: "#805030", icon: "🌲", w: 4, h: 3, power:  300, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "hydrogen_gen",  name: "水素発電機",           color: "#80a0f0", icon: "H₂", w: 4, h: 3, power:  800, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "solar_panel",   name: "ソーラーパネル",       color: "#f0d040", icon: "☀",  w: 8, h: 2, power:  380, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "steam_turbine", name: "蒸気タービン",         color: "#c0a050", icon: "⚙",  w: 5, h: 4, power:  850, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "battery",       name: "バッテリー",           color: "#9b8dc0", icon: "🔋", w: 1, h: 2, power:    0, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "smart_battery", name: "スマートバッテリー",   color: "#7070c8", icon: "⊕",  w: 1, h: 2, power:    0, oxygen: 0, food: 0, water: 0, solid: false },
  ]},

  "食料": { layer: "base", items: [
    { id: "farm_tile",      name: "農場タイル",         color: "#6aad3a", icon: "🌱", w: 2, h: 1, power:  -20, oxygen: 0, food: 1600, water: -0.22, solid: false },
    { id: "hydroponic",     name: "水耕栽培タイル",     color: "#3aad8a", icon: "💧", w: 2, h: 2, power: -120, oxygen: 0, food: 2000, water:  -0.5, solid: false },
    { id: "grill",          name: "電気グリル",         color: "#d47a2a", icon: "🍳", w: 2, h: 2, power:  -60, oxygen: 0, food: 4000, water:     0, solid: false },
    { id: "microbe_musher", name: "微生物餌製造機",     color: "#8a5a9a", icon: "🧫", w: 2, h: 2, power: -120, oxygen: 0, food: 2400, water:    -1, solid: false },
    { id: "bbq",            name: "バーベキューグリル", color: "#b05020", icon: "🥩", w: 2, h: 2, power:    0, oxygen: 0, food: 3200, water:     0, solid: false },
    { id: "egg_cracker",    name: "エッグクラッカー",   color: "#e8d880", icon: "🥚", w: 3, h: 3, power: -120, oxygen: 0, food:    0, water:     0, solid: false },
    { id: "refrigerator",   name: "冷蔵庫",             color: "#5080c0", icon: "❄",  w: 1, h: 3, power: -120, oxygen: 0, food:    0, water:     0, solid: false },
    { id: "dining_table",   name: "食卓",               color: "#c09050", icon: "🍽", w: 4, h: 2, power:    0, oxygen: 0, food:    0, water:     0, solid: false },
  ]},

  "デュプ設備": { layer: "base", items: [
    { id: "cot",              name: "コット",             color: "#b09070", icon: "🛏", w: 4, h: 2, power:    0, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "bed_luxury",       name: "高級ベッド",         color: "#7060d0", icon: "🛏", w: 4, h: 2, power:  -60, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "recreation",       name: "娯楽設備",           color: "#d070a0", icon: "🎮", w: 3, h: 3, power:  -60, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "massage_table",    name: "マッサージ台",       color: "#c060b0", icon: "💆", w: 4, h: 2, power:  -60, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "espresso_machine", name: "エスプレッソマシン", color: "#805040", icon: "☕", w: 2, h: 2, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "research",         name: "研究台",             color: "#7090d0", icon: "🔬", w: 4, h: 3, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "research_advanced",name: "超高等研究台",       color: "#5070f0", icon: "🧪", w: 4, h: 3, power: -240, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "telescope",        name: "天体望遠鏡",         color: "#6080c0", icon: "🔭", w: 4, h: 4, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "storage",          name: "収納コンテナ",       color: "#a08060", icon: "📦", w: 2, h: 2, power:    0, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "med_bay",          name: "医療ベッド",         color: "#d04060", icon: "⛑",  w: 3, h: 3, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "triage",           name: "トリアージ台",       color: "#c06080", icon: "💊", w: 2, h: 2, power:    0, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "sick_bay",         name: "診療台",             color: "#e04070", icon: "🏥", w: 4, h: 3, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "grooming_station", name: "お手入れ台",         color: "#a07040", icon: "✂",  w: 3, h: 3, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "shearing_machine", name: "毛刈り機",           color: "#906030", icon: "✄",  w: 4, h: 3, power: -120, oxygen: 0, food: 0, water: 0, solid: false },
  ]},

  "水・液体": { layer: "base", items: [
    { id: "sink",         name: "洗い場",           color: "#5090c8", icon: "🚿", w: 2, h: 2, power: -120, oxygen: 0, food: 0, water: -0.2, solid: false },
    { id: "toilet",       name: "トイレ",           color: "#8080c0", icon: "🚽", w: 1, h: 3, power:    0, oxygen: 0, food: 0, water:    0, solid: false },
    { id: "outhouse",     name: "簡易トイレ",       color: "#907060", icon: "🚽", w: 2, h: 3, power:    0, oxygen: 0, food: 0, water:    0, solid: false },
    { id: "lavatory",     name: "洗面台",           color: "#60a0c0", icon: "🪥", w: 2, h: 3, power: -120, oxygen: 0, food: 0, water: -0.5, solid: false },
    { id: "liquid_pump",  name: "液体ポンプ",       color: "#3070a8", icon: "⊕",  w: 2, h: 2, power: -240, oxygen: 0, food: 0, water:    0, solid: false },
    { id: "liquid_pipe",  name: "液体パイプ",       color: "#4080b8", icon: "─",  w: 1, h: 1, power:    0, oxygen: 0, food: 0, water:    0, solid: false },
    { id: "water_sieve",  name: "汚染水フィルター", color: "#4480a8", icon: "⋒",  w: 2, h: 2, power: -120, oxygen: 0, food: 0, water:    1, solid: false },
    { id: "desalinator",  name: "脱塩装置",         color: "#3060d8", icon: "🌊", w: 4, h: 3, power: -480, oxygen: 0, food: 0, water:    1, solid: false },
  ]},

  "温度・ガス": { layer: "base", items: [
    { id: "thermo_reg",   name: "温調装置",         color: "#a04030", icon: "🌡", w: 2, h: 2, power:  -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "space_heater", name: "スペースヒーター", color: "#d06030", icon: "♨",  w: 1, h: 2, power:  -120, oxygen: 0, food: 0, water: 0, solid: false },
    { id: "aquatuner",    name: "アクアチューナー", color: "#4080c0", icon: "❄",  w: 2, h: 2, power: -1200, oxygen: 0, food: 0, water: 0, solid: false },
  ]},

  "間欠泉": { layer: "base", items: [
    { id: "geyser_water",          name: "水の間欠泉",        color: "#3a8fd9", icon: "💧", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_polluted_water", name: "汚染水の間欠泉",    color: "#7a9a50", icon: "🤢", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_saltwater",      name: "塩水の間欠泉",      color: "#3a6ab0", icon: "🌊", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_slushwater",     name: "スラッシュ水",      color: "#60c0d8", icon: "🧊", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_cool_slush",     name: "冷却スラッシュ",    color: "#50a0c0", icon: "❄",  w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_cool_steam",     name: "冷却蒸気孔",        color: "#a0c8d0", icon: "☁",  w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_steam",          name: "蒸気孔",            color: "#d0b8a0", icon: "♨",  w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_hot_steam",      name: "高温蒸気孔",        color: "#d09080", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_nat_gas",        name: "天然ガス孔",        color: "#4dc8b0", icon: "⛽", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_hydrogen",       name: "水素間欠泉",        color: "#8090f0", icon: "H₂", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_co2",            name: "CO₂孔",             color: "#607060", icon: "CO₂",w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_polluted_o2",    name: "汚染酸素孔",        color: "#a0b840", icon: "PO₂",w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_chlorine",       name: "塩素孔",            color: "#c0d040", icon: "Cl₂",w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "geyser_oil",            name: "油田",              color: "#303030", icon: "🛢", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_iron",          name: "鉄火山",            color: "#c04820", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_copper",        name: "銅火山",            color: "#b06020", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_gold",          name: "金火山",            color: "#d0a020", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_aluminum",      name: "アルミ火山",        color: "#a0a8b0", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_cobalt",        name: "コバルト火山",      color: "#4060c0", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_tungsten",      name: "タングステン火山",  color: "#707878", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_niobium",       name: "ニオブ火山",        color: "#8060a0", icon: "🌋", w: 4, h: 2, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
    { id: "volcano_main",          name: "火山",              color: "#e03010", icon: "🌋", w: 4, h: 4, power: 0, oxygen: 0, food: 0, water: 0, isGeyser: true, solid: true },
  ]},

  // ────────── plumbingレイヤー ──────────

  "液体パイプ": { layer: "plumbing", items: [
    { id: "liquid_pipe2",     name: "液体パイプ",     color: "#4a9adf", icon: "━", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_pipe_ins",  name: "断熱液体パイプ", color: "#2060a0", icon: "┅", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_pump2",     name: "液体ポンプ",     color: "#3070a8", icon: "⊕", w: 2, h: 2, power: -240, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_mini_pump", name: "液体ミニポンプ", color: "#5080b0", icon: "⊙", w: 1, h: 2, power: -120, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_valve",     name: "液体バルブ",     color: "#4080c0", icon: "⊘", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_bridge",    name: "液体ブリッジ",   color: "#3870b0", icon: "╬", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_vent",      name: "液体ベント",     color: "#5090c0", icon: "↓", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "liquid_reservoir", name: "液体リザーバー", color: "#3060a8", icon: "🪣", w: 4, h: 3, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "bottle_emptier",   name: "ボトル空注機",   color: "#4878b0", icon: "🫙", w: 1, h: 2, power:    0, oxygen: 0, food: 0, water: 0 },
  ]},

  // ────────── gasレイヤー ──────────

  "ガスパイプ": { layer: "gas", items: [
    { id: "gas_pipe",      name: "ガスパイプ",     color: "#6ac87a", icon: "━", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_pipe_ins",  name: "断熱ガスパイプ", color: "#408850", icon: "┅", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_pump",      name: "ガスポンプ",     color: "#50a860", icon: "⊕", w: 2, h: 2, power: -240, oxygen: 0, food: 0, water: 0 },
    { id: "gas_mini_pump", name: "ガスミニポンプ", color: "#60b870", icon: "⊙", w: 1, h: 2, power: -120, oxygen: 0, food: 0, water: 0 },
    { id: "gas_valve",     name: "ガスバルブ",     color: "#5ab06a", icon: "⊘", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_bridge",    name: "ガスブリッジ",   color: "#48a058", icon: "╬", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_vent",      name: "ガスベント",     color: "#70c880", icon: "↑", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_vent_high", name: "高圧ガスベント", color: "#90d898", icon: "⇑", w: 1, h: 1, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_reservoir", name: "ガスリザーバー", color: "#3a8848", icon: "🫧", w: 4, h: 3, power:    0, oxygen: 0, food: 0, water: 0 },
    { id: "gas_filter",    name: "ガスフィルター", color: "#70a870", icon: "⧖", w: 2, h: 2, power: -120, oxygen: 0, food: 0, water: 0 },
  ]},

  // ────────── electricalレイヤー ──────────

  "電気配線": { layer: "electrical", items: [
    { id: "wire",           name: "電線（通常）", color: "#c8a030", icon: "━", w: 1, h: 1, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "wire_refined",   name: "精錬金属電線", color: "#e0c050", icon: "━", w: 1, h: 1, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "wire_heavy",     name: "重電線",       color: "#d08820", icon: "═", w: 1, h: 1, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "wire_conductive",name: "伝導性電線",   color: "#f0d060", icon: "╌", w: 1, h: 1, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "transformer",    name: "変圧器（大）", color: "#7070c8", icon: "⊛", w: 2, h: 2, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "transformer_sm", name: "変圧器（小）", color: "#8080d0", icon: "⊚", w: 1, h: 2, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "wire_bridge",    name: "電気ブリッジ", color: "#b09030", icon: "╬", w: 1, h: 1, power: 0, oxygen: 0, food: 0, water: 0 },
    { id: "power_switch",   name: "電源スイッチ", color: "#d0a040", icon: "⏻", w: 1, h: 1, power: 0, oxygen: 0, food: 0, water: 0 },
  ]},

  // ────────── automationレイヤー ──────────

  "自動化": { layer: "automation", items: [
    { id: "auto_wire",       name: "自動化ワイヤー",   color: "#c060e0", icon: "━", w: 1, h: 1, power:   0, oxygen: 0, food: 0, water: 0 },
    { id: "auto_bridge",     name: "自動化ブリッジ",   color: "#a040c0", icon: "╬", w: 1, h: 1, power:   0, oxygen: 0, food: 0, water: 0 },
    { id: "hydro_sensor",    name: "水位センサー",     color: "#4090e0", icon: "〰", w: 1, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "thermo_sensor",   name: "温度センサー",     color: "#e05030", icon: "🌡", w: 1, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "atmo_sensor",     name: "気圧センサー",     color: "#60c090", icon: "◉", w: 1, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "element_sensor",  name: "属性センサー",     color: "#9070d0", icon: "◈", w: 1, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "logic_gate_and",  name: "AND ゲート",       color: "#a050d0", icon: "&",  w: 2, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "logic_gate_or",   name: "OR ゲート",        color: "#b050d0", icon: "≥1", w: 2, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "logic_gate_not",  name: "NOT ゲート",       color: "#c050d0", icon: "!",  w: 1, h: 1, power: -10, oxygen: 0, food: 0, water: 0 },
    { id: "signal_switch",   name: "シグナルスイッチ", color: "#d070f0", icon: "⏎",  w: 1, h: 2, power:   0, oxygen: 0, food: 0, water: 0 },
  ]},
};

// id → 建物オブジェクト の逆引きマップ（rooms.js で使用）
const BUILDING_MAP = (() => {
  const map = {};
  for (const def of Object.values(BUILDINGS)) {
    for (const b of def.items) map[b.id] = b;
  }
  return map;
})();

// カテゴリ名 → 代表カラー（サイドバー凡例用）
const CAT_COLORS = {
  "基本":     "#a0a8b8",
  "酸素":     "#4a90d9",
  "電力":     "#e08c2b",
  "食料":     "#6aad3a",
  "デュプ設備": "#8080c0",
  "水・液体": "#3070a8",
  "温度・ガス": "#a04030",
  "間欠泉":   "#e03010",
  "液体パイプ": "#4a9adf",
  "ガスパイプ": "#6ac87a",
  "電気配線": "#f0c040",
  "自動化":   "#c060e0",
};

// ── 部屋タイプ定義 ───────────────────────────────────────────
// required   : いずれか1つ含まれればOK（OR条件）
// forbidden  : 1つでも含まれていたらその部屋タイプは不成立
// minTiles   : 内部空気セル数の最小値
// maxTiles   : 内部空気セル数の最大値
const ROOM_TYPES = [
  {
    id: "barracks", name: "兵舎", color: "#6060c0",
    minTiles: 12, maxTiles: 96,
    required:  ["cot", "bed_luxury"],
    forbidden: ["toilet","lavatory","sink","grill","microbe_musher","bbq","egg_cracker","farm_tile","hydroponic","research","research_advanced","telescope"],
    desc: "コット必須・最大96マス",
  },
  {
    id: "bedroom", name: "寝室", color: "#4050d0",
    minTiles: 12, maxTiles: 96,
    required:  ["bed_luxury"],
    forbidden: ["toilet","lavatory","sink","grill","microbe_musher","bbq","egg_cracker","farm_tile","hydroponic","research","research_advanced","telescope","cot"],
    desc: "高級ベッド必須・最大96マス",
  },
  {
    id: "great_hall", name: "大広間", color: "#c07030",
    minTiles: 12, maxTiles: 96,
    required:  ["dining_table"],
    forbidden: ["toilet","lavatory","cot","bed_luxury"],
    desc: "食卓必須・最大96マス",
  },
  {
    id: "washroom", name: "洗面所", color: "#5090c8",
    minTiles: 12, maxTiles: 96,
    required:  ["lavatory","sink"],
    forbidden: ["cot","bed_luxury","grill","microbe_musher","bbq","egg_cracker","farm_tile","hydroponic","research","research_advanced","telescope"],
    desc: "洗面台か洗い場が必須",
  },
  {
    id: "latrine", name: "トイレ", color: "#8060c0",
    minTiles: 12, maxTiles: 96,
    required:  ["toilet","outhouse"],
    forbidden: ["cot","bed_luxury","lavatory"],
    desc: "トイレ必須・最大96マス",
  },
  {
    id: "kitchen", name: "厨房", color: "#d07830",
    minTiles: 12, maxTiles: 96,
    required:  ["grill","microbe_musher","bbq","egg_cracker"],
    forbidden: ["cot","bed_luxury","toilet","lavatory","farm_tile","hydroponic","research","research_advanced","telescope"],
    desc: "調理施設必須・最大96マス",
  },
  {
    id: "farm", name: "農場", color: "#50a030",
    minTiles: 12, maxTiles: 96,
    required:  ["farm_tile","hydroponic"],
    forbidden: ["cot","bed_luxury","toilet","lavatory","research","research_advanced","telescope"],
    desc: "農場タイルか水耕栽培タイル必須",
  },
  {
    id: "rec_room", name: "娯楽室", color: "#d060a0",
    minTiles: 12, maxTiles: 96,
    required:  ["recreation","massage_table","espresso_machine"],
    forbidden: ["cot","bed_luxury","toilet","lavatory","farm_tile","hydroponic"],
    desc: "娯楽設備必須・最大96マス",
  },
  {
    id: "lab", name: "研究室", color: "#5070d0",
    minTiles: 12, maxTiles: 96,
    required:  ["research","research_advanced","telescope"],
    forbidden: ["cot","bed_luxury","toilet","lavatory","farm_tile","hydroponic"],
    desc: "研究台か天体望遠鏡必須",
  },
  {
    id: "hospital", name: "病院", color: "#d04060",
    minTiles: 12, maxTiles: 96,
    required:  ["med_bay","triage","sick_bay"],
    forbidden: ["cot","bed_luxury","toilet","lavatory","farm_tile","hydroponic"],
    desc: "医療施設必須・最大96マス",
  },
  {
    id: "stable", name: "牧場", color: "#a06020",
    minTiles: 12, maxTiles: 96,
    required:  ["grooming_station","shearing_machine"],
    forbidden: ["cot","bed_luxury","toilet","lavatory"],
    desc: "お手入れステーション必須",
  },
  {
    id: "power_plant", name: "発電所", color: "#d08020",
    minTiles: 12, maxTiles: 96,
    required:  ["manual_gen","coal_gen","hamster_wheel","nat_gas_gen","solar_panel","steam_turbine","petroleum_gen","wood_gen","hydrogen_gen"],
    forbidden: ["cot","bed_luxury","toilet","lavatory","farm_tile","hydroponic","research","research_advanced"],
    desc: "発電機必須・最大96マス",
  },
  {
    id: "nature_reserve", name: "自然保護区", color: "#308050",
    minTiles: 16, maxTiles: 3600,
    required:  [],
    forbidden: ["tile","mesh_tile","tile_bunker","tile_glass","ladder","airlock","door","travel_tube",
                "electrolyzer","algae_deox","rust_deox","deodorizer","air_filter",
                "manual_gen","coal_gen","hamster_wheel","nat_gas_gen","solar_panel","steam_turbine",
                "battery","smart_battery","farm_tile","hydroponic","grill","microbe_musher","bbq",
                "egg_cracker","refrigerator","sink","toilet","lavatory","liquid_pump","water_sieve",
                "desalinator","thermo_reg","space_heater","aquatuner","cot","bed_luxury",
                "recreation","research","storage","med_bay","triage"],
    desc: "人工物禁止・16〜3600マス",
  },
];

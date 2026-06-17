// ============================================================
// i18n.js — Internationalization (English-first)
//
// Usage:  I18n.t("key")          → string in current language
//         I18n.setLang("ja")     → switch language
//         I18n.getLang()         → "en" | "ja"
//         I18n.applyDOM()        → update all [data-i18n] elements
// ============================================================

const I18n = (() => {

  // ── Translation tables ────────────────────────────────────
  const STRINGS = {
    en: {
      // Topbar
      "topbar.save":        "Save",
      "topbar.load":        "Load",
      "topbar.lang_toggle": "JA",           // shows the OTHER language you'd switch TO

      // Sidebar
      "sidebar.title":      "Building Palette",
      "sidebar.search":     "Search...",
      "sidebar.place":      "Place",
      "sidebar.erase":      "Erase",
      "sidebar.clear":      "Clear Layer",
      "sidebar.hint_pan":   "Pan",
      "sidebar.hint_fit":   "Fit view",
      "sidebar.hint_move":  "Move",

      // Layer tabs
      "layer.base":         "Base",
      "layer.plumbing":     "Plumbing",
      "layer.gas":          "Gas",
      "layer.electrical":   "Electrical",
      "layer.automation":   "Automation",

      // Layer tab visibility label
      "layer.show":         "Show:",

      // Info bar
      "infobar.buildings":  " bldgs",        // suffix: "12 bldgs"
      "infobar.editing":    "Editing: ",
      "infobar.select":     "Select a building",
      "infobar.hint":       "Long-press / Right-click: menu",

      // Right panel tabs
      "panel.stats":        "Stats",
      "panel.rooms":        "Rooms",

      // Stats panel
      "stat.power":         "Power Use",
      "stat.power_gen":     "Generated: ",
      "stat.balance":       "Power Balance",
      "stat.oxygen":        "O₂ Production",
      "stat.food":          "Food Production",
      "stat.water":         "Water Use",

      // Legend
      "legend.title":       "Categories",

      // Rooms panel
      "room.no_rooms":      "Create an enclosed<br>area with tiles to<br>detect rooms",
      "room.unknown":       "Unclassified Space",
      "room.tiles":         " tiles",          // suffix
      "room.valid":         "✓ Valid room",

      // Context menu
      "ctx.delete":         "Delete",
      "ctx.copy":           "Copy",

      // Mobile bottom bar
      "mobile.buildings":   "Buildings",

      // Toasts / confirms
      "toast.pod_locked":   "Printing Pod cannot be deleted",
      "toast.loaded":       "Loaded successfully",
      "toast.load_error":   "Load error",
      "toast.saved":        "Saved",
      "toast.copied":       "Copied: ",
      "confirm.clear":      "Delete all buildings on the current layer?",

      // Room type names (from ROOM_TYPES)
      "room_type.barracks":  "Barracks",
      "room_type.latrine":   "Latrine",
    },

    ja: {
      // Topbar
      "topbar.save":        "保存",
      "topbar.load":        "読込",
      "topbar.lang_toggle": "EN",

      // Sidebar
      "sidebar.title":      "建物パレット",
      "sidebar.search":     "検索...",
      "sidebar.place":      "配置",
      "sidebar.erase":      "消去",
      "sidebar.clear":      "全消去",
      "sidebar.hint_pan":   "パン",
      "sidebar.hint_fit":   "全体表示",
      "sidebar.hint_move":  "移動",

      // Layer tabs
      "layer.base":         "基本",
      "layer.plumbing":     "配管",
      "layer.gas":          "ガス管",
      "layer.electrical":   "電気",
      "layer.automation":   "自動化",

      "layer.show":         "表示:",

      // Info bar
      "infobar.buildings":  "棟",
      "infobar.editing":    "編集中: ",
      "infobar.select":     "建物を選択してください",
      "infobar.hint":       "長押し/右クリック: メニュー",

      // Right panel tabs
      "panel.stats":        "統計",
      "panel.rooms":        "部屋",

      // Stats panel
      "stat.power":         "電力消費",
      "stat.power_gen":     "発電: ",
      "stat.balance":       "電力収支",
      "stat.oxygen":        "酸素生産",
      "stat.food":          "食料生産",
      "stat.water":         "水消費",

      // Legend
      "legend.title":       "カテゴリ",

      // Rooms panel
      "room.no_rooms":      "タイルで囲まれた<br>エリアを作ると<br>部屋を検出します",
      "room.unknown":       "未判定の空間",
      "room.tiles":         "マス",
      "room.valid":         "✓ 有効な部屋",

      // Context menu
      "ctx.delete":         "削除",
      "ctx.copy":           "コピー",

      // Mobile bottom bar
      "mobile.buildings":   "建物",

      // Toasts / confirms
      "toast.pod_locked":   "製造ポッドは削除できません",
      "toast.loaded":       "読み込みました",
      "toast.load_error":   "読み込みエラー",
      "toast.saved":        "保存しました",
      "toast.copied":       "コピー: ",
      "confirm.clear":      "現在のレイヤーの建物を全て削除しますか？",

      // Room type names
      "room_type.barracks":  "兵舎",
      "room_type.latrine":   "洗面所",
    },
  };

  // ── State ─────────────────────────────────────────────────
  // English is the default. Persist across page loads.
  let _lang = localStorage.getItem("oni_lang") || "en";

  // ── Public API ────────────────────────────────────────────

  /** Translate a key in the current language. Falls back to English. */
  function t(key) {
    return (STRINGS[_lang] && STRINGS[_lang][key])
        || (STRINGS["en"]  && STRINGS["en"][key])
        || key;
  }

  /** Switch language and refresh all bound DOM nodes. */
  function setLang(lang) {
    if (!STRINGS[lang]) return;
    _lang = lang;
    localStorage.setItem("oni_lang", lang);
    applyDOM();
  }

  function getLang() { return _lang; }

  function toggleLang() {
    setLang(_lang === "en" ? "ja" : "en");
  }

  /**
   * Walk all elements with [data-i18n] and set their textContent (or innerHTML
   * for keys that end with _html).  Also updates [data-i18n-placeholder] and
   * [data-i18n-title].
   */
  function applyDOM() {
    // text content
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    // innerHTML (for strings containing <br> etc.)
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      el.innerHTML = t(key);
    });
    // placeholder attribute
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    // title attribute
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });

    // Update <html lang="">
    document.documentElement.lang = _lang;
  }

  return { t, setLang, getLang, toggleLang, applyDOM };
})();

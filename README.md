# ONI Colony Designer

A colony planning and layout design tool for **Oxygen Not Included**.

This application allows players to design colony layouts, place buildings, and plan infrastructure directly in the browser before building in-game.

## Current Status

### Building Database

* 216 buildings implemented
* Base Game coverage
* English (`name_en`) and Japanese (`name_ja`) localization support
* Category classification support
* Building dimensions (width / height)
* Building placement origin support (`origin: "bottom_right"`)

### Placement System

* Grid-based placement
* Building selection
* Multi-tile building support
* Bottom-right anchor placement
* Backward-compatible save format

### Layers

Implemented:

* Building Layer
* Power Layer
* Gas Layer
* Liquid Layer
* Room Layer

### Building Data Structure

Buildings are defined using the following structure:

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

## Data Source

`building_master.xlsx` is the single source of truth for all building definitions.

Imported fields:

* Category
* English Name
* Japanese Name
* Width
* Height

## Roadmap

### High Priority

* Building placement rule validation
* Special building constraint validation
* Construction rule checking

Examples:

* Steam Turbine
* Bunker Door
* Travel Tube
* Monument

### Medium Priority

* Port database
* Liquid connection visualization
* Gas connection visualization
* Power connection visualization
* Automation connection visualization

### Low Priority

* Building icon implementation
* UI improvements
* Additional templates

## Development Principles

* `building_master.xlsx` is the authoritative source
* English names are used as the internal reference
* Japanese localization is supported through language switching
* Save-file backward compatibility must be preserved
* In-game Oxygen Not Included behavior takes precedence over convenience

## License

This project is a fan-made planning tool for Oxygen Not Included.

Oxygen Not Included is © Klei Entertainment.

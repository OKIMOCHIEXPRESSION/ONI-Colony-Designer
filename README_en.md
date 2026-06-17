# ONI Colony Designer

A browser-based colony planning tool for **Oxygen Not Included**.

Design colony layouts, test building placement, and plan large-scale projects before committing resources in-game.

---

## Why This Exists

Many ONI players currently plan their colonies using:

* Screenshots
* Spreadsheets
* Drawing tools
* Sandbox saves

ONI Colony Designer provides a dedicated planning environment built specifically for Oxygen Not Included.

The goal is to make colony planning faster, easier, and more accurate.

---

## Features

### Building Placement

* Place buildings on a tile grid
* Multi-tile building support
* Accurate building dimensions
* Building categories
* Building search and filtering

### Colony Planning

* Layout planning
* Industrial block planning
* Power plant planning
* Rocket infrastructure planning
* Base expansion planning

### Save & Load

* Save colony layouts
* Load existing plans
* Undo support
* Backward-compatible save format

### Localization

* English-first interface
* Japanese language support
* Building name localization
* Category localization
* UI localization

---

## Building Database

Current database:

* 216 Vanilla ONI buildings
* Cargo-derived source data
* Verified dimensions
* Verified placement sizes
* English and Japanese naming support

### Examples of Corrected Building Sizes

Several dimensions were corrected during migration:

| Building            | Previous | Correct                |
| ------------------- | -------- | ---------------------- |
| Liquid Reservoir    | 3×3      | 2×3                    |
| Transit Tube Access | 2×3      | 3×2                    |
| Wood Burner         | 2×3      | 2×2                    |
| Printing Pod        | 4×4      | 4×4 (special handling) |

---

## Current MVP Scope

Implemented:

* Building placement
* Save / Load
* Undo
* Layer system
* English / Japanese UI
* Vanilla building database

Not yet implemented:

* Building icons
* Port visualization
* Pipe overlays
* Automation overlays
* DLC buildings
* Full room rule parity

---

## Layers

Currently available:

* Building Layer
* Power Layer
* Gas Layer
* Liquid Layer
* Room Layer (experimental)

---

## Known Limitations

This project is currently in MVP stage.

### Room Recognition

Room detection is currently experimental.

Most common rooms can be detected, but room rules may not perfectly match in-game behavior.

Full room parity is planned after MVP release.

### Building Graphics

Icons are not yet implemented.

Buildings are currently represented by simplified outlines to prioritize planning functionality.

### DLC Content

The current public version focuses on the Vanilla game.

DLC support is planned for a future release.

---

## Roadmap

### Near-Term

* Community feedback integration
* Additional validation rules
* Improved mobile usability
* More accurate room recognition

### Mid-Term

* Port database integration
* Pipe visualization
* Gas visualization
* Automation visualization

### Long-Term

* DLC support
* Templates
* Blueprint sharing
* Advanced planning tools

---

## Design Principles

### Accuracy First

Building dimensions should match actual ONI behavior whenever possible.

### English First

English is the primary language used internally.

Japanese localization is provided through the translation system.

### Save Compatibility

Existing save files should continue working whenever possible.

### Practical Planning Tool

The goal is not to recreate ONI.

The goal is to help players design colonies efficiently.

---

## Feedback

Feedback, bug reports, and feature requests are welcome.

Please open an Issue or start a Discussion.

---

## Disclaimer

ONI Colony Designer is a fan-made project.

Oxygen Not Included is © Klei Entertainment.

This project is not affiliated with or endorsed by Klei Entertainment.

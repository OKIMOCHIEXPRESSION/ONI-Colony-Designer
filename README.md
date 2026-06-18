# ONI Colony Designer

A browser-based colony planning tool for Oxygen Not Included.

## Current Status

### Building Database

* 257 implemented buildings
* 15 building categories
* English / Japanese naming support
* Cargo-derived source database
* Verified building dimensions
* Data-driven subgroup architecture

### Categories

| Category    |   Count |
| ----------- | ------: |
| Base        |      25 |
| Oxygen      |       6 |
| Power       |      25 |
| Food        |      24 |
| Plumbing    |      13 |
| Ventilation |       9 |
| Refinement  |      14 |
| Medicine    |       8 |
| Furniture   |      28 |
| Stations    |      18 |
| Utilities   |       9 |
| Automation  |      34 |
| Shipping    |      15 |
| Rocketry    |      16 |
| Special     |      13 |
| **Total**   | **257** |

## Features

### Colony Planning

* Grid-based colony design
* Multi-tile building placement
* Undo / Redo
* Save / Load
* Mobile support

### Building Palette

* Category tabs
* Building search
* Expandable building groups
* Data-driven group definitions
* Desktop / Mobile parity

### Layer System

* Base layer
* Plumbing layer
* Ventilation layer
* Electrical layer
* Automation layer

## Recent Updates

### Automation Recovery

* Automation category expanded from 1 to 34 buildings
* Logic gates
* Automation wires
* Sensors
* Signal control devices
* Actuators

### Shipping Recovery

* Conveyor Rail family
* Conveyor Bridges
* Conveyor Shutoffs
* Conveyor Sensors
* Additional shipping infrastructure

### Power Recovery

* Conductive Wire family
* Wire Bridges
* Heavi-Watt Conductive infrastructure
* Legacy display-name corrections with ID preservation

### Palette Upgrade

* Universal subgroup system
* Fully data-driven grouping
* No category-specific UI logic
* Future building additions require no UI changes

## Known Limitations

The planner currently focuses on layout planning.

Not yet implemented:

* Placement collision validation
* Building placement rule validation
* Automation signal simulation
* Pipe throughput simulation
* Wire throughput simulation
* Resource production / consumption simulation
* Element balance simulation
* Room requirement validation
* Thermal simulation

## Roadmap

### Next Release

* Placement collision system
* Heavy-Watt placement restrictions
* Building placement validation
* Same-building replacement handling
* Additional database verification

### Future

* Element and resource balance system
* Port system
* Rotation system
* Building icons
* Advanced room validation
* Automation visualization
* Thermal analysis

# Changelog

## 14.0.1 - 2026-08-14 — Initial Release

This is the first release of **Year Zero Engine - Generic Stepped Dice**, an
independent, setting-neutral Foundry VTT system derived from the original
Twilight: 2000 Foundry VTT repository and rebuilt for games using the Stepped
Dice version of the Year Zero Engine.

### Added

- Added generic Character, Non-Player Character, Vehicle, Military Unit, and
  Travel Party Actor sheets.
- Added Weapon, Armor, Ammunition, Grenade, Gear, Injury, Skill, and Specialty
  Item support.
- Added embedded Skill Items, including automatic migration from legacy
  actor-stored Skills and support for setting-neutral custom Skill lists.
- Added a complete Experience and Advancement system based on the Stepped Dice
  Year Zero Engine SRD:
  - Separate current and lifetime XP totals.
  - GM session-award workflow with standard and configurable award questions.
  - World-configurable Skill and Specialty XP costs.
  - Required, warning-only, or disabled Skill advancement prerequisites.
  - Optional GM-only XP spending.
  - Skill eligibility tracking, learning from unranked to D, and advancement
    through the Stepped Dice ratings.
  - Specialty learning with the required training confirmation.
  - Persistent XP award and spending history.
  - Skill Advancement, Specialty Advancement, and Experience History sub-tabs.
- Added a world-level Advancement Item Source setting. GMs can use either
  World Items or one selected Item compendium, preventing duplicate entries in
  learning menus.
- Added world-level Character Field Label settings, separated into Header Field
  and Attribute Field groups, for adapting sheets to different games.
- Added generic example compendiums for Actors, Items, macros, roll tables, and
  card-based initiative.
- Added generic YZEGS dice assets and initiative card artwork.

### Changed

- Established the system identity and manifest ID
  `fvtt-yze-generic-stepped`.
- Renamed the runtime, configuration, localization, CSS, hook, macro, roll, and
  dice namespaces to `YZEGS`.
- Updated the system for Foundry VTT 14.365, with 14.359 as the minimum
  supported version.
- Modernized document sheets and dialogs for Foundry VTT's current
  ApplicationV2 APIs.
- Reworked the interface into a consistent black-and-white visual theme across
  Actor sheets, Item sheets, dialogs, and custom settings windows.
- Replaced native dropdowns and checkboxes where needed with shared custom
  controls. Custom menus use the browser top layer so long option lists can
  extend beyond sheet and dialog boundaries.
- Refined Character sheet capacities, attributes, Skills, Specialties,
  conditions, critical injuries, equipment, biography, and Experience layouts.
- Made the original Character-header XP fields read-only; XP is awarded and
  spent through the Experience workflows.
- Refined Vehicle crew, components, combat, cargo, gauges, controls, and column
  alignment.
- Refined Military Unit menus, checkboxes, field widths, and label alignment.
- Refined Item sheet properties, modifiers, menus, checkboxes, and ammunition
  identifier selection.
- Replaced the setting-specific font set with bundled Mukta and Nunito Sans
  fonts distributed under the SIL Open Font License 1.1.
- Replaced font-dependent list markers and interface pictograms with CSS and
  Foundry-provided Font Awesome equivalents.
- Rewrote the README with the project's origin, acknowledgements, development
  requirements, licenses, and required Year Zero Engine license notice.

### Fixed

- Fixed Non-Player Character sheets failing to open when legacy biography data
  did not contain an Appearance field.
- Fixed Character Appearance content on the Biography tab not being editable.
- Fixed Character drag data failing to resolve when assigning Travel Party
  activities.
- Fixed duplicate Skill and Specialty choices being collected from World Items
  and compendium packs simultaneously.
- Fixed Vehicle crew-card, cargo, gauge, and equipment alignment issues.
- Fixed custom menus being constrained by sheet scroll areas and window
  boundaries.
- Fixed Actor and Item sheet minimization, restoration, and closing animations
  being obstructed by system minimum-size rules.
- Fixed numerous hover states, alignment inconsistencies, native control colour
  leaks, and dark-theme readability issues across Actor and Item sheets.

### Removed

- Removed remaining Twilight: 2000 names, namespace variations, rules-manual
  references, and setting-specific presentation content from the system.
- Removed Twilight: 2000 logos, banners, stamps, paper textures, dice filenames,
  legacy icon fonts, and old screenshots.
- Removed third-party organization and maintainer identities from active project
  metadata while retaining appropriate historical acknowledgement in the
  README.
- Omitted all optional and third-party logos, including the optional Year Zero
  Engine logo, from this initial release.

### Development

- Updated the development target to Node.js 24 LTS and added `.nvmrc` and
  package-engine declarations.
- Refreshed the build, lint, packaging, and dependency toolchain.
- Updated the GitHub Actions release workflow to current action versions and
  Foundry VTT release-publishing requirements.
- Added a reproducible production build that emits the installable system into
  `dist`; `npm test` now runs both linting and that production build.

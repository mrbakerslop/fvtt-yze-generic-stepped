# Changelog

## 14.0.7 - 2026-08-16 — Archetypes and Push Costs

### Added

- Added reusable Archetype Items and a guided Character builder for attributes,
  starting Skills and Specialty, background details, rank, CUF, radiation, and
  personal equipment choices.
- Added validation for Archetype attribute and Skill budgets, source references,
  required equipment, permissions, and explicit updates to existing Characters.
- Added Archetype provenance to Character data and a Character-sheet title-bar
  chooser that discovers Archetypes in the world and visible Item compendiums.
- Added configurable manual, chat-button, or automatic application of pushed-roll
  Damage, Stress, and item Reliability loss.
- Added CUF success or suppression results and consequences to roll chat cards.
- Added a world setting for showing or hiding Unit Morale and its CUF option.

### Changed

- Split the Character header between the Character Name and applied Archetype,
  with character creation available from the window title bar.
- CUF checks can no longer be pushed, and hidden Unit Morale ratings are excluded
  from CUF rolls.
- Weapon jams now consider the combined banes from base and Ammo dice.

### Fixed

- Closing or cancelling character creation no longer attempts to validate and
  apply a cancelled Archetype selection.
- Prevented pushed-roll consequences from being applied more than once while
  preserving ammunition and push-cost state when replacing chat messages.
- Updated the Apply Damage chat context action to Foundry VTT 14's visibility API.

## 14.0.6 - 2026-08-15 — Combat Actions and Modifiers

### Added

- Added a world-level Combat Actions and Modifiers configuration for enabling,
  renaming, and adjusting Close Combat, Ranged Combat, and Environmental
  entries.
- Added a Combat Category field to Skill Items so custom skills can opt into
  Close or Ranged Combat roll options without relying on their displayed name.
- Added a single Action Used selector to combat rolls, grouped into Fast and
  Slow Actions, with the chosen action recorded in the resulting chat card.
- Added configurable Close Combat, Ranged Combat, and Environmental
  situational modifiers to combat roll dialogs and chat results.
- Added the Combat Gear Encumbrance label to the world-level Character Field
  Labels configuration.

### Changed

- Arranged combat modifier checkboxes into two columns and increased the
  Ranged Combat modifier area so Environmental Modifiers remain visible.
- Updated combat chat-card details to wrap long action and modifier names.
- Zero-value actions are enabled by default, while zero-value situational
  modifiers remain hidden unless enabled by the GM.

### Fixed

- Prevented zero-value situational modifiers such as Short Range from changing
  the roll modifier total to `NaN`.

## 14.0.5 - 2026-08-15 — Item Sheet Polish

### Changed

- Widened the Weapon Magazine selector and reorganized the Weapon sheet into a
  more compact layout with additional field spacing.
- Increased the default Weapon and Ammunition sheet heights so their complete
  controls remain visible, including expanded ammunition override options.
- Placed Equipped and Stored in the Backpack controls on one row on the Weapon
  and Armor sheets.

### Fixed

- Item compendiums are now discovered when Game Settings renders, ensuring the
  Skill and Specialty Item Source selector lists packs initialized by Foundry.

## 14.0.4 - 2026-08-15 — Item Source World Setting

### Changed

- Moved the Skill and Specialty Item Source selector from the Experience Rules
  dialog to the main world settings page to reflect its wider use.
- Clarified that the selected source supplies Skill and Specialty choices for
  experience advancement and Roll Modifiers on standalone Items.
- New worlds now use World Items as their default Skill and Specialty source.
- Existing worlds automatically retain their previously configured source.

## 14.0.3 - 2026-08-15 — World Settings and Interface Polish

### Added

- Added a world setting to show or hide the Notes tab on Actor sheets.
- Added world settings to enable or disable Radiation and customize its name.

### Changed

- Roll dialogs now use the system's custom checkbox controls.
- New character and NPC actors now start with no Unit Morale rating.
- New hotbar macros are created without an unnecessary system Macro folder.

### Fixed

- Stopped creating the empty `YZE Stepped Dice Roll Macros` folder on every GM
  login and added a one-time cleanup that removes it only when it is empty.

## 14.0.2 - 2026-08-14 — Skill Compendium Cleanup

### Changed

- Kept the canonical Skill Items solely in the system Item compendium instead
  of also creating duplicate copies in the world Items directory.
- Made the system Item compendium the default advancement source for new
  worlds and used the configured source for Skill choices on Item sheets.

### Fixed

- Added a one-time cleanup for system-created world Skill duplicates while
  preserving Actor-embedded Skill ratings and stored Item references.

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
- Removed unused legacy presentation assets, duplicate dice artwork, and stale
  generated CSS files from the source and release archives.
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
- Added public installation and project metadata, pull-request validation, and
  complete third-party licensing notices to the release archive.
- Made clean installs reproducible by declaring the patching tool explicitly
  and removing the unused legacy changelog dependency.

# Changelog

## 14.0.8 — 2026-08-16

### Added

- Added a GM-only **Action Skills** world configuration. Character actions,
  Travel Party rolls, and supporting automated checks can now use arbitrary
  world or compendium Skill Items, while Weapon actions continue to use the
  Skill configured on each Weapon.
- Added setting-neutral watercraft support to Vehicle Actors, including land,
  watercraft, and amphibious domains; vessel Size and propulsion; uniform
  armor; hull, mast, and rigging components; grounding, flooding, and sinking
  state; and watercraft-specific sheet controls.
- Added automatic Vehicle armor penetration and component-hit resolution,
  hull breaches, penetrated-vessel crew shock, collisions, ramming, careening,
  amphibious landings, internal explosions, hull repair, bailing, and freeing
  grounded vessels.
- Added Water Region behaviors and Swimming, Submerged, Drowning, Overboard,
  and Hypothermia states. Deep-water combat now enforces movement and attack
  restrictions, drowning advances each combat round, and configurable Gear
  provides cold-water protection.
- Added water actions to the shared action and Skill-roll dialogs, including
  swimming, staying afloat, surfacing, rescue, climbing aboard, turning,
  ramming, bailing, freeing a vessel, and repairing a hull.
- Added configurable guided Weapon profiles with target classes, firing arcs,
  delayed impacts, round tracking, and target-owned Driving evasion.
- Extended Minefield Regions with water-mine modes, vessel Size thresholds,
  submerged detection equipment, detected-mine avoidance, automatic Vehicle
  damage, and penetrating hull breaches.
- Added a mutually exclusive Water Travel mode to Travel Party Actors with
  vessel, terrain, night, route-branch, navigator, Driving, fishing, encounter
  distance, mishap, and vessel-state automation.
- Added Container Actors for persistent chests, crates, lockers, weapon racks,
  and other storage placed as linked scene tokens.
- Added permission-aware, bidirectional drag-and-drop transfers with a quantity
  prompt for physical Items moving between Character and Container inventories.
- Added a unified Weapon reload workflow to Character inventories, Weapon
  sheets, and chat cards, with compatible source selection, Ranged Combat
  checks, automatic Reload action modifiers, and fast/slow action spending.
- Added backpack ammunition retrieval using a slow action and Mobility check,
  plus heavy-weapon reloads, alternate loaders, and reload result chat cards.
- Added a world setting which switches internal magazines between full reloads
  and the optional one-round-per-action rule.
- Added persistent Weapon jams. Qualifying pushed attacks now mark the Weapon
  as jammed, prevent it from firing, and expose a Clear Jam action on Weapon and
  Actor sheets.
- Added rules-based Clear Jam attempts using the Weapon's linked Skill. Attempts
  spend a slow action during active combat, retain the jam on failure, and may
  be repeated; outside combat, the Skill roll remains but time is narrative.
- Linked combat actions selected in Close and Ranged roll dialogs to Character
  and NPC Fast/Slow action pools during active combat, including Slow-to-Fast
  conversion, unavailable-action checks, and remaining-action summaries.
- Character and NPC Fast/Slow action pools now reset to their configured maxima
  whenever an active encounter advances to a new combat round.
- Moved Apply Damage from the chat-message context menu to a visible button on
  attack roll cards, with an explicit warning when no target is selected.
- Added a Character/NPC Take Action launcher backed by a shared Twilight: 2000
  action registry containing the complete Slow, Fast, and Free action tables
  plus the chapter's specialist combat, medical, environmental, and vehicle
  actions.
- Added tracked action and correct-skill workflows for movement, inventory,
  support, close-combat, ranged, heavy-weapon, and vehicle actions. Narrative
  actions still produce a chat record without imposing artificial automation.
- Added automated prone, cover, aiming, overwatch, bow/grenade preparation,
  inventory readiness, shove, disarm, grapple, break-free, First Aid, Rally,
  and extinguish-fire outcomes. Pushable results are applied from their final
  chat card rather than from the initial roll.
- Added target and prerequisite validation, treatment-attempt limits, reactive
  action tracking, automatic quick-shot and telescopic-aim modifiers, and the
  rule that heavy weapons must be aimed before firing.
- Relevant registry actions now appear directly in ordinary Skill roll dialogs,
  with contextual target, inventory, action-cost, and Specialty modifier fields.
- Added staged close-combat defense cards. A defender must declare Block before
  the attack roll, spends the reactive Fast action immediately, and rolls only
  after the attacker has completed any push.
- Added rules-based Block resolution for melee, unarmed, shove, disarm, and
  grapple attempts. Each Block success cancels one attack success and fully
  blocked attacks cannot apply damage or outcomes.
- Added the no-action Mobility reaction for dropping prone from a grenade, with
  successful final rolls applying the prone status.
- Added rules-as-written firearm suppression. Final attack cards request a
  target-owned CUF check after a hit or an ammo-die success on a miss; failed
  checks automatically apply prone, one Stress, the Suppressed marker, and the
  loss of both actions on the target's next turn.
- Added same-hex panic spread with one CUF check per fighter per attack, plus
  automatic expiry after the suppressed turn and protection for fully enclosed
  Vehicle occupants.
- Added Twilight: 2000 Scene grid presets. New worlds default to an approximate
  2.5-metre Close Quarters hex scale, with selectable 10-metre Battle,
  200-metre City, 10-kilometre Travel, and system-default options plus
  deliberate preset controls in Scene config.
- Added per-Actor-type Prototype Token width and height defaults for Characters,
  NPCs, Vehicles, Units, Parties, and Containers while preserving existing and
  imported token dimensions.
- Added explicit per-Scene Twilight scale and Urban Operations flags. Close
  Quarters Scenes enable the urban rules automatically, while a GM can enable
  them independently on a 10-metre Battle Scene.
- Added Urban Operations actions for shooter spotting, wall-hugging, entering
  buildings, sector and floor movement, slow breaching, blocking apertures,
  aperture overwatch, vehicle cover, booby traps, crowd control, and radio
  monitoring. Stretch and shift tasks are prevented during active combat.
- Added Close Quarters blind fire to Weapon roll dialogs. It rolls ammunition
  dice only, cannot inflict direct firearm damage, and retains suppression;
  explosive attacks can still resolve their sector blast.
- Added rules-based blast resolution from attack cards, including one roll per
  selected target, A–D blast profiles, indoor blast stepping, containment
  reminders, automatic knockdown, and CUF suppression checks.
- Added persistent Close Quarters engagements, restricted Slow Actions,
  random third-party ranged targets, and automatic release after retreat,
  shove, suppression, incapacitation, or the end of combat.
- Added wall-hugging exposure and restoration, aperture-specific overwatch,
  and vehicle-cover hit redirection.
- Added an Urban Operations mode to Party travel sheets. It limits assignments
  to March, Drive, and Keep Watch; includes city movement/back-off guidance,
  a city fuel calculator, and a GM stretch/encounter tracker.
- Added a generic Confined-Space Hazards Scene option with indoor Blast
  increases, missed-shot ricochets, structural-collapse checks, and a
  persistent Pinned by Debris condition with a Break Free action.
- Added Shotgun, Airburst, Directional, and Explosive Type fields so Weapons
  and Explosives can identify the special handling their attacks require.
- Added a native Minefield Region behavior with GM-configurable density,
  condition, mine type, damage, Blast, armor, detection, Airburst, Directional,
  and discovered state. Token movement can resolve hidden detection, careful
  probing, trigger checks, duds, direct damage, and Blast effects.
- Added Detect Mines, Cautious Mine Movement, Probe Mines, Place Mines, Clear
  Mines, and Break Free from Debris to the action and Skill-roll workflows.

### Changed

- Taking cover now records its real Armor Level and an optional threat
  direction. Partial cover protects only torso and legs, while full cover
  protects every hit location and applies its ranged-attack penalty.
- Blocking can use an equipped Weapon or be performed unarmed so pushed-roll
  Reliability loss or personal Damage is assigned to the correct document.

- Apply Damage now follows Twilight: 2000 ammo-die allocation: players can
  spend successes as bonus damage or preserve them for separately resolved
  additional hits, each with its own hit location and armor resolution. Only
  GMs see the optional narrative damage adjustment.
- Roll, action, target, item, roll-mode, and rolling-Actor selections now use
  the system's custom button-based menus instead of Foundry's native selects.
- Weapon attack roll dialogs now show their rules-appropriate attack action in
  the Action Used menu while retaining dedicated Weapon workflow validation.
- Magazine Ammunition now represents one physical magazine: its generic stack
  quantity is fixed at one and hidden, while its rounds remain tracked by the
  ammunition value and capacity fields.
- Added an Is Ammo Belt property to Ammunition. Belts use the same single-item
  quantity behavior as magazines and can only be selected by Weapons configured
  with the Is Ammo Belt property.
- Added an Is Box of Ammo property for purchasable ammunition stacks. Boxes keep
  the standard quantity field and cannot be selected as a Weapon's ammunition.
- Renamed the Weapon-side ammunition belt property to Is Belt Fed while keeping
  Is Ammo Belt on Ammunition Items.
- Added a Magazine Fed property to Weapons. Magazine-fed Weapons accept only
  magazine Ammunition, belt-fed Weapons accept only belts, and Weapons with
  neither property accept only loose ammunition.
- Added an Internal Magazine Weapon property with loaded/capacity tracking.
  Internal magazines draw from loose ammunition, consume loaded rounds when
  fired, and cannot select magazines, belts, or boxes.
- Added a Heavy Weapon property. Heavy weapons always spend a slow action to
  reload and may use another owned Character or NPC as their loader.
- Weapon ammunition menus now require the Ammunition Item's Ammo Identifier to
  match the Weapon's Ammo field, ignoring case and whitespace. Generated
  ammunition inherits the Weapon's identifier automatically.
- Embedded Weapon ammunition selectors are now read-only so changing ammunition
  cannot bypass the reload roll, action cost, or backpack retrieval procedure.
- Reload rolls and action costs only apply while the reloading Character is in a
  started combat encounter; outside active combat, reloading is automatic.
- Reload dialogs show the currently loaded magazine, belt, or ammunition type
  and list every compatible replacement by Item name. Full and partially loaded
  weapons can be reloaded solely to change ammunition type.
- Reload ammunition choices show current/maximum rounds for magazines and belts,
  or the available quantity for loose internal-magazine ammunition.
- Outside active combat, reload dialogs hide all combat roll, modifier, action,
  and backpack-access costs and identify the reload as automatic narrative time.
- Replaced the embedded Weapon sheet's magazine selector with a wider read-only
  loaded-ammunition display and a square icon-only Reload button on the same row.
- Increased the default Weapon sheet height so its complete Features tab,
  including the effective loaded-ammunition profile, fits without routine
  vertical scrolling.
- Aligned Character Gear-tab headers and item rows to shared grid columns for
  Weapon statistics, Armor values, Weight, and item controls.
- Loaded Ammunition with Override Weapon's Features now displays its effective
  Damage, Crit, Blast, Range, and Armor values on Weapon sheets, Character
  inventories, Vehicle inventories, and Weapon chat cards while leaving the
  Weapon's editable base values unchanged.
- Weapon and grenade attacks now select and spend their required Slow action
  automatically. Aiming, sniper aiming, and overwatch are established as
  separate persistent actions instead of being treated as attack-roll labels.

### Fixed

- Unsuccessful final action rolls now show a clear failure message instead of
  offering an Apply Outcome button which cannot produce a result.
- Attack rolls now preserve the loaded Ammunition profile at the moment of the
  roll, so reloading or changing ammunition before Apply Damage cannot alter the
  attack's Damage or Armor behavior.
- Open Weapon Item sheets now recalculate and refresh their effective profile
  after every reload, preventing stale specialty-ammunition values when changing
  back to standard ammunition.

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

# Year Zero Engine - Generic Stepped Dice

A generic stepped-dice Year Zero Engine game system for Foundry Virtual Tabletop.

This project provides a configurable starting point for building and playing
Year Zero Engine games that use stepped dice. It includes character, NPC,
vehicle, unit, and party sheets; item and skill support; stepped-dice rolls;
card-based initiative; configurable experience awards and advancement; and
optional example compendiums based on the mechanics and design patterns in the
Year Zero Engine System Reference Document.

The project is under active development and is not tied to a published game
setting.

## Compatibility

- System version: 14.0.11
- Minimum Foundry version: 14.359
- Verified Foundry version: 14.366

## Installation

Paste the following URL into Foundry VTT's **Install System** dialog:

```text
https://github.com/mrbakerslop/fvtt-yze-generic-stepped/releases/latest/download/system.json
```

Alternatively, download the ZIP archive from the
[latest release](https://github.com/mrbakerslop/fvtt-yze-generic-stepped/releases/latest),
extract it into the Foundry `Data/systems` directory, and ensure the resulting
folder is named `fvtt-yze-generic-stepped`.

## Development

Development requires Node.js 24 LTS or later. The repository includes an
`.nvmrc` file so Node version managers can select the intended release line.

Install the dependencies and build the distributable system with:

```bash
npm install
npm test
```

The production build is written to `dist`.

Development commands:

```bash
npm run dev
npm run dev:watch
npm run lint
npm run build
```

## Development namespace

- Manifest ID: `fvtt-yze-generic-stepped`
- JavaScript namespace: `game.yzegs`
- Configuration namespace: `CONFIG.YZEGS`
- Localization namespace: `YZEGS`

## Archetypes

Archetypes are reusable Item documents for guided, setting-neutral character
creation. An Archetype can define branches and rank results, a recommended key
attribute, key Skills, starting CUF, recommended Specialties, background
prompts, and personal equipment with choice groups and rolled quantities.

To use one:

1. Create an Archetype Item in the world or a visible Item compendium.
2. Drag Skill and Specialty Items onto the matching drop zones in its sheet.
3. Drag physical Items onto its Equipment tab. Give alternatives the same
   choice-group name and enter a quantity or roll formula such as `1d6`.
4. Configure the world **Advancement Item Source** so the character builder can
   offer at least six Skills and one Specialty.
5. Drag the Archetype onto a Character sheet, or use **Choose Archetype** in
   the Character sheet title bar.

The builder validates the standard stepped-dice Archetype allocation: four
attributes begin at C with three increases (and one optional reduction to D for
an extra increase), followed by one B key Skill, two C Skills, and three D
Skills. Applying an Archetype updates the embedded Skill ratings (unselected
Skills become untrained), preserves unrelated Items, never reduces matching
equipment quantities, and records the source on the Character.

Unit Morale, group gear, and a starting vehicle remain group decisions and are
shown as a completion reminder rather than applied to an individual Character.
Published setting content is not bundled; worlds and appropriately licensed
content modules can supply their own Archetype Items.

## Action Skills

The GM-only **Action Skills** world configuration maps automated character,
travel, watercraft, hazard, and environmental checks to the Skill Items used by
the current world. Its choices come from the configured **Skill and Specialty
Item Source**, so a game can replace the example Skill list without losing
action automation. Existing worlds retain their current system defaults until
a mapping is changed. Weapon attacks, reloads, and jam clearing use the Skill
selected on the individual Weapon Item.

## Scene grids

New Scenes default to an approximate Close Quarters flat-top grid with 2.5
metres per hex. *Urban Operations* defines its 1:125 Close Quarters maps using
gridless room-sized sectors; 2.5 metres is the proportional Foundry estimate
from the standard 1:500, 10-metre battle scale. The **Default Scene Grid** world
setting can instead select Battle (10 m), City (200 m), Travel (10 km), or the
system manifest default. The core Scene configuration window provides all four
scale preset buttons for existing Scenes.

Each preset records a rules mode on the Scene. Close Quarters enables Urban
Operations automatically; on a normal Battle Scene, use **Enable Urban
Operations rules on this Scene** when the map depicts built-up terrain. This
keeps indoor modifiers and urban actions off wilderness battle maps that happen
to use the same 10-metre scale.

## Urban Operations

Urban Scenes extend the Take Action and Skill roll dialogs with building entry,
floor and sector movement, wall-hugging, shooter spotting, breaching, blocking,
aperture overwatch, vehicle cover, booby-trap, crowd, and radio tasks. Extended
stretch/shift tasks are available outside combat and cannot consume an ordinary
combat action accidentally.

On a Close Quarters Scene, firing an ammunition weapon adds **Blind Fire** to
the Weapon roll dialog. Blind fire rolls ammunition dice only and can cause
suppression, but its attack card cannot apply direct firearm damage. Close
combat also establishes a persistent engagement: Slow Actions are restricted
to close attacks, third-party fire randomly selects one participant, and the
state ends on retreat, shove, suppression, incapacitation, or combat end.

Explosive attack cards expose **Resolve Blast**. Target all Actors at the same
effective blast power, choose that A–D rating, and the system rolls separately
for each target with the matching damage profile. Blast targets are knocked
prone and receive their own CUF control. The dialog defaults an indoor Close
Quarters blast one step higher and lets the GM record containment; Walls and
Regions remain the authoritative way to mark rooms, apertures, control zones,
checkpoints, and hidden traps on the Scene.

Party sheets can switch their Travel tab to **Urban Operations city travel**.
Only March, Drive, and Keep Watch remain assignable. The sheet includes the
200-metre-hex movement reminders, backing-off rule, fuel conversion calculator,
and a GM-only stretch counter which whispers an encounter/checkpoint reminder.

The system provides mechanics and configurable Specialty action-modifier hooks,
but does not redistribute published Archetype, Specialty, encounter, or site
text. Those Items can be created locally from material the world owner has the
right to use.

The presets change only grid type, distance, and units. Grid pixel size and map
alignment remain under the GM's control so importing a map does not disturb its
artwork. The alternative even-column hex type remains available through
Foundry's normal Grid Type control when a particular image uses that offset.

The **Default Prototype Token Sizes** world configuration sets independent
width and height values, in grid spaces, for newly created Characters, NPCs,
Vehicles, Units, Parties, and Containers. All types default to 1 × 1; vehicles
and large storage can use rectangular dimensions. Existing Actor prototypes and
placed Scene tokens are never resized by this setting.

The **System Guides** Journal compendium includes **Using Scene Grid Presets**,
an in-game reference for choosing a scale, applying it to existing Scenes,
aligning map artwork, enabling Scene rule modes, and setting token footprints.

## Containers

Containers are inventory-focused Actors for chests, crates, lockers, weapon
racks, and other storage. Create a **Container** Actor, choose its image and
type, then place it in a scene as a token. Container tokens are linked by
default, so their contents remain attached to the source Actor.

Physical Items can be dragged onto a Container from the Items directory or an
inventory. Drag an Item between a Character and Container sheet to choose a
quantity and move it in either direction. Single-item stacks move immediately.
A player needs **Owner** permission for both Actors to perform a transfer; this
lets a GM control which Containers a Character may access using Foundry's
normal ownership settings.

## Weapon reloading

Weapons with an Ammo Identifier and a configured feed system expose a Reload
control in Character inventories, embedded Weapon sheets, and Weapon chat
cards. The reload dialog only offers ammunition with a matching identifier and
feed type, shows its current rounds and inventory location, and preserves the
removed magazine or belt in inventory.

In a started combat encounter, ordinary firearm reloads make a Ranged Combat check: success spends
a fast action and failure spends a slow action. A failed check with only a fast
action remaining forfeits that action without completing the reload. A
Specialty modifier targeting **Reload** is applied automatically. Ammunition in
a backpack first requires an available slow action and a successful Mobility
check. Outside combat, reloads do not consume tracked actions or require these
checks. Merely adding a Character to an encounter does not activate these costs
until combat has started.

Weapons using the Heavy Weapons Skill, or marked **Heavy Weapon**, always
require a slow action and do not roll to reload. Their dialog can select another
owned Character or NPC as loader. Internal magazines normally fill in one
reload while consuming the required loose rounds; the **Internal Magazine
Reloading** world setting can instead require one reload action per round.
The complete setup and usage guide is available under **Compendium Packs → YZE
Generic Stepped Dice System Guides → Using Internal Magazine Reloading**.

## Combat actions

The Combat tab on Character and NPC sheets includes a **Take Action** button.
It contains the Players' Manual Slow, Fast, and Free actions together with the
special actions described later in the combat chapter. In an active encounter,
the launcher spends the Actor's tracked action; outside combat it records the
action without deducting narrative time.

Target another token before opening the launcher when an action affects another
character, a target hex, or a vehicle. Actions that require equipment expose a
filtered Item field. Skill-based actions use the appropriate embedded Skill and
remain pushable. First Aid, Rally, shove, disarm, grapple, break free, backpack
retrieval, and extinguishing fire receive an **Apply Outcome** button once the
final roll is accepted.

Rolling a standard Twilight: 2000 Skill also offers the actions associated with
that Skill directly in its roll dialog. For example, Medical Aid offers First
Aid, Command offers Rally, and Mobility offers its movement and environmental
actions. Target and Item fields appear only when the chosen action needs them,
and action-specific Specialty modifiers follow the chosen action. Weapon
attacks, Reload, and Clear Jam retain their dedicated controls because those
workflows also need the Weapon's current ammunition and jam state.

Persuade, Interrogate, and Barter use a staged **Social Conflict** workflow.
The active character declares their goal and any offer before rolling, records
the applicable negotiating-position factors, and spends the slow action. The
target then makes an unpushable resistance roll before the active character
rolls and decides whether to push. Ties favor the resisting side. Ordinary
influence against a player Character is a player decision by default, while
Interrogation remains opposed; this can be changed in the world-level Social
Conflict settings. The final card records narrative outcomes and return terms
without changing Actor or Item data automatically, and Barter displays the
configured price change per net success.

The **Action Skills** world menu independently configures the Skills used for
each active social action and for resisting Persuasion, Interrogation, and
Barter. Resistance rolls can be public or GM-only, either by world default or
per conflict.

The same instructions are available inside Foundry under **Compendium Packs →
YZE Generic Stepped Dice System Guides → Using Social Conflict Automation**.
System Guides can be read directly from the compendium or imported into the
world for editing and sharing with players.

Blockable close-combat attacks now begin with an attack-declaration card. The
target's owner or the GM must choose **Block** or **Do Not Block** before the
attack is rolled. A Block spends a Fast action immediately. After the attacker
accepts the roll or finishes pushing, the defender rolls Close Combat and may
push; every Block success removes one attack success. This applies to ordinary
melee and unarmed attacks, shove, disarm, and initial grapple attempts, but not
to ranged attacks, grapple attacks, or free attacks caused by failed retreats.

When taking cover, select a threatening token when possible and enter the
terrain or barrier's Armor Level. Partial cover protects torso and legs, while
full cover protects all locations. The Mobility action **Drop prone from a
grenade** is reactive, costs no action, and applies prone after a successful
final roll.

Prone, cover, aiming, overwatch, grapple, and preparation states are persisted
on the relevant Actor or Item. Firearms apply the correct quick-shot penalty
unless the attacker has aimed at that target with that weapon. Telescopic aim
applies its normal bonus and disables ammo dice, and heavy weapons cannot fire
until aimed. Bows must be prepared and grenade pins pulled before attacking.
The complete player and GM workflow is available under **Compendium Packs →
YZE Generic Stepped Dice System Guides → Using Automated Combat States and
Outcomes**.

## Confined spaces and minefields

Enable **Confined-Space Hazards** in a Scene's configuration when attacks are
being resolved in tunnels, bunkers, basements, or similarly enclosed areas.
The attack chat card then offers GM controls for missed-shot ricochets and
structural-collapse checks. Collapse results can pin selected Characters or
NPCs under debris and direct the GM to the appropriate critical-injury table.
An eight-page walkthrough is available under **Compendium Packs → YZE Generic
Stepped Dice System Guides → Running Underground and Confined Spaces**.

Mines are configured as Explosive Items using the **Explosive Type** field.
Create a Region and add the **Minefield** behavior to automate a hazardous
area. Its configuration controls which Actors can trigger it, its density and
condition, detection difficulty, direct-hit profile, Blast rating, and whether
it has already been discovered. When a compatible token crosses the Region,
the active GM confirms the movement method, scout, crossed hexes, and number of
entrants. Detection, trigger, dud, direct-damage, and Blast results then appear
in chat. Vehicle damage resolves armor and component hits automatically.
Water minefields can additionally restrict triggering by vessel Size, require
submerged detection equipment, and use Driving to navigate a discovered field.
An eight-page walkthrough is available under **Compendium Packs → YZE Generic
Stepped Dice System Guides → Setting Up and Using Minefields**.

## Water and watercraft

Set a Vehicle's **Vehicle Domain** to Watercraft or Amphibious to expose its
vessel configuration and operations. Size controls large-vessel turning and
collision damage. The Components tab tracks the hull, breaches, flooding,
grounding, propulsion, and sinking state, and provides GM controls for common
vessel incidents and extended repairs. Gear Items can be marked as suitable
spare parts, while equipped water-protection Gear can exempt or modify
cold-water checks.

Add the **Water** behavior to a Scene Region to mark shallow or deep water and
its temperature. Entering deep water applies the Swimming state; combat rounds
then track submerged breath checks, drowning damage, and drowning death saves.
The Take Action launcher and relevant Skill roll dialogs include swimming,
rescue, boarding, bailing, grounding, repair, turning, and ramming actions.

Mounted and portable Weapons can use a setting-neutral guided profile with a
target class, firing arc, impact delay, and evasion modifier. A successful
attack is launched from its chat card, becomes ready on the configured combat
round, and offers an eligible target's driver or helmsman a tracked Slow Action
evasion attempt.

Travel Party Actors provide a separate **Use water travel** mode. Select a
vessel and River, Coastline, or Open Water terrain, then assign Drive, Watch,
Fish, Rest, Sleep, and other duties. The GM's shift control applies day/night
speed, Driving and fishing modifiers, route-branch navigation, encounter
distance, and water-travel mishaps to the selected vessel.

The **System Guides** Journal compendium includes **Using Travel Modes**, which
explains Standard, Urban, and Water Travel Party setup, mode switching,
assignments, Scene integration, Skill configuration, and GM travel controls.

English is the source language. The included German, Spanish, French, Russian,
Swedish, and Ukrainian localizations are community translations and may lag
behind newly added English text. Translation contributions are welcome.

## Project origin and acknowledgements

This project began as a derivative of the
[Twilight: 2000 Foundry VTT system](https://github.com/fvtt-fria-ligan/twilight2000-foundry-vtt).
It has since been substantially changed and separated into an independent,
setting-neutral system for games using the stepped-dice version of the Year
Zero Engine.

The original Foundry system was created by
[@Stefouch](https://github.com/Stefouch), later maintained by
[@DrOgres](https://github.com/DrOgres) and the Free League Developer Community,
and improved by many contributors. Particular thanks are due to
[@aMediocreDad](https://github.com/aMediocreDad),
[@Kayne](https://github.com/Kayne),
[@tinwe](https://github.com/tinwe), and
[@Bakali77](https://github.com/Bakali77), as well as everyone represented in
the original repository's commit history.

Those people and organizations are acknowledged for their work on the project
from which this system originated. They are not the maintainers or authors of
this independent project and are not responsible for its current development.

## Year Zero Engine license notice

This game is not affiliated with, sponsored, or endorsed by Fria Ligan AB. The
Year Zero Engine System Reference Document is used under Fria Ligan AB's Free
Tabletop License.

- [Year Zero Engine Free Tabletop License, version 1.0](https://freeleaguepublishing.com/wp-content/uploads/2023/11/Year-Zero-Engine-License-Agreement.pdf)
- [Year Zero Engine System Reference Document, version 1.0](https://freeleaguepublishing.com/wp-content/uploads/2023/11/YZE-Standard-Reference-Document.pdf)
- [Free League's current Free Tabletop License page](https://freeleaguepublishing.com/community-content/free-tabletop-licenses/)

The Free Tabletop License permits the SRD to be copied, modified, translated,
and distributed as part of a virtual tabletop implementation. The example
rules and compendium content in this project are intended as a starting point
that game creators can adapt, replace, or extend for their own settings.

The optional Year Zero Engine logo is not currently included. If it is added
in the future, only the official logo supplied for use under the Free Tabletop
License may be used, and it must be used in accordance with the current logo
guidelines.

## Other licenses

- Source code is licensed under the
  [GNU General Public License version 3 or later](LICENSE).
- The bundled Year Zero Universal Dice Roller code is distributed under the
  MIT License. Its required copyright and permission notice is included in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Foundry VTT is owned by Foundry Gaming LLC. This project is developed in
  accordance with Foundry's
  [Limited License Agreement for module development](https://foundryvtt.com/article/license/).
- The bundled Mukta and Nunito Sans fonts are distributed under the SIL Open
  Font License 1.1. Copies of their licenses are included alongside the font
  files in `static/fonts` and summarized in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Interface pictograms use icons supplied by Foundry VTT's Font Awesome
  integration rather than a separately bundled icon font.

## Contributing

Issues, translations, documentation improvements, and code contributions are
welcome. New contributions should be setting-neutral and must not include text,
artwork, logos, or other material copied from a published game unless that
material is covered by an applicable license or the contributor has permission
to distribute it.

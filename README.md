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

- System version: 14.0.5
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

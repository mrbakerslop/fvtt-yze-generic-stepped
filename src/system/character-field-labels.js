const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const CHARACTER_FIELD_LABELS_SETTING = 'characterFieldLabels';

export const CHARACTER_FIELD_LABEL_KEYS = Object.freeze({
  nationality: 'YZEGS.ActorSheet.Nationality',
  branch: 'YZEGS.ActorSheet.Branch',
  rank: 'YZEGS.ActorSheet.MilitaryRank',
  age: 'YZEGS.ActorSheet.Age',
  str: 'YZEGS.AttributeNames.str',
  agl: 'YZEGS.AttributeNames.agl',
  int: 'YZEGS.AttributeNames.int',
  emp: 'YZEGS.AttributeNames.emp',
  combatGearEncumbrance: 'YZEGS.ActorSheet.CombatGearEncumbrance',
});

export const DEFAULT_CHARACTER_FIELD_LABELS = Object.freeze({
  nationality: '',
  branch: '',
  rank: '',
  age: '',
  str: '',
  agl: '',
  int: '',
  emp: '',
  combatGearEncumbrance: '',
});

/**
 * Return the configured world labels, falling back to the active localization.
 * @returns {Record<string, string>}
 */
export function getCharacterFieldLabels() {
  const configured = game.settings.get(SYSTEM_ID, CHARACTER_FIELD_LABELS_SETTING) ?? {};
  return Object.fromEntries(Object.entries(CHARACTER_FIELD_LABEL_KEYS).map(([field, localizationKey]) => {
    const customLabel = String(configured[field] ?? '').trim();
    return [field, customLabel || game.i18n.localize(localizationKey)];
  }));
}

/**
 * Refresh open sheets which display configurable character labels.
 */
export function refreshCharacterSheets() {
  const actors = game.actors.filter(actor => ['character', 'npc'].includes(actor.type));
  const items = [
    ...game.items,
    ...[...game.actors].flatMap(actor => [...actor.items]),
  ];

  for (const sheetDocument of [...actors, ...items]) {
    for (const app of Object.values(sheetDocument.apps)) {
      if (!app.rendered) continue;
      if (app instanceof foundry.applications.api.ApplicationV2) app.render({ force: true });
      else app.render(false);
    }
  }
}

/**
 * World-level configuration page for character identity field labels.
 */
export class CharacterFieldLabelsConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-character-field-labels',
    classes: ['yzegs', 'character-field-label-settings'],
    tag: 'form',
    position: { width: 520, height: 'auto' },
    window: {
      icon: 'fa-solid fa-tags',
      title: 'SETTINGS.characterFieldLabels.name',
      contentClasses: ['standard-form'],
    },
    form: {
      closeOnSubmit: true,
      handler: CharacterFieldLabelsConfig.#onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/fvtt-yze-generic-stepped/templates/system/character-field-labels.hbs',
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const configured = game.settings.get(SYSTEM_ID, CHARACTER_FIELD_LABELS_SETTING) ?? {};
    const fields = Object.entries(CHARACTER_FIELD_LABEL_KEYS).map(([key, localizationKey]) => ({
      key,
      value: String(configured[key] ?? ''),
      defaultLabel: game.i18n.localize(localizationKey),
      hint: game.i18n.format('SETTINGS.characterFieldLabels.inputHint', {
        default: game.i18n.localize(localizationKey),
      }),
    }));
    context.fieldGroups = [
      {
        label: 'SETTINGS.characterFieldLabels.headerFields',
        fields: fields.slice(0, 4),
      },
      {
        label: 'SETTINGS.characterFieldLabels.attributeFields',
        fields: fields.slice(4, 8),
      },
      {
        label: 'SETTINGS.characterFieldLabels.encumbranceFields',
        fields: fields.slice(8),
      },
    ];
    return context;
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object;
    const labels = Object.fromEntries(Object.keys(CHARACTER_FIELD_LABEL_KEYS).map(key => [
      key,
      String(submitted[key] ?? '').trim(),
    ]));

    await game.settings.set(SYSTEM_ID, CHARACTER_FIELD_LABELS_SETTING, labels);
    ui.notifications.info(game.i18n.localize('SETTINGS.characterFieldLabels.saved'));
  }
}

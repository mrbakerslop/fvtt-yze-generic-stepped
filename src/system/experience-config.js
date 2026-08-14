import { activateCheckboxControls } from '../components/checkbox-control.js';
import { activateRatingMenus } from '../components/rating-menu.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const EXPERIENCE_CONFIG_SETTING = 'experienceConfig';
export const WORLD_ADVANCEMENT_ITEM_SOURCE = 'world';
export const SYSTEM_ADVANCEMENT_ITEM_SOURCE = `compendium:${SYSTEM_ID}.system-items`;

export const EXPERIENCE_QUESTION_KEYS = Object.freeze({
  participated: 'YZEGS.Experience.Questions.Participated',
  explored: 'YZEGS.Experience.Questions.Explored',
  adversaries: 'YZEGS.Experience.Questions.Adversaries',
  nonViolent: 'YZEGS.Experience.Questions.NonViolent',
  personality: 'YZEGS.Experience.Questions.Personality',
  extraordinary: 'YZEGS.Experience.Questions.Extraordinary',
});

export const DEFAULT_EXPERIENCE_CONFIG = Object.freeze({
  skillCosts: { D: 5, C: 10, B: 15, A: 20 },
  specialtyCost: 10,
  prerequisiteMode: 'require',
  gmOnlyAdvancement: false,
  advancementItemSource: SYSTEM_ADVANCEMENT_ITEM_SOURCE,
  questions: Object.fromEntries(Object.keys(EXPERIENCE_QUESTION_KEYS).map(key => [key, true])),
  customQuestions: [],
});

/** Return the validated world experience configuration with SRD defaults. */
export function getExperienceConfig() {
  const stored = game.settings.get(SYSTEM_ID, EXPERIENCE_CONFIG_SETTING) ?? {};
  return foundry.utils.mergeObject(DEFAULT_EXPERIENCE_CONFIG, stored, { inplace: false });
}

/** Refresh open Character sheets after the experience rules change. */
export function refreshExperienceSheets() {
  for (const actor of game.actors.filter(candidate => candidate.type === 'character')) {
    for (const app of Object.values(actor.apps)) {
      if (!app.rendered) continue;
      if (app instanceof foundry.applications.api.ApplicationV2) app.render({ force: true });
      else app.render(false);
    }
  }
}

/** GM-facing world configuration for experience and advancement. */
export class ExperienceConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-experience-config',
    classes: ['yzegs', 'experience-config'],
    tag: 'form',
    position: { width: 760, height: 'auto' },
    window: {
      icon: 'fa-solid fa-arrow-trend-up',
      title: 'SETTINGS.experienceConfig.name',
      contentClasses: ['standard-form'],
    },
    form: {
      closeOnSubmit: true,
      handler: ExperienceConfig.#onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/fvtt-yze-generic-stepped/templates/system/experience-config.hbs',
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getExperienceConfig();
    context.config = config;
    context.questions = Object.entries(EXPERIENCE_QUESTION_KEYS).map(([id, label]) => ({
      id,
      label: game.i18n.localize(label),
      enabled: config.questions[id] !== false,
    }));
    context.prerequisiteModes = {
      require: 'SETTINGS.experienceConfig.prerequisiteModes.require',
      warn: 'SETTINGS.experienceConfig.prerequisiteModes.warn',
      off: 'SETTINGS.experienceConfig.prerequisiteModes.off',
    };
    context.itemSources = {
      [WORLD_ADVANCEMENT_ITEM_SOURCE]: game.i18n.localize('YZEGS.Experience.WorldItems'),
    };
    const itemPacks = game.packs
      .filter(pack => pack.documentName === 'Item')
      .sort((a, b) => a.metadata.label.localeCompare(
        b.metadata.label,
        game.i18n.lang,
        { sensitivity: 'base' },
      ));
    for (const pack of itemPacks) {
      context.itemSources[`compendium:${pack.collection}`] = pack.metadata.label;
    }
    if (!Object.hasOwn(context.itemSources, config.advancementItemSource)) {
      context.itemSources[config.advancementItemSource] = game.i18n.format(
        'SETTINGS.experienceConfig.unavailableItemSource',
        { source: config.advancementItemSource },
      );
    }
    context.customQuestions = config.customQuestions.join('\n');
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    activateRatingMenus(this.element);
    activateCheckboxControls(this.element, (path, value) => {
      const hiddenInput = [...this.element.querySelectorAll('input[type="hidden"]')]
        .find(input => input.name === path);
      if (hiddenInput) hiddenInput.value = String(value);
    });
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object;
    const nonNegativeInteger = value => Math.max(0, Math.trunc(Number(value) || 0));
    const asBoolean = value => value === true || value === 'true' || value === 'on';
    const availableItemSources = new Set([
      WORLD_ADVANCEMENT_ITEM_SOURCE,
      ...game.packs
        .filter(pack => pack.documentName === 'Item')
        .map(pack => `compendium:${pack.collection}`),
    ]);
    const config = {
      skillCosts: {
        D: nonNegativeInteger(submitted.skillD),
        C: nonNegativeInteger(submitted.skillC),
        B: nonNegativeInteger(submitted.skillB),
        A: nonNegativeInteger(submitted.skillA),
      },
      specialtyCost: nonNegativeInteger(submitted.specialtyCost),
      prerequisiteMode: ['require', 'warn', 'off'].includes(submitted.prerequisiteMode)
        ? submitted.prerequisiteMode
        : 'require',
      gmOnlyAdvancement: asBoolean(submitted.gmOnlyAdvancement),
      advancementItemSource: availableItemSources.has(submitted.advancementItemSource)
        ? submitted.advancementItemSource
        : SYSTEM_ADVANCEMENT_ITEM_SOURCE,
      questions: Object.fromEntries(
        Object.keys(EXPERIENCE_QUESTION_KEYS).map(key => [key, asBoolean(submitted[`question-${key}`])]),
      ),
      customQuestions: String(submitted.customQuestions ?? '')
        .split('\n')
        .map(question => question.trim())
        .filter(Boolean),
    };

    await game.settings.set(SYSTEM_ID, EXPERIENCE_CONFIG_SETTING, config);
    ui.notifications.info(game.i18n.localize('SETTINGS.experienceConfig.saved'));
  }
}

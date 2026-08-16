import {
  getTokenSizeDefaults,
  normalizeTokenSizeDefaults,
  TOKEN_SIZE_ACTOR_TYPES,
  TOKEN_SIZE_DEFAULTS_SETTING,
  TOKEN_SIZE_MAX,
  TOKEN_SIZE_MIN,
} from './token-size-defaults.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

/** GM-facing world configuration for new Actor Prototype Token dimensions. */
export class TokenSizeDefaultsConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-token-size-defaults',
    classes: ['yzegs', 'token-size-defaults'],
    tag: 'form',
    position: { width: 540, height: 'auto' },
    window: {
      icon: 'fa-solid fa-expand',
      title: 'SETTINGS.tokenSizeDefaults.name',
      contentClasses: ['standard-form'],
    },
    form: {
      closeOnSubmit: true,
      handler: TokenSizeDefaultsConfig.#onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/fvtt-yze-generic-stepped/templates/system/token-size-defaults.hbs',
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const configured = getTokenSizeDefaults();
    context.actorTypes = TOKEN_SIZE_ACTOR_TYPES.map(type => ({
      type,
      label: game.i18n.localize(`TYPES.Actor.${type}`),
      width: configured[type].width,
      height: configured[type].height,
    }));
    context.minimum = TOKEN_SIZE_MIN;
    context.maximum = TOKEN_SIZE_MAX;
    return context;
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object;
    const values = Object.fromEntries(TOKEN_SIZE_ACTOR_TYPES.map(type => [type, {
      width: submitted[`${type}Width`],
      height: submitted[`${type}Height`],
    }]));
    await game.settings.set(
      SYSTEM_ID,
      TOKEN_SIZE_DEFAULTS_SETTING,
      normalizeTokenSizeDefaults(values),
    );
    ui.notifications.info(game.i18n.localize('SETTINGS.tokenSizeDefaults.saved'));
  }
}

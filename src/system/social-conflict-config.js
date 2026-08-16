import { activateRatingMenus } from '../components/rating-menu.js';
import {
  DEFAULT_SOCIAL_CONFLICT_CONFIG,
  getSocialConflictConfig,
  SOCIAL_CONFLICT_SETTING,
} from './social-conflict.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

/** GM-facing world defaults for social conflicts. */
export class SocialConflictConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-social-conflict-config',
    classes: ['yzegs', 'social-conflict-config'],
    tag: 'form',
    position: { width: 620, height: 'auto' },
    window: { icon: 'fa-solid fa-comments', title: 'SETTINGS.socialConflict.name' },
    form: { closeOnSubmit: true, handler: SocialConflictConfig.#onSubmit },
  };

  static PARTS = {
    body: { template: 'systems/fvtt-yze-generic-stepped/templates/system/social-conflict.hbs' },
  };

  async _prepareContext(options) {
    return {
      ...await super._prepareContext(options),
      config: getSocialConflictConfig(),
      pcModes: {
        playerChoice: game.i18n.localize('YZEGS.Social.Config.PlayerChoice'),
        opposed: game.i18n.localize('YZEGS.Social.Config.Opposed'),
      },
      visibilityModes: {
        public: game.i18n.localize('YZEGS.Social.Config.Public'),
        gm: game.i18n.localize('YZEGS.Social.Config.GMOnly'),
      },
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    activateRatingMenus(this.element);
  }

  static async #onSubmit(_event, _form, formData) {
    const values = formData.object;
    await game.settings.set(SYSTEM_ID, SOCIAL_CONFLICT_SETTING, {
      pcInfluenceMode: values.pcInfluenceMode ?? DEFAULT_SOCIAL_CONFLICT_CONFIG.pcInfluenceMode,
      resistanceVisibility: values.resistanceVisibility ?? DEFAULT_SOCIAL_CONFLICT_CONFIG.resistanceVisibility,
      barterPercentPerSuccess: Number(values.barterPercentPerSuccess) || 10,
    });
    ui.notifications.info(game.i18n.localize('SETTINGS.socialConflict.saved'));
  }
}

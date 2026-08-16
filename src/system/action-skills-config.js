import { activateRatingMenus } from '../components/rating-menu.js';
import { getAdvancementSourceItems } from './experience.js';
import {
  ACTION_SKILL_DEFINITIONS,
  ACTION_SKILLS_SETTING,
  getActionSkillMappings,
  getLegacySkillName,
} from './action-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

/** GM-facing world configuration for the Skill used by each automated action. */
export class ActionSkillsConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-action-skills-config',
    classes: ['yzegs', 'action-skills-config'],
    tag: 'form',
    position: { width: 760, height: 720 },
    window: {
      icon: 'fa-solid fa-person-running',
      title: 'SETTINGS.actionSkills.name',
      contentClasses: ['standard-form'],
    },
    form: {
      closeOnSubmit: true,
      handler: ActionSkillsConfig.#onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/fvtt-yze-generic-stepped/templates/system/action-skills.hbs',
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const mappings = getActionSkillMappings();
    const sources = (await getAdvancementSourceItems('skill'))
      .map(skill => ({ uuid: skill.uuid, name: skill.name }))
      .filter(skill => skill.uuid && skill.name)
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang, { sensitivity: 'base' }));
    const groupLabels = {
      actions: 'YZEGS.ActionSkillConfig.Groups.Actions',
      travel: 'YZEGS.ActionSkillConfig.Groups.Travel',
      supporting: 'YZEGS.ActionSkillConfig.Groups.Supporting',
    };

    context.groups = Object.entries(groupLabels).map(([id, label]) => ({
      id,
      label: game.i18n.localize(label),
      entries: ACTION_SKILL_DEFINITIONS.filter(entry => entry.group === id).map(entry => {
        const fallbackValue = `legacy:${entry.skill}`;
        const configured = mappings[entry.id];
        const selected = configured?.uuid ?? (configured?.legacyKey ? `legacy:${configured.legacyKey}` : fallbackValue);
        const skillOptions = {
          [fallbackValue]: game.i18n.format('YZEGS.ActionSkillConfig.DefaultSkill', {
            skill: getLegacySkillName(entry.skill),
          }),
          ...Object.fromEntries(sources.map(skill => [skill.uuid, skill.name])),
        };
        if (configured?.uuid && configured?.name && !Object.hasOwn(skillOptions, configured.uuid)) {
          skillOptions[configured.uuid] = game.i18n.format('YZEGS.ActionSkillConfig.UnavailableSkill', {
            skill: configured.name,
          });
        }
        return {
          ...entry,
          name: game.i18n.localize(entry.label),
          selected,
          skillOptions,
        };
      }),
    })).filter(group => group.entries.length);
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    activateRatingMenus(this.element);
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object;
    const sourceItems = await getAdvancementSourceItems('skill');
    const sources = new Map(sourceItems.map(skill => [skill.uuid, skill]));
    const mappings = {};
    for (const definition of ACTION_SKILL_DEFINITIONS) {
      const value = String(submitted[definition.id] ?? '');
      if (value.startsWith('legacy:')) continue;
      const source = sources.get(value);
      if (!source) continue;
      mappings[definition.id] = { uuid: value, name: source.name };
    }
    await game.settings.set(SYSTEM_ID, ACTION_SKILLS_SETTING, mappings);
    ui.notifications.info(game.i18n.localize('SETTINGS.actionSkills.saved'));
  }
}

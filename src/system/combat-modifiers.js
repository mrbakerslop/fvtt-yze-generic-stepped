import { activateCheckboxControls } from '../components/checkbox-control.js';
import { urbanCombatEnabled } from './urban-operations.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const COMBAT_MODIFIERS_SETTING = 'combatModifiers';

export const COMBAT_TYPES = Object.freeze({
  auto: 'YZEGS.CombatModifiers.CombatTypes.auto',
  none: 'YZEGS.CombatModifiers.CombatTypes.none',
  close: 'YZEGS.CombatModifiers.CombatTypes.close',
  ranged: 'YZEGS.CombatModifiers.CombatTypes.ranged',
});

const ACTION_GROUPS = Object.freeze([
  { id: 'fast', label: 'YZEGS.CombatModifiers.Groups.fast' },
  { id: 'slow', label: 'YZEGS.CombatModifiers.Groups.slow' },
]);

const MODIFIER_GROUPS = Object.freeze([
  { id: 'situational', label: 'YZEGS.CombatModifiers.Groups.situational' },
  { id: 'environmental', label: 'YZEGS.CombatModifiers.Groups.environmental' },
]);

const entry = (id, combatType, entryType, group, value, label, exclusiveGroup = '') => Object.freeze({
  id,
  combatType,
  entryType,
  group,
  value,
  label,
  exclusiveGroup,
  enabled: entryType === 'action' || value !== 0,
});

const action = (id, combatType, speed, value, label) => (
  entry(id, combatType, 'action', speed, value, label)
);

const modifier = (id, combatType, group, value, label, exclusiveGroup = '') => (
  entry(id, combatType, 'modifier', group, value, label, exclusiveGroup)
);

/** Built-in action and modifier definitions. World settings store only overrides for these entries. */
export const DEFAULT_COMBAT_MODIFIERS = Object.freeze([
  // Close Combat — Fast Actions.
  action('close-block', 'close', 'fast', 0, 'YZEGS.CombatModifiers.Entries.closeBlock'),
  action('close-shove', 'close', 'fast', 0, 'YZEGS.CombatModifiers.Entries.closeShove'),
  action('close-disarm', 'close', 'fast', 0, 'YZEGS.CombatModifiers.Entries.closeDisarm'),
  action('close-grapple-attack', 'close', 'fast', 0, 'YZEGS.CombatModifiers.Entries.closeGrappleAttack'),

  // Close Combat — Slow Actions.
  action('close-unarmed-attack', 'close', 'slow', 0, 'YZEGS.CombatModifiers.Entries.closeUnarmedAttack'),
  action('close-melee-attack', 'close', 'slow', 0, 'YZEGS.CombatModifiers.Entries.closeMeleeAttack'),
  action('close-grapple', 'close', 'slow', 0, 'YZEGS.CombatModifiers.Entries.closeGrapple'),
  action('close-break-free', 'close', 'slow', 0, 'YZEGS.CombatModifiers.Entries.closeBreakFree'),

  // Close Combat — Situational modifiers.
  modifier(
    'close-attacker-prone', 'close', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.closeAttackerProne',
  ),
  modifier(
    'close-target-prone', 'close', 'situational', 2,
    'YZEGS.CombatModifiers.Entries.closeTargetProne',
  ),
  modifier(
    'close-defenseless-target', 'close', 'situational', 3,
    'YZEGS.CombatModifiers.Entries.closeDefenselessTarget',
  ),
  modifier('close-aimed-blow', 'close', 'situational', -2, 'YZEGS.CombatModifiers.Entries.closeAimedBlow'),
  modifier('close-diving-blow', 'close', 'situational', 2, 'YZEGS.CombatModifiers.Entries.closeDivingBlow'),

  // Ranged Combat — Fast Actions.
  // Ranged Combat — Slow Actions.
  action('ranged-attack', 'ranged', 'slow', 0, 'YZEGS.CombatModifiers.Entries.rangedAttack'),

  // Ranged Combat — Situational modifiers.
  modifier(
    'ranged-short-range', 'ranged', 'situational', 0,
    'YZEGS.CombatModifiers.Entries.rangedShortRange', 'ranged-range',
  ),
  modifier(
    'ranged-medium-range', 'ranged', 'situational', -1,
    'YZEGS.CombatModifiers.Entries.rangedMediumRange', 'ranged-range',
  ),
  modifier(
    'ranged-long-range', 'ranged', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.rangedLongRange', 'ranged-range',
  ),
  modifier(
    'ranged-extreme-range', 'ranged', 'situational', -3,
    'YZEGS.CombatModifiers.Entries.rangedExtremeRange', 'ranged-range',
  ),
  modifier(
    'ranged-active-same-hex-handy', 'ranged', 'situational', -1,
    'YZEGS.CombatModifiers.Entries.rangedActiveSameHexHandy', 'ranged-same-hex',
  ),
  modifier(
    'ranged-active-same-hex-other', 'ranged', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.rangedActiveSameHexOther', 'ranged-same-hex',
  ),
  modifier(
    'ranged-defenseless-same-hex', 'ranged', 'situational', 3,
    'YZEGS.CombatModifiers.Entries.rangedDefenselessSameHex',
  ),
  modifier(
    'ranged-target-prone', 'ranged', 'situational', -1,
    'YZEGS.CombatModifiers.Entries.rangedTargetProne',
  ),
  modifier(
    'ranged-full-cover', 'ranged', 'situational', -3,
    'YZEGS.CombatModifiers.Entries.rangedFullCover',
  ),
  modifier(
    'ranged-called-shot', 'ranged', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.rangedCalledShot',
  ),
  modifier(
    'ranged-moving-target', 'ranged', 'situational', -1,
    'YZEGS.CombatModifiers.Entries.rangedMovingTarget',
  ),
  modifier(
    'ranged-moving-vehicle', 'ranged', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.rangedMovingVehicle',
  ),
  modifier(
    'ranged-large-target', 'ranged', 'situational', 2,
    'YZEGS.CombatModifiers.Entries.rangedLargeTarget', 'ranged-target-size',
  ),
  modifier(
    'ranged-small-target', 'ranged', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.rangedSmallTarget', 'ranged-target-size',
  ),
  modifier(
    'ranged-elevated-position', 'ranged', 'situational', 1,
    'YZEGS.CombatModifiers.Entries.rangedElevatedPosition',
  ),
  modifier(
    'ranged-target-terrain', 'ranged', 'situational', -1,
    'YZEGS.CombatModifiers.Entries.rangedTargetTerrain', 'ranged-target-terrain',
  ),
  modifier(
    'ranged-dense-target-terrain', 'ranged', 'situational', -2,
    'YZEGS.CombatModifiers.Entries.rangedDenseTargetTerrain', 'ranged-target-terrain',
  ),

  // Environmental factors apply to either combat roll.
  modifier(
    'environment-dim-light', 'both', 'environmental', -1,
    'YZEGS.CombatModifiers.Entries.environmentDimLight', 'environment-light',
  ),
  modifier(
    'environment-darkness', 'both', 'environmental', -2,
    'YZEGS.CombatModifiers.Entries.environmentDarkness', 'environment-light',
  ),
  modifier(
    'environment-heavy-weather', 'both', 'environmental', -1,
    'YZEGS.CombatModifiers.Entries.environmentHeavyWeather',
  ),
  modifier(
    'environment-dense-smoke', 'both', 'environmental', -3,
    'YZEGS.CombatModifiers.Entries.environmentDenseSmoke',
  ),
]);

const signedValue = value => (value >= 0 ? `+${value}` : `−${Math.abs(value)}`);

/** Return the built-in definitions with validated world overrides applied. */
export function getCombatModifierDefinitions() {
  const overrides = game.settings.get(SYSTEM_ID, COMBAT_MODIFIERS_SETTING) ?? {};
  const schemaVersion = Number(overrides.schemaVersion) || 1;
  return DEFAULT_COMBAT_MODIFIERS.map(definition => {
    const override = overrides[definition.id] ?? {};
    const value = Number.isFinite(Number(override.value)) ? Math.trunc(Number(override.value)) : definition.value;
    const customLabel = String(override.label ?? '').trim();
    let enabled = override.enabled ?? definition.enabled;
    // Before actions had their own selector, zero-value entries were commonly disabled as visual noise.
    if (schemaVersion < 2 && definition.entryType === 'action' && override.enabled === false) {
      enabled = definition.enabled;
    }
    return {
      ...definition,
      enabled,
      value,
      customLabel,
      name: customLabel || game.i18n.localize(definition.label),
      signedValue: signedValue(value),
      displayValue: value ? signedValue(value) : '–',
    };
  });
}

/** Prepare enabled Fast and Slow Action choices for a Close or Ranged Combat roll dialog. */
export function getCombatActionGroups(combatType) {
  if (!['close', 'ranged'].includes(combatType)) return [];
  const definitions = getCombatModifierDefinitions();
  return ACTION_GROUPS.map(group => ({
    ...group,
    name: game.i18n.localize(group.label),
    actions: definitions.filter(definition => (
      definition.enabled
      && definition.entryType === 'action'
      && definition.group === group.id
      && definition.combatType === combatType
    )).map(definition => ({
      ...definition,
      speedName: game.i18n.localize(group.label),
    })),
  })).filter(group => group.actions.length);
}

/** Resolve the combat category of a Skill Item without relying on its displayed name. */
export function getSkillCombatType(skill) {
  if (!skill || skill.type !== 'skill') return 'none';
  if (['none', 'close', 'ranged'].includes(skill.system.combatType)) return skill.system.combatType;

  const legacyKey = skill.getFlag(SYSTEM_ID, 'legacySkillKey');
  if (legacyKey === 'closeCombat' || skill.id === 'skillCloseCombat') return 'close';
  if (legacyKey === 'rangedCombat' || skill.id === 'skillRangeCombat') return 'ranged';
  return 'none';
}

/** Prepare enabled modifier groups for a Close or Ranged Combat roll dialog. */
export function getCombatModifierGroups(combatType) {
  if (!['close', 'ranged'].includes(combatType)) return [];
  const definitions = getCombatModifierDefinitions();
  const groups = MODIFIER_GROUPS.map(group => ({
    ...group,
    name: game.i18n.localize(group.label),
    modifiers: definitions.filter(definition => (
      definition.enabled
      && definition.entryType === 'modifier'
      && definition.group === group.id
      && [combatType, 'both'].includes(definition.combatType)
    )),
  })).filter(group => group.modifiers.length);
  if (urbanCombatEnabled()) {
    const situational = groups.find(group => group.id === 'situational');
    const urbanModifiers = [
      {
        id: 'urban-cluttered-sector', value: -1, displayValue: '−1', exclusiveGroup: '',
        name: game.i18n.localize('YZEGS.CombatModifiers.Entries.urbanClutteredSector'),
      },
    ];
    if (combatType === 'ranged') {
      urbanModifiers.push({
        id: 'urban-indoor-target', value: -1, displayValue: '−1', exclusiveGroup: '',
        name: game.i18n.localize('YZEGS.CombatModifiers.Entries.urbanIndoorTarget'),
      });
    }
    if (situational) situational.modifiers.push(...urbanModifiers);
    else {
      groups.unshift({
        id: 'situational',
        name: game.i18n.localize('YZEGS.CombatModifiers.Groups.situational'),
        modifiers: urbanModifiers,
      });
    }
  }
  return groups;
}

/** GM-facing world configuration for combat actions and situational modifiers. */
export class CombatModifierConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-combat-modifiers',
    classes: ['yzegs', 'combat-modifier-config'],
    tag: 'form',
    position: { width: 780, height: 760 },
    window: {
      icon: 'fa-solid fa-crosshairs',
      title: 'SETTINGS.combatModifiers.name',
      contentClasses: ['standard-form'],
    },
    form: {
      closeOnSubmit: true,
      handler: CombatModifierConfig.#onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/fvtt-yze-generic-stepped/templates/system/combat-modifiers.hbs',
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const definitions = getCombatModifierDefinitions();
    context.combatSections = ['close', 'ranged'].map(combatType => ({
      id: combatType,
      name: game.i18n.localize(COMBAT_TYPES[combatType]),
      actionGroups: ACTION_GROUPS.map(group => ({
        ...group,
        name: game.i18n.localize(group.label),
        entries: definitions.filter(definition => (
          definition.combatType === combatType
          && definition.entryType === 'action'
          && definition.group === group.id
        )),
      })).filter(group => group.entries.length),
      modifiersName: game.i18n.localize('YZEGS.CombatModifiers.Groups.situational'),
      modifiers: definitions.filter(definition => (
        definition.combatType === combatType
        && definition.entryType === 'modifier'
        && definition.group === 'situational'
      )),
    }));
    context.environmental = {
      name: game.i18n.localize('YZEGS.CombatModifiers.Groups.environmental'),
      modifiers: definitions.filter(definition => definition.group === 'environmental'),
    };
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    activateCheckboxControls(this.element, (path, value) => {
      const hiddenInput = [...this.element.querySelectorAll('input[type="hidden"]')]
        .find(input => input.name === path);
      if (hiddenInput) hiddenInput.value = String(value);
    });
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object;
    const asBoolean = value => value === true || value === 'true' || value === 'on';
    const entries = Object.fromEntries(DEFAULT_COMBAT_MODIFIERS.map(definition => {
      const value = Number(submitted[`value-${definition.id}`]);
      return [definition.id, {
        enabled: asBoolean(submitted[`enabled-${definition.id}`]),
        label: String(submitted[`label-${definition.id}`] ?? '').trim(),
        value: Number.isFinite(value) ? Math.trunc(value) : definition.value,
      }];
    }));
    const config = { schemaVersion: 2, ...entries };

    await game.settings.set(SYSTEM_ID, COMBAT_MODIFIERS_SETTING, config);
    ui.notifications.info(game.i18n.localize('SETTINGS.combatModifiers.saved'));
  }
}

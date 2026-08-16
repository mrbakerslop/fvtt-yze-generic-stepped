import { enterDeepWater, leaveDeepWater } from './water-environment.js';

const fieldOptions = (initial, choices, label, hint) => ({
  required: true,
  nullable: false,
  initial,
  ...(choices ? { choices } : {}),
  label,
  hint,
});

function primaryActiveGM() {
  return game.users.find(user => user.active && user.isGM) ?? null;
}

async function onEnterWater(event) {
  if (primaryActiveGM()?.id !== game.user.id) return;
  const actor = event.data?.token?.actor;
  if (!actor || this.depth !== 'deep') return;
  if (actor.type === 'vehicle') {
    if (actor.system.domain === 'land') {
      ui.notifications.warn(game.i18n.format('YZEGS.Water.Region.LandVehicleWarning', {
        vehicle: actor.name,
      }));
    }
    return;
  }
  await enterDeepWater(actor, { cold: this.temperature === 'cold' });
}

async function onExitWater(event) {
  if (primaryActiveGM()?.id !== game.user.id) return;
  const actor = event.data?.token?.actor;
  if (actor) await leaveDeepWater(actor);
}

export class WaterRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ['YZEGS.Water.Region'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const events = [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT];
    return {
      events: this._createEventsField({ events, initial: events }),
      depth: new fields.StringField(fieldOptions('deep', {
        shallow: 'YZEGS.Water.Region.Depth.Shallow',
        deep: 'YZEGS.Water.Region.Depth.Deep',
      }, 'YZEGS.Water.Region.Fields.Depth', 'YZEGS.Water.Region.Hints.Depth')),
      temperature: new fields.StringField(fieldOptions('temperate', {
        temperate: 'YZEGS.Water.Region.Temperature.Temperate',
        cold: 'YZEGS.Water.Region.Temperature.Cold',
      }, 'YZEGS.Water.Region.Fields.Temperature', 'YZEGS.Water.Region.Hints.Temperature')),
      rough: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.Water.Region.Fields.Rough', 'YZEGS.Water.Region.Hints.Rough')),
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: onEnterWater,
    [CONST.REGION_EVENTS.TOKEN_EXIT]: onExitWater,
  };
}

export function registerWaterRegionBehavior() {
  CONFIG.RegionBehavior.dataModels.yzegsWater = WaterRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels.yzegsWater = 'YZEGS.Water.Region.Label';
  CONFIG.RegionBehavior.typeHints.yzegsWater = 'YZEGS.Water.Region.Hint';
  CONFIG.RegionBehavior.typeIcons.yzegsWater = 'fa-solid fa-water';
}

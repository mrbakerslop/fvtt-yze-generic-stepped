import { resolveMinefieldRegionEvent } from './minefield-workflows.js';

const fieldOptions = (initial, choices, label, hint) => ({
  required: true,
  nullable: false,
  initial,
  ...(choices ? { choices } : {}),
  label,
  hint,
});

const activeEventResolutions = new Set();

function primaryActiveGM() {
  return game.users.find(user => user.active && user.isGM) ?? null;
}

async function onMinefieldMovement(event) {
  if (!event.data?.movement) return;
  if (primaryActiveGM()?.id !== game.user.id) return;
  const key = `${this.behavior?.uuid}:${event.data.movement.id}`;
  if (activeEventResolutions.has(key)) return;
  activeEventResolutions.add(key);
  try {
    await resolveMinefieldRegionEvent(this, event);
  }
  finally {
    activeEventResolutions.delete(key);
  }
}

export class MinefieldRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ['YZEGS.Minefield.Region'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const events = [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN];
    return {
      events: this._createEventsField({ events, initial: events }),
      environment: new fields.StringField(fieldOptions('land', {
        land: 'YZEGS.Minefield.Environment.Land',
        water: 'YZEGS.Minefield.Environment.Water',
      }, 'YZEGS.Minefield.Region.Fields.Environment', 'YZEGS.Minefield.Region.Hints.Environment')),
      waterMineType: new fields.StringField(fieldOptions('contact', {
        contact: 'YZEGS.Minefield.WaterType.Contact',
        bottom: 'YZEGS.Minefield.WaterType.Bottom',
        mixed: 'YZEGS.Minefield.WaterType.Mixed',
      }, 'YZEGS.Minefield.Region.Fields.WaterType', 'YZEGS.Minefield.Region.Hints.WaterType')),
      maximumSafeSize: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.Minefield.Region.Fields.MaximumSafeSize', 'YZEGS.Minefield.Region.Hints.MaximumSafeSize')),
      density: new fields.StringField(fieldOptions('normal', {
        false: 'YZEGS.Minefield.Density.False',
        sparse: 'YZEGS.Minefield.Density.Sparse',
        normal: 'YZEGS.Minefield.Density.Normal',
        dense: 'YZEGS.Minefield.Density.Dense',
      }, 'YZEGS.Minefield.Region.Fields.Density', 'YZEGS.Minefield.Region.Hints.Density')),
      condition: new fields.StringField(fieldOptions('fresh', {
        fresh: 'YZEGS.Minefield.Condition.Fresh',
        old: 'YZEGS.Minefield.Condition.Old',
        overgrown: 'YZEGS.Minefield.Condition.Overgrown',
      }, 'YZEGS.Minefield.Region.Fields.Condition', 'YZEGS.Minefield.Region.Hints.Condition')),
      mineType: new fields.StringField(fieldOptions('antiPersonnel', {
        antiPersonnel: 'YZEGS.Minefield.Type.AntiPersonnel',
        antiVehicle: 'YZEGS.Minefield.Type.AntiVehicle',
        mixed: 'YZEGS.Minefield.Type.Mixed',
      }, 'YZEGS.Minefield.Region.Fields.Type', 'YZEGS.Minefield.Region.Hints.Type')),
      damage: new fields.NumberField(fieldOptions(2, null,
        'YZEGS.Minefield.Region.Fields.Damage', 'YZEGS.Minefield.Region.Hints.Damage')),
      crit: new fields.NumberField(fieldOptions(3, null,
        'YZEGS.Minefield.Region.Fields.Crit', 'YZEGS.Minefield.Region.Hints.Crit')),
      blast: new fields.StringField(fieldOptions('D', {
        '–': '–', D: 'D', C: 'C', B: 'B', A: 'A',
      }, 'YZEGS.Minefield.Region.Fields.Blast', 'YZEGS.Minefield.Region.Hints.Blast')),
      armorModifier: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.Minefield.Region.Fields.Armor', 'YZEGS.Minefield.Region.Hints.Armor')),
      airburst: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.Minefield.Region.Fields.Airburst', 'YZEGS.Minefield.Region.Hints.Airburst')),
      directional: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.Minefield.Region.Fields.Directional', 'YZEGS.Minefield.Region.Hints.Directional')),
      detectionModifier: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.Minefield.Region.Fields.Detection', 'YZEGS.Minefield.Region.Hints.Detection')),
      discovered: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.Minefield.Region.Fields.Discovered', 'YZEGS.Minefield.Region.Hints.Discovered')),
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: onMinefieldMovement,
    [CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN]: onMinefieldMovement,
  };
}

export function registerMinefieldRegionBehavior() {
  CONFIG.RegionBehavior.dataModels.yzegsMinefield = MinefieldRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels.yzegsMinefield = 'YZEGS.Minefield.Region.Label';
  CONFIG.RegionBehavior.typeHints.yzegsMinefield = 'YZEGS.Minefield.Region.Hint';
  CONFIG.RegionBehavior.typeIcons.yzegsMinefield = 'fa-solid fa-burst';
}

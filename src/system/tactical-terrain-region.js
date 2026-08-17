import { enterTacticalTerrain, leaveTacticalTerrain } from './tactical-terrain.js';

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

async function onEnterTerrain(event) {
  if (primaryActiveGM()?.id !== game.user.id) return;
  if (event.data?.token) await enterTacticalTerrain(event.data.token, this);
}

async function onExitTerrain(event) {
  if (primaryActiveGM()?.id !== game.user.id) return;
  if (event.data?.token) await leaveTacticalTerrain(event.data.token, this);
}

export class TacticalTerrainRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ['YZEGS.TacticalTerrain.Region'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const events = [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT];
    return {
      events: this._createEventsField({ events, initial: events }),
      terrainType: new fields.StringField(fieldOptions('field', {
        pavement: 'YZEGS.TacticalTerrain.Types.pavement',
        field: 'YZEGS.TacticalTerrain.Types.field',
        shrubland: 'YZEGS.TacticalTerrain.Types.shrubland',
        debris: 'YZEGS.TacticalTerrain.Types.debris',
        forest: 'YZEGS.TacticalTerrain.Types.forest',
        foliage: 'YZEGS.TacticalTerrain.Types.foliage',
        swamp: 'YZEGS.TacticalTerrain.Types.swamp',
        shallows: 'YZEGS.TacticalTerrain.Types.shallows',
        blocking: 'YZEGS.TacticalTerrain.Types.blocking',
        indoors: 'YZEGS.TacticalTerrain.Types.indoors',
        custom: 'YZEGS.TacticalTerrain.Types.custom',
      }, 'YZEGS.TacticalTerrain.Region.Fields.Type', 'YZEGS.TacticalTerrain.Region.Hints.Type')),
      elevated: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.TacticalTerrain.Region.Fields.Elevated', 'YZEGS.TacticalTerrain.Region.Hints.Elevated')),
      customName: new fields.StringField(fieldOptions('', null,
        'YZEGS.TacticalTerrain.Region.Fields.CustomName', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
      movementModifier: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.TacticalTerrain.Region.Fields.Movement', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
      rangedModifier: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.TacticalTerrain.Region.Fields.Ranged', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
      coverArmor: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.TacticalTerrain.Region.Fields.Cover', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
      infiltrationModifier: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.TacticalTerrain.Region.Fields.Infiltration', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
      visibility: new fields.NumberField(fieldOptions(0, null,
        'YZEGS.TacticalTerrain.Region.Fields.Visibility', 'YZEGS.TacticalTerrain.Region.Hints.Visibility')),
      forcedCrawl: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.TacticalTerrain.Region.Fields.ForcedCrawl', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
      blocking: new fields.BooleanField(fieldOptions(false, null,
        'YZEGS.TacticalTerrain.Region.Fields.Blocking', 'YZEGS.TacticalTerrain.Region.Hints.CustomOnly')),
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: onEnterTerrain,
    [CONST.REGION_EVENTS.TOKEN_EXIT]: onExitTerrain,
  };
}

export function registerTacticalTerrainRegionBehavior() {
  CONFIG.RegionBehavior.dataModels.yzegsTacticalTerrain = TacticalTerrainRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels.yzegsTacticalTerrain = 'YZEGS.TacticalTerrain.Region.Label';
  CONFIG.RegionBehavior.typeHints.yzegsTacticalTerrain = 'YZEGS.TacticalTerrain.Region.Hint';
  CONFIG.RegionBehavior.typeIcons.yzegsTacticalTerrain = 'fa-solid fa-mountain-sun';
}

import { applyHazardRegion } from './environmental-hazards.js';

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

async function onHazardEnter(event) {
  if (primaryActiveGM()?.id !== game.user.id) return;
  const actor = event.data?.token?.actor;
  if (actor) await applyHazardRegion(actor, this);
}

export class HazardRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ['YZEGS.Hazards.Region'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const events = [CONST.REGION_EVENTS.TOKEN_ENTER];
    return {
      events: this._createEventsField({ events, initial: events }),
      hazardType: new fields.StringField(fieldOptions('fire', {
        fire: 'YZEGS.Hazards.Types.Fire',
        disease: 'YZEGS.Hazards.Types.Disease',
        radiation: 'YZEGS.Hazards.Types.Radiation',
        cold: 'YZEGS.Hazards.Types.Cold',
      }, 'YZEGS.Hazards.Region.Fields.Type', 'YZEGS.Hazards.Region.Hints.Type')),
      intensity: new fields.StringField(fieldOptions('C', { A: 'A', B: 'B', C: 'C', D: 'D' },
        'YZEGS.Hazards.Region.Fields.Intensity', 'YZEGS.Hazards.Region.Hints.Intensity')),
      sourceUuid: new fields.StringField(fieldOptions('', null,
        'YZEGS.Hazards.Region.Fields.Source', 'YZEGS.Hazards.Region.Hints.Source')),
      radiation: new fields.NumberField(fieldOptions(1, null,
        'YZEGS.Hazards.Region.Fields.Radiation', 'YZEGS.Hazards.Region.Hints.Radiation')),
    };
  }

  static events = { [CONST.REGION_EVENTS.TOKEN_ENTER]: onHazardEnter };
}

export function registerHazardRegionBehavior() {
  CONFIG.RegionBehavior.dataModels.yzegsHazard = HazardRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels.yzegsHazard = 'YZEGS.Hazards.Region.Label';
  CONFIG.RegionBehavior.typeHints.yzegsHazard = 'YZEGS.Hazards.Region.Hint';
  CONFIG.RegionBehavior.typeIcons.yzegsHazard = 'fa-solid fa-triangle-exclamation';
}

const fields = foundry.data.fields;

const stringField = (initial = '') => new fields.StringField({ required: true, nullable: false, initial });
const htmlField = () => new fields.HTMLField({ required: true, nullable: false, initial: '' });
const numberField = (initial = 0) => new fields.NumberField({ required: true, nullable: false, initial });
const booleanField = (initial = false) => new fields.BooleanField({ required: true, nullable: false, initial });
const objectField = (initial = {}) => new fields.ObjectField({
  required: true,
  nullable: false,
  initial: () => foundry.utils.deepClone(initial),
});
const stringArrayField = () => new fields.ArrayField(stringField(), {
  required: true,
  nullable: false,
  initial: () => [],
});

const schemaField = schema => new fields.SchemaField(schema);
const scoreField = initial => schemaField({ score: stringField(initial) });
const valueMaxField = (value, max = value) => schemaField({
  value: numberField(value),
  max: numberField(max),
});
const capacityField = () => schemaField({
  value: numberField(4),
  max: numberField(4),
  modifier: numberField(),
  trauma: numberField(),
  temp: numberField(),
});
const componentField = () => schemaField({
  active: booleanField(true),
  damage: numberField(),
});

const descriptionSchema = () => ({ description: htmlField() });

const attributesAndSkillsSchema = () => ({
  attributes: schemaField({
    str: scoreField('C'),
    agl: scoreField('C'),
    int: scoreField('C'),
    emp: scoreField('C'),
  }),
  // Retained only so the one-time Skill Item migration can preserve existing ratings.
  skills: schemaField({
    heavyWeapons: scoreField('–'),
    closeCombat: scoreField('–'),
    stamina: scoreField('–'),
    driving: scoreField('–'),
    mobility: scoreField('–'),
    rangedCombat: scoreField('–'),
    recon: scoreField('–'),
    survival: scoreField('–'),
    tech: scoreField('–'),
    command: scoreField('–'),
    persuasion: scoreField('–'),
    medicalAid: scoreField('–'),
  }),
});

const combatSchema = (unitMorale = '–') => ({
  health: capacityField(),
  sanity: capacityField(),
  cuf: scoreField('D'),
  unitMorale: scoreField(unitMorale),
  diseases: stringField(),
});

const actionsSchema = () => ({
  actions: schemaField({
    slow: valueMaxField(1),
    fast: valueMaxField(1),
  }),
  movement: valueMaxField(2),
});

class CharacterSystemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...descriptionSchema(),
      bio: schemaField({
        nationality: stringField(),
        branch: stringField(),
        militaryRank: stringField(),
        buddy: stringField(),
        appearance: htmlField(),
        moralCode: stringField(),
        bigDream: stringField(),
        groupMeeting: stringField(),
        age: stringField(),
      }),
      ...attributesAndSkillsSchema(),
      ...combatSchema(),
      ...actionsSchema(),
      conditions: schemaField({
        starving: booleanField(),
        dehydrated: booleanField(),
        sleepless: booleanField(),
        hypothermic: booleanField(),
      }),
      rads: schemaField({
        temporary: numberField(),
        permanent: numberField(),
      }),
      xp: schemaField({
        value: numberField(),
        total: numberField(),
        history: new fields.ArrayField(objectField(), {
          required: true,
          nullable: false,
          initial: () => [],
        }),
      }),
    };
  }
}

class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...descriptionSchema(),
      ...attributesAndSkillsSchema(),
      ...combatSchema('–'),
      ...actionsSchema(),
    };
  }
}

class VehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...descriptionSchema(),
      vehicleType: stringField(),
      reliability: valueMaxField(5),
      movement: schemaField({
        combat: schemaField({ onRoad: numberField(), offRoad: numberField() }),
        travel: schemaField({ onRoad: numberField(), offRoad: numberField() }),
        type: stringField('W'),
      }),
      armor: schemaField({
        front: valueMaxField(0),
        left: valueMaxField(0),
        right: valueMaxField(0),
        rear: valueMaxField(0),
      }),
      fuel: schemaField({
        value: numberField(),
        max: numberField(),
        type: stringField('G'),
        cons: numberField(),
      }),
      cargo: numberField(),
      crew: schemaField({
        qty: numberField(1),
        passengerQty: numberField(),
        occupants: new fields.ArrayField(objectField()),
      }),
      tempDamage: stringField(),
      components: schemaField({
        fuel: componentField(),
        engine: componentField(),
        suspension: componentField(),
        ammunition: componentField(),
        radio: schemaField({
          active: booleanField(true),
          reliability: valueMaxField(1),
        }),
        trackWheel: componentField(),
        fcs: schemaField({
          active: booleanField(),
          damage: numberField(),
          type: stringField(),
        }),
        antenna: componentField(),
      }),
      trailer: booleanField(),
      smokeDischarger: booleanField(),
      price: numberField(),
    };
  }
}

class UnitData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...descriptionSchema(),
      info: stringField(),
      faction: stringField(),
      unitAffiliation: stringField(),
      unitSize: stringField(),
      unitType: stringField(),
      unitModifiers: schemaField({
        airborne: booleanField(),
        parachute: booleanField(),
        airmobile: booleanField(),
        airmobileOrganicLift: booleanField(),
        amphibious: booleanField(),
        motorized: booleanField(),
        moutain: booleanField(),
        cannon: booleanField(),
        wheeled: booleanField(),
      }),
      personnel: valueMaxField(0),
      vehicles: valueMaxField(0),
      hq: booleanField(),
    };
  }
}

class PartyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const travel = {};
    for (const action of [
      'camp', 'cook', 'drive', 'fish', 'forage', 'hunt', 'march',
      'rest', 'scrounge', 'sleep', 'watch', 'other',
    ]) travel[action] = stringArrayField();

    return {
      ...descriptionSchema(),
      members: stringArrayField(),
      travel: schemaField(travel),
    };
  }
}

const itemBaseSchema = () => ({
  qty: numberField(1),
  itemType: stringField(),
  weight: numberField(1),
  price: numberField(),
  equipped: booleanField(),
  backpack: booleanField(),
  description: htmlField(),
});

const offensiveSchema = () => ({
  attribute: stringField('agl'),
  skill: stringField(),
  damage: numberField(),
  crit: numberField(),
  blast: stringField('–'),
  range: numberField(),
  armorModifier: numberField(),
});

const reliabilitySchema = () => ({ reliability: valueMaxField(5) });
const modifiersSchema = () => ({ rollModifiers: objectField() });

class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...itemBaseSchema(),
      ...offensiveSchema(),
      ...modifiersSchema(),
      ...reliabilitySchema(),
      ammo: stringField(),
      rof: numberField(),
      mag: schemaField({
        target: stringField(),
        value: numberField(),
        max: numberField(),
      }),
      jammed: booleanField(),
      mountSlot: numberField(),
      props: schemaField({
        twoHanded: booleanField(),
        ammoBelt: booleanField(),
        disposable: booleanField(),
        scope: booleanField(),
        nightVision: booleanField(),
        suppressor: booleanField(),
        bayonet: booleanField(),
        bipod: booleanField(),
        tripod: booleanField(),
        mounted: booleanField(),
        armored: booleanField(),
      }),
      featuresForVehicle: schemaField({
        p: booleanField(),
        pg: booleanField(),
        t: booleanField(),
        c: booleanField(),
        h: booleanField(),
        s: booleanField(),
        fcs: booleanField(),
        ir: booleanField(),
        tm: booleanField(),
      }),
    };
  }
}

class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...itemBaseSchema(),
      ...modifiersSchema(),
      rating: valueMaxField(0),
      location: schemaField({
        head: booleanField(),
        arms: booleanField(),
        torso: booleanField(true),
        legs: booleanField(),
      }),
    };
  }
}

class AmmunitionData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...itemBaseSchema(),
      weight: numberField(0.25),
      ammo: valueMaxField(1),
      damage: numberField(),
      crit: numberField(),
      blast: stringField('–'),
      range: numberField(),
      armorModifier: numberField(),
      override: booleanField(),
      props: schemaField({ magazine: booleanField(true) }),
    };
  }
}

class GrenadeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...itemBaseSchema(),
      ...offensiveSchema(),
      weight: numberField(0.25),
      mag: valueMaxField(0),
      props: schemaField({ disposable: booleanField(true) }),
    };
  }
}

class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...itemBaseSchema(),
      ...modifiersSchema(),
      ...reliabilitySchema(),
      props: schemaField({
        twoHanded: booleanField(),
        mounted: booleanField(),
        disposable: booleanField(),
      }),
    };
  }
}

class SpecialtyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...modifiersSchema(),
      description: htmlField(),
    };
  }
}

class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attribute: stringField('str'),
      score: stringField('–'),
      advancement: schemaField({
        eligible: booleanField(),
      }),
      description: htmlField(),
    };
  }
}

class InjuryData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...modifiersSchema(),
      description: htmlField(),
      category: stringField('physical'),
      location: stringField(),
      lethal: booleanField(),
      timeLimit: stringField('Shift'),
      healTime: stringField(),
    };
  }
}

export function registerDataModels() {
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterSystemData,
    npc: NpcData,
    vehicle: VehicleData,
    unit: UnitData,
    party: PartyData,
  });

  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    armor: ArmorData,
    ammunition: AmmunitionData,
    grenade: GrenadeData,
    gear: GearData,
    skill: SkillData,
    specialty: SpecialtyData,
    injury: InjuryData,
  });
}

import { TWILIGHT_ACTIONS } from './twilight-actions.js';

/**
 * The YZEGS Configuration.
 * @constant
 */
export const YZEGS = {};

YZEGS.ASCII = `================================================
  YEAR ZERO ENGINE - GENERIC STEPPED DICE
================================================`;

YZEGS.attributes = {
  str: 'YZEGS.AttributeNames.str',
  agl: 'YZEGS.AttributeNames.agl',
  int: 'YZEGS.AttributeNames.int',
  emp: 'YZEGS.AttributeNames.emp',
};

YZEGS.attributeOptions = {
  'attribute.str': 'YZEGS.AttributeNames.str',
  'attribute.agl': 'YZEGS.AttributeNames.agl',
  'attribute.int': 'YZEGS.AttributeNames.int',
  'attribute.emp': 'YZEGS.AttributeNames.emp',
};

YZEGS.constantsOptions = {
  'constant.cuf' : 'YZEGS.ConstantNames.cuf',
  'constant.awareness' : 'YZEGS.ConstantNames.awareness',
  'constant.encumbrance' : 'YZEGS.ConstantNames.encumbrance',
};

YZEGS.actionOptions = Object.fromEntries(
  TWILIGHT_ACTIONS.map(action => [`action.${action.id}`, action.label]),
);
// Preserve the original modifier key used by existing Specialty Items.
YZEGS.actionOptions['action.seekCover'] = 'YZEGS.ActionNames.seekCover';

YZEGS.travelTaskOptions = {
  'travel.cooking' :'YZEGS.TravelTaskNames.cooking',
  'travel.driving' : 'YZEGS.TravelTaskNames.driving',
  'travel.exploring' : 'YZEGS.TravelTaskNames.exploring',
  'travel.fishing' : 'YZEGS.TravelTaskNames.fishing',
  'travel.foraging' : 'YZEGS.TravelTaskNames.foraging',
  'travel.gathering' : 'YZEGS.TravelTaskNames.gathering',
  'travel.hunting' : 'YZEGS.TravelTaskNames.hunting',
  'travel.keepingWatch' : 'YZEGS.TravelTaskNames.keepingWatch',
  'travel.makingCamp' : 'YZEGS.TravelTaskNames.makingCamp',
  'travel.marching' : 'YZEGS.TravelTaskNames.marching',
  'travel.resting' : 'YZEGS.TravelTaskNames.resting',
  'travel.scrounging' : 'YZEGS.TravelTaskNames.scrounging',
  'travel.sleeping' : 'YZEGS.TravelTaskNames.sleeping',
};

YZEGS.dieSizes = [-1, 12, 10, 8, 6, 0];
YZEGS.dieScores = ['–', 'A', 'B', 'C', 'D', 'F'];
YZEGS.dieSizesMap = new Map(YZEGS.dieScores.map((x, i) => [x, YZEGS.dieSizes[i]]));

YZEGS.actionSkillsMap = {
  'travel-forced-march': 'stamina',
  'travel-march-in-darkness': 'survival',
  'travel-drive': 'driving',
  'travel-keep-watch': 'recon',
  'travel-find-scrap': 'survival',
  'travel-find-food': 'survival',
  'travel-find-prey': 'survival',
  'travel-recon-prey': 'recon',
  'travel-kill-prey': 'rangedCombat',
  'travel-catch-fish': 'survival',
  'travel-make-camp': 'survival',
  'travel-hide-camp': 'recon',
  'travel-cook-food': 'survival',
};

YZEGS.physicalItems = ['weapon', 'armor', 'grenade', 'ammunition', 'gear'];

YZEGS.vehicle = {
  extraPassengerEncumbrance: 50,
  emptySeatEncumbrance: 25,
  crewPositionFlags: ['DRIVER', 'GUNNER', 'COMMANDER', 'PASSENGER'],
  crewPositionFlagsLocalized: {
    DRIVER: 'YZEGS.VehicleSheet.CrewPositions.Driver',
    GUNNER: 'YZEGS.VehicleSheet.CrewPositions.Gunner',
    COMMANDER: 'YZEGS.VehicleSheet.CrewPositions.Commander',
    PASSENGER: 'YZEGS.VehicleSheet.CrewPositions.Passenger',
  },
  movementTypes: {
    W: 'YZEGS.VehicleSheet.Wheels',
    T: 'YZEGS.VehicleSheet.Tracks',
    H: 'YZEGS.VehicleSheet.Hovercraft',
    A: 'YZEGS.VehicleSheet.Flying',
    N: 'YZEGS.VehicleSheet.Naval',
  },
  fuelTypes: {
    G: 'YZEGS.VehicleSheet.Gasoline',
    D: 'YZEGS.VehicleSheet.Diesel',
    A: 'YZEGS.VehicleSheet.Alcohol',
    N: 'YZEGS.VehicleSheet.Nuclear',
  },
  domains: {
    land: 'YZEGS.VehicleSheet.Domains.Land',
    watercraft: 'YZEGS.VehicleSheet.Domains.Watercraft',
    amphibious: 'YZEGS.VehicleSheet.Domains.Amphibious',
  },
  propulsionTypes: {
    motor: 'YZEGS.VehicleSheet.Propulsion.Motor',
    sail: 'YZEGS.VehicleSheet.Propulsion.Sail',
    paddle: 'YZEGS.VehicleSheet.Propulsion.Paddle',
    other: 'YZEGS.VehicleSheet.Propulsion.Other',
  },
  components: [
    'FUEL',
    'ENGINE',
    'SUSPENSION',
    'AMMUNITION',
    'CARGO',
    'DRIVER',
    'PASSENGER',
    'GUNNER',
    'COMMANDER',
    'RADIO',
    'TRACK_WHEEL',
    'WEAPON',
    'FIRE_CONTROL_SYSTEM',
    'ANTENNA',
    'EXTERNAL_STORES',
    'EXPOSED_PASSENGER',
    'RICOCHET',
  ],
  componentDamage: {
    penetration: [
      'FUEL',
      'ENGINE',
      'SUSPENSION',
      'AMMUNITION',
      'CARGO',
      'DRIVER',
      'PASSENGER',
      'GUNNER',
      'COMMANDER',
      'RADIO',
    ],
    glancingBlow: [
      'TRACK_WHEEL',
      'WEAPON',
      'FIRE_CONTROL_SYSTEM',
      'ANTENNA',
      'EXTERNAL_STORES',
      'EXPOSED_PASSENGER',
      'EXPOSED_PASSENGER',
      'RICOCHET',
      'RICOCHET',
    ],
  },
};

YZEGS.unit = {
  unitAffiliations: {
    friendly: 'YZEGS.UnitAffiliationNames.friendly',
    hostile: 'YZEGS.UnitAffiliationNames.hostile',
    neutral: 'YZEGS.UnitAffiliationNames.neutral',
    unknown: 'YZEGS.UnitAffiliationNames.unknown',
  },
  unitSizes: {
    army: 'YZEGS.UnitSizeNames.army',
    corps: 'YZEGS.UnitSizeNames.corps',
    division: 'YZEGS.UnitSizeNames.division',
    Brigade: 'YZEGS.UnitSizeNames.Brigade',
    regiment: 'YZEGS.UnitSizeNames.regiment',
    battalion: 'YZEGS.UnitSizeNames.battalion',
    company: 'YZEGS.UnitSizeNames.company',
    staffel: 'YZEGS.UnitSizeNames.staffel',
    platoon: 'YZEGS.UnitSizeNames.platoon',
    section: 'YZEGS.UnitSizeNames.section',
    squad: 'YZEGS.UnitSizeNames.squad',
    fireteam: 'YZEGS.UnitSizeNames.fireteam',
  },
  unitModifiers: {
    airborne: 'YZEGS.UnitModifierNames.airborne',
    parachute: 'YZEGS.UnitModifierNames.parachute',
    airmobile: 'YZEGS.UnitModifierNames.airmobile',
    airmobileOrganicLift: 'YZEGS.UnitModifierNames.airmobileOrganicLift',
    amphibious: 'YZEGS.UnitModifierNames.amphibious',
    motorized: 'YZEGS.UnitModifierNames.motorized',
    mountain: 'YZEGS.UnitModifierNames.mountain',
    cannon: 'YZEGS.UnitModifierNames.cannon',
    wheeled: 'YZEGS.UnitModifierNames.wheeled',
  },
};

YZEGS.hitLocs = ['legs', 'torso', 'torso', 'torso', 'arms', 'head'];

YZEGS.hitLocations = {
  none: '',
  head: 'YZEGS.ArmorLocationNames.head',
  arms: 'YZEGS.ArmorLocationNames.arms',
  torso: 'YZEGS.ArmorLocationNames.torso',
  legs: 'YZEGS.ArmorLocationNames.legs',
};

YZEGS.injuryCategories = {
  none: '',
  physical: 'YZEGS.InjuryCategoryNames.physical',
  mental: 'YZEGS.InjuryCategoryNames.mental',
};

YZEGS.radiationVirulence = 4;

YZEGS.ranges = [
  'YZEGS.Ranges.close',
  'YZEGS.Ranges.short',
  'YZEGS.Ranges.medium',
  'YZEGS.Ranges.long',
  'YZEGS.Ranges.extreme',
];

YZEGS.messageModes = {
  public: 'CHAT.MODES.public',
  gm: 'CHAT.MODES.gm',
  blind: 'CHAT.MODES.blind',
  self: 'CHAT.MODES.self',
};

// YZEGS.unarmedData = {
//   attribute: 'str',
//   skill: 'closeCombat',
//   damage: 1,
//   crit: 4,
//   blast: '–',
//   armorModifier: 3,
//   range: 0,
//   weight: 0,
//   price: 0,
//   modifiers: { attributes: {}, skills: {} },
//   rof: 0,
//   mag: {},
//   props: {},
// };

/* ------------------------------------------- */
/*  Icons                                      */
/* ------------------------------------------- */

YZEGS.Icons = {
  boxes: {
    empty: '<i class="far fa-square"></i>',
    full: '<i class="fas fa-square"></i>',
  },
  buttons: {
    edit: '<i class="fas fa-edit"></i>',
    delete: '<i class="fas fa-trash"></i>',
    remove: '<i class="fas fa-times"></i>',
    plus: '<i class="fas fa-plus"></i>',
    minus: '<i class="fas fa-minus"></i>',
    equip: '<i class="fas fa-star"></i>',
    unequip: '<i class="far fa-star"></i>',
    stash: '<i class="fas fa-shopping-bag"></i>',
    unmount: '<i class="fas fa-thumbtack"></i>',
    mount: '<i class="fas fa-wrench"></i>',
    primaryWeapon: '<i class="fas fa-angle-up"></i>',
    secondaryWeapon: '<i class="fas fa-angle-double-up"></i>',
    attack: '<i class="fas fa-crosshairs"></i>',
    reload: '<i class="fas fa-sync-alt"></i>',
    clearJam: '<i class="fas fa-tools"></i>',
    lethal: '<i class="fas fa-skull"></i>',
    mental: '<i class="fas fa-brain"></i>',
    chat: '<i class="far fa-comment-dots"></i>',
  },
  armorLocationIcons: {
    head: '<i class="fas fa-hard-hat"></i>',
    arms: '<i class="fas fa-hand-paper"></i>',
    torso: '<i class="fas fa-tshirt"></i>',
    legs: '<i class="fas fa-socks"></i>',
  },
};

import { getBlastDamageProfile } from './urban-operations.js';
import { YZEGSRoller } from '../components/roll/dice.js';
import {
  ammunitionExplosionChance,
  ammunitionRemainingFraction,
  armoredWeaponDamage,
  getLandVehicleComponent,
  getLandVehicleComponentRow,
  increaseBlastRating,
  nextPenetratingComponentRow,
  trackWheelDamage,
} from './land-vehicle-damage-rules.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function localize(key, data = {}) {
  return Object.keys(data).length ? game.i18n.format(key, data) : game.i18n.localize(key);
}

function randomEntry(entries) {
  return entries[Math.floor(Math.random() * entries.length)] ?? null;
}

function crewEntries(vehicle, { position = '', exposed = null, excluded = new Set() } = {}) {
  return (vehicle.system.crew?.occupants ?? []).filter(occupant => {
    const actor = game.actors.get(occupant.id);
    if (!actor || excluded.has(actor.uuid) || Number(actor.system.health?.value) <= 0) return false;
    if (position && occupant.position !== position) return false;
    return exposed === null || Boolean(occupant.exposed) === exposed;
  });
}

function crewActor(occupant) {
  return occupant ? game.actors.get(occupant.id) : null;
}

function mountedWeapons(vehicle) {
  return vehicle.items.filter(item => (
    item.type === 'weapon' && item.system.isMounted && Number(item.system.reliability?.value) > 0
  ));
}

function storedItems(vehicle, externallyMounted = false) {
  return vehicle.items.filter(item => {
    if (!['weapon', 'armor', 'gear', 'ammunition', 'grenade'].includes(item.type)) return false;
    if (item.system.isMounted) return false;
    return externallyMounted ? Boolean(item.system.equipped) : !item.system.equipped;
  });
}

function ammunitionItems(vehicle) {
  return vehicle.items.filter(item => item.type === 'ammunition');
}

function hasVehicleAmmunition(vehicle) {
  return ammunitionItems(vehicle).some(item => (
    item.system.props?.ammoBox
      ? Number(item.system.qty) > 0
      : Number(item.system.ammo?.value) > 0
  ));
}

function componentDamage(vehicle, component) {
  return Math.max(0, Number(vehicle.system.components?.[component]?.damage) || 0);
}

function componentActive(vehicle, component) {
  return Boolean(vehicle.system.components?.[component]?.active);
}

function vehicleReliability(vehicle) {
  return Math.max(0, Number(vehicle.system.reliability?.value) || 0);
}

function componentAvailable(vehicle, component, context) {
  const reliability = vehicleReliability(vehicle);
  switch (component) {
    case 'fuel': return componentActive(vehicle, 'fuel')
      && componentDamage(vehicle, 'fuel') < 1
      && !vehicle.system.landVehicle?.destroyed;
    case 'engine': return componentActive(vehicle, 'engine') && reliability > 0;
    case 'suspension': return componentActive(vehicle, 'suspension') && reliability > 0;
    case 'ammunition': return componentActive(vehicle, 'ammunition')
      && componentDamage(vehicle, 'ammunition') < 2 && hasVehicleAmmunition(vehicle);
    case 'cargo': return storedItems(vehicle).length > 0;
    case 'driver': return crewEntries(vehicle, { position: 'DRIVER', excluded: context.hitCrew }).length > 0;
    case 'passenger': return crewEntries(vehicle, { position: 'PASSENGER', excluded: context.hitCrew }).length > 0;
    case 'gunner': return crewEntries(vehicle, { position: 'GUNNER', excluded: context.hitCrew }).length > 0;
    case 'commander': return crewEntries(vehicle, { position: 'COMMANDER', excluded: context.hitCrew }).length > 0;
    case 'radio': return componentActive(vehicle, 'radio')
      && Number(vehicle.system.components.radio?.reliability?.value) > 0;
    case 'trackWheel': return componentActive(vehicle, 'trackWheel')
      && reliability > 0 && ['left', 'right'].includes(context.facing);
    case 'weapon': return mountedWeapons(vehicle).length > 0;
    case 'fcs': return componentActive(vehicle, 'fcs') && componentDamage(vehicle, 'fcs') < 1;
    case 'antenna': return componentActive(vehicle, 'antenna') && componentDamage(vehicle, 'antenna') < 1;
    case 'externalStores': return storedItems(vehicle, true).length > 0;
    case 'exposedPassenger': return crewEntries(vehicle, {
      exposed: true, excluded: context.hitCrew,
    }).length > 0;
    case 'ricochet': return true;
    default: return false;
  }
}

async function addComponentDamage(vehicle, component, amount) {
  amount = Math.max(0, Number(amount) || 0);
  if (!amount) return;
  await vehicle.update({
    [`system.components.${component}.damage`]: componentDamage(vehicle, component) + amount,
  });
}

async function reduceVehicleReliability(vehicle, amount) {
  const current = vehicleReliability(vehicle);
  const applied = Math.min(current, Math.max(0, Number(amount) || 0));
  const reliability = current - applied;
  await vehicle.update({
    'system.reliability.value': reliability,
    ...(reliability <= 0 ? { 'system.landVehicle.inoperable': true } : {}),
  });
  return applied;
}

async function damageItem(item, damage) {
  damage = Math.max(0, Number(damage) || 0);
  const reliability = Number(item.system.reliability?.value);
  if (Number.isFinite(reliability)) {
    const reliabilityDamage = Math.min(Math.max(0, reliability), damage);
    await item.update({ 'system.reliability.value': Math.max(0, reliability - reliabilityDamage) });
    return { applied: reliabilityDamage, destroyed: reliability - reliabilityDamage <= 0 };
  }
  const prior = Number(item.getFlag(SYSTEM_ID, 'vehicleDamage')?.value) || 0;
  const capacity = Math.max(0, 5 - prior);
  const applied = Math.min(capacity, damage);
  await item.setFlag(SYSTEM_ID, 'vehicleDamage', {
    value: prior + applied,
    destroyed: prior + applied >= 5,
  });
  return { applied, destroyed: prior + applied >= 5 };
}

function strongestVehicleBlast(vehicle) {
  const ratings = { D: 1, C: 2, B: 3, A: 4 };
  return vehicle.items.reduce((best, item) => {
    const blast = String(item.system.blast ?? item.system.effectiveAttack?.blast ?? '–').toLocaleUpperCase();
    return (ratings[blast] ?? 0) > (ratings[best] ?? 0) ? blast : best;
  }, '–');
}

async function setOnFire(actor) {
  if (!actor?.statuses?.has?.('fire')) await actor.toggleStatusEffect('fire', { active: true });
}

/** Roll the compulsory bailout checks caused by a penetrating vehicle hit. */
export async function resolveLandVehicleCrewShock(vehicle, reason = '') {
  const failures = [];
  for (const occupant of vehicle.system.crew?.occupants ?? []) {
    const actor = game.actors.get(occupant.id);
    if (!actor || !['character', 'npc'].includes(actor.type)) continue;
    const result = await YZEGSRoller.cufCheck({
      actor,
      title: localize('YZEGS.LandVehicle.Damage.CrewShock', { actor: actor.name }),
      messageMode: 'public',
    });
    const roll = result?.rolls?.[0] ?? result;
    if (result && Number(roll?.baseSuccessQty) < 1) {
      failures.push(actor.name);
      await actor.setFlag(SYSTEM_ID, 'vehicleBailOut', {
        vehicleUuid: vehicle.uuid,
        vehicleName: vehicle.name,
        reason,
        required: true,
      });
    }
  }
  return failures;
}

/** Create normal blast damage rolls against every occupant without reducing blast for vehicle armor. */
export async function resolvePenetratingVehicleBlast(vehicle, blast, sourceName = '') {
  const profile = getBlastDamageProfile(blast);
  if (!profile) return [];
  const results = [];
  for (const occupant of vehicle.system.crew?.occupants ?? []) {
    const actor = game.actors.get(occupant.id);
    if (!actor || !['character', 'npc'].includes(actor.type)) continue;
    results.push(await YZEGSRoller.taskCheck({
      title: localize('YZEGS.LandVehicle.Damage.InternalBlast', {
        actor: actor.name, blast: profile.rating,
      }),
      actor,
      attribute: profile.die,
      skill: profile.die,
      maxPush: 0,
      locate: true,
      hideCombatActions: true,
      skipDialog: true,
      attackData: {
        damage: profile.damage,
        crit: profile.crit,
        armorModifier: profile.armorModifier,
        blast: profile.rating,
        blastResolution: true,
        primaryTargetUuid: actor.uuid,
        sourceActorUuid: vehicle.uuid,
        sourceName,
      },
    }));
  }
  return results;
}

async function rollFuelIgnition(blast) {
  const profile = getBlastDamageProfile(blast);
  if (!profile) return { ignited: false, roll: null };
  const roll = await new Roll(`2d${profile.die}`).evaluate();
  const successes = roll.dice.flatMap(die => die.results)
    .filter(result => result.result >= 6).length;
  return { ignited: successes > 0, roll };
}

async function startFuelFire(vehicle, context) {
  await vehicle.update({
    'system.landVehicle.fuelFire': true,
    'system.landVehicle.fuelFireDeadline': (Number(game.time?.worldTime) || 0) + 600,
  });
  await setOnFire(vehicle);
  for (const occupant of vehicle.system.crew?.occupants ?? []) {
    await setOnFire(game.actors.get(occupant.id));
  }
  const failures = await resolveLandVehicleCrewShock(vehicle, 'fuelFire');
  context.events.push(localize('YZEGS.LandVehicle.Damage.FuelFire', {
    failures: failures.length ? failures.join(', ') : localize('YZEGS.LandVehicle.Damage.None'),
  }));
}

async function loseVehicleAmmunition(vehicle, fraction) {
  for (const item of ammunitionItems(vehicle)) {
    const updates = {};
    if (Number.isFinite(Number(item.system.ammo?.value))) {
      updates['system.ammo.value'] = Math.floor(Math.max(0, Number(item.system.ammo.value)) * fraction);
    }
    if (item.system.props?.ammoBox) {
      updates['system.qty'] = Math.floor(Math.max(0, Number(item.system.qty)) * fraction);
    }
    if (!foundry.utils.isEmpty(updates)) await item.update(updates);
  }
}

async function rollAmmunitionExplosion(chance) {
  if (chance >= 1) return { exploded: true, roll: null };
  if (chance <= 0) return { exploded: false, roll: null };
  const roll = await new Roll('1d6').evaluate();
  return { exploded: roll.total >= 4, roll };
}

async function destroyVehicle(vehicle, reason) {
  await vehicle.update({
    'system.reliability.value': 0,
    'system.landVehicle.inoperable': true,
    'system.landVehicle.destroyed': true,
    'system.landVehicle.destroyedReason': reason,
  });
}

async function resolveRicochet(vehicle, context) {
  const actors = new Map();
  for (const occupant of crewEntries(vehicle, { exposed: true })) {
    const actor = crewActor(occupant);
    if (actor) actors.set(actor.uuid, actor);
  }
  const vehicleToken = vehicle.getActiveTokens?.(true, true)?.[0];
  if (vehicleToken?.center && canvas.grid) {
    const vehicleOffset = canvas.grid.getOffset(vehicleToken.center);
    for (const token of canvas.tokens?.placeables ?? []) {
      if (!['character', 'npc'].includes(token.actor?.type) || !token.center) continue;
      const offset = canvas.grid.getOffset(token.center);
      if (offset.i === vehicleOffset.i && offset.j === vehicleOffset.j) {
        actors.set(token.actor.uuid, token.actor);
      }
    }
  }
  for (const actor of actors.values()) {
    const result = await YZEGSRoller.cufCheck({
      actor,
      title: localize('YZEGS.LandVehicle.Damage.RicochetCheck', { actor: actor.name }),
      messageMode: 'public',
    });
    const roll = result?.rolls?.[0] ?? result;
    if (result && Number(roll?.baseSuccessQty) < 1) {
      const { applySuppressionFailure } = await import('./suppression-workflows.js');
      await applySuppressionFailure(actor);
    }
  }
  context.events.push(localize('YZEGS.LandVehicle.Damage.Ricochet', { count: actors.size }));
}

async function applyCrewHit(vehicle, component, damage, context) {
  const position = component === 'passenger' ? 'PASSENGER' : component.toLocaleUpperCase();
  const occupant = randomEntry(crewEntries(vehicle, { position, excluded: context.hitCrew }));
  const actor = crewActor(occupant);
  if (!actor) return { remaining: damage, repeatedPassenger: false };
  context.hitCrew.add(actor.uuid);
  const capacity = Math.max(1, Number(context.attackData.crit) || damage);
  const applied = Math.min(damage, capacity);
  const hitData = foundry.utils.deepClone(context.attackData);
  delete hitData.calledVehicleComponent;
  delete hitData.vehicleComponentChoices;
  delete hitData.vehicleFacing;
  delete hitData.ignoreVehicleArmor;
  delete hitData.location;
  await actor.applyDamage(applied, hitData, true);
  context.events.push(localize('YZEGS.LandVehicle.Damage.CrewHit', {
    component: localize(`YZEGS.LandVehicle.Components.${component}`),
    actor: actor.name,
    damage: applied,
  }));
  const remaining = Math.max(0, damage - applied);
  return {
    remaining,
    repeatedPassenger: component === 'passenger'
      && remaining > 0
      && crewEntries(vehicle, { position: 'PASSENGER', excluded: context.hitCrew }).length > 0,
  };
}

async function applyComponent(vehicle, component, damage, context) {
  damage = Math.max(0, Number(damage) || 0);
  if (['driver', 'passenger', 'gunner', 'commander'].includes(component)) {
    return applyCrewHit(vehicle, component, damage, context);
  }
  if (component === 'fuel') {
    const applied = Math.min(1, damage);
    const state = vehicle.system.landVehicle ?? {};
    const originalMax = Number(state.originalFuelMax) || Number(vehicle.system.fuel?.max) || 0;
    const reducedMax = state.fuelLeak ? Number(vehicle.system.fuel?.max) : originalMax / 2;
    await vehicle.update({
      'system.components.fuel.damage': componentDamage(vehicle, 'fuel') + applied,
      'system.fuel.max': reducedMax,
      'system.fuel.value': Math.min(Number(vehicle.system.fuel?.value) || 0, reducedMax),
      'system.landVehicle.originalFuelMax': originalMax,
      'system.landVehicle.fuelLeak': true,
    });
    context.events.push(localize('YZEGS.LandVehicle.Damage.FuelLeak'));
    const ignition = await rollFuelIgnition(context.attackData.blast);
    if (ignition.roll) context.rolls.push(ignition.roll);
    if (ignition.ignited) await startFuelFire(vehicle, context);
    return { remaining: Math.max(0, damage - applied) };
  }
  if (component === 'engine') {
    const applied = await reduceVehicleReliability(vehicle, damage);
    await addComponentDamage(vehicle, 'engine', applied);
    context.events.push(localize('YZEGS.LandVehicle.Damage.ReliabilityLoss', {
      component: localize('YZEGS.LandVehicle.Components.engine'), damage: applied,
    }));
    return { remaining: 0 };
  }
  if (component === 'suspension') {
    const applied = await reduceVehicleReliability(vehicle, damage);
    await addComponentDamage(vehicle, 'suspension', applied);
    context.events.push(localize('YZEGS.LandVehicle.Damage.ReliabilityLoss', {
      component: localize('YZEGS.LandVehicle.Components.suspension'), damage: applied,
    }));
    return { remaining: Math.max(0, damage - applied) };
  }
  if (component === 'ammunition') {
    const priorDamage = componentDamage(vehicle, 'ammunition');
    const capacity = Math.max(0, 2 - priorDamage);
    const applied = Math.min(capacity, damage);
    await addComponentDamage(vehicle, 'ammunition', applied);
    const totalDamage = priorDamage + applied;
    await loseVehicleAmmunition(vehicle, ammunitionRemainingFraction(totalDamage));
    const heavyAmmunition = vehicle.items.some(item => (
      item.type === 'weapon' && item.system.isMounted && item.system.props?.heavyWeapon
    ))
      || ammunitionItems(vehicle).some(item => getBlastDamageProfile(item.system.blast));
    let exploded = false;
    if (heavyAmmunition) {
      const explosion = await rollAmmunitionExplosion(ammunitionExplosionChance(totalDamage));
      exploded = explosion.exploded;
      if (explosion.roll) context.rolls.push(explosion.roll);
    }
    context.events.push(localize(totalDamage >= 2
      ? 'YZEGS.LandVehicle.Damage.AllAmmunitionLost'
      : 'YZEGS.LandVehicle.Damage.HalfAmmunitionLost'));
    if (exploded) {
      await destroyVehicle(vehicle, 'ammunitionExplosion');
      const blast = increaseBlastRating(strongestVehicleBlast(vehicle) === '–'
        ? 'D'
        : strongestVehicleBlast(vehicle));
      await resolvePenetratingVehicleBlast(vehicle, blast, vehicle.name);
      context.events.push(localize('YZEGS.LandVehicle.Damage.AmmunitionExplosion', { blast }));
    }
    return { remaining: Math.max(0, damage - applied) };
  }
  if (component === 'cargo' || component === 'externalStores') {
    const item = randomEntry(storedItems(vehicle, component === 'externalStores'));
    if (!item) return { remaining: damage };
    const result = await damageItem(item, damage);
    context.events.push(localize(result.destroyed
      ? 'YZEGS.LandVehicle.Damage.ItemDestroyed'
      : 'YZEGS.LandVehicle.Damage.ItemHit', {
      component: localize(`YZEGS.LandVehicle.Components.${component}`),
      item: item.name,
      damage: result.applied,
    }));
    return { remaining: component === 'cargo' && result.destroyed
      ? Math.max(0, damage - result.applied)
      : 0 };
  }
  if (component === 'radio') {
    const current = Math.max(0, Number(vehicle.system.components.radio?.reliability?.value) || 0);
    const applied = Math.min(current, damage);
    await vehicle.update({
      'system.components.radio.reliability.value': current - applied,
      'system.components.radio.damage': componentDamage(vehicle, 'radio') + applied,
    });
    context.events.push(localize('YZEGS.LandVehicle.Damage.RadioHit', { damage: applied }));
    return { remaining: Math.max(0, damage - applied) };
  }
  if (component === 'trackWheel') {
    const sideArmor = Number(vehicle.system.armor?.[context.facing]?.value) || 0;
    const effect = trackWheelDamage(damage, sideArmor, context.attackData.armorModifier);
    const applied = await reduceVehicleReliability(vehicle, effect);
    await addComponentDamage(vehicle, 'trackWheel', applied);
    context.events.push(localize(effect
      ? 'YZEGS.LandVehicle.Damage.TrackHit'
      : 'YZEGS.LandVehicle.Damage.TrackStopped', { damage: applied }));
    return { remaining: 0 };
  }
  if (component === 'weapon') {
    const item = randomEntry(mountedWeapons(vehicle));
    if (!item) return { remaining: 0 };
    const effect = armoredWeaponDamage(
      damage,
      vehicle.system.armor?.front?.value,
      context.attackData.armorModifier,
      item.system.props?.armored,
    );
    const result = await damageItem(item, effect);
    context.events.push(localize('YZEGS.LandVehicle.Damage.WeaponHit', {
      weapon: item.name, damage: result.applied,
    }));
    return { remaining: 0 };
  }
  if (component === 'fcs') {
    await addComponentDamage(vehicle, 'fcs', 1);
    context.events.push(localize('YZEGS.LandVehicle.Damage.FcsHit'));
    return { remaining: 0 };
  }
  if (component === 'antenna') {
    await vehicle.update({
      'system.components.antenna.damage': componentDamage(vehicle, 'antenna') + 1,
      'system.components.radio.reliability.value': 0,
    });
    context.events.push(localize('YZEGS.LandVehicle.Damage.AntennaHit'));
    return { remaining: 0 };
  }
  if (component === 'exposedPassenger') {
    const occupant = randomEntry(crewEntries(vehicle, { exposed: true, excluded: context.hitCrew }));
    const actor = crewActor(occupant);
    if (actor) {
      context.hitCrew.add(actor.uuid);
      const hitData = foundry.utils.deepClone(context.attackData);
      delete hitData.location;
      await actor.applyDamage(damage, hitData, true);
      context.events.push(localize('YZEGS.LandVehicle.Damage.ExposedPassengerHit', {
        actor: actor.name, damage,
      }));
    }
    return { remaining: 0 };
  }
  if (component === 'ricochet') {
    await resolveRicochet(vehicle, context);
    return { remaining: 0 };
  }
  return { remaining: damage };
}

async function rollComponent(context) {
  const roll = await new Roll('1d10').evaluate();
  context.rolls.push(roll);
  return Number(roll.total) || 1;
}

/** Resolve land-vehicle component effects and penetrating secondary damage. */
export async function resolveLandVehicleComponentDamage(vehicle, {
  damage,
  penetrated,
  facing,
  attackData = {},
  calledComponent = '',
} = {}) {
  const context = { attackData, facing, events: [], rolls: [], hitCrew: new Set() };
  let row;
  let component;
  if (calledComponent) {
    component = calledComponent;
    row = getLandVehicleComponentRow(component, false);
    if (!row || (component === 'trackWheel' && !['left', 'right'].includes(facing))) {
      context.events.push(localize('YZEGS.LandVehicle.Damage.CalledShotUnavailable'));
      return { component, events: context.events, rolls: context.rolls };
    }
  }
  else {
    do {
      row = await rollComponent(context);
      component = getLandVehicleComponent(row, penetrated);
    } while (!penetrated && component === 'trackWheel' && !['left', 'right'].includes(facing));
  }

  if (!penetrated) {
    if (!componentAvailable(vehicle, component, context)) {
      context.events.push(localize('YZEGS.LandVehicle.Damage.ComponentUnavailable', {
        component: localize(`YZEGS.LandVehicle.Components.${component}`),
      }));
      return { component, events: context.events, rolls: context.rolls };
    }
    await applyComponent(vehicle, component, damage, context);
    return { component, events: context.events, rolls: context.rolls };
  }

  let remaining = Math.max(0, Number(damage) || 0);
  const firstComponent = component;
  while (remaining > 0 && row > 0) {
    component = getLandVehicleComponent(row, true);
    if (!componentAvailable(vehicle, component, context)) {
      row = nextPenetratingComponentRow(row);
      continue;
    }
    const result = await applyComponent(vehicle, component, remaining, context);
    remaining = result.remaining;
    if (!result.repeatedPassenger) row = nextPenetratingComponentRow(row);
    if (vehicle.system.landVehicle?.destroyed) remaining = 0;
  }
  if (remaining > 0) {
    context.events.push(localize('YZEGS.LandVehicle.Damage.Unallocated', { damage: remaining }));
  }
  return { component: firstComponent, events: context.events, rolls: context.rolls };
}

/** Permanently destroy burning land vehicles when their fuel-fire Stretch expires. */
export async function advanceLandVehicleWorldTime(worldTime, _delta, _options, userId) {
  if (!game.user.isGM || userId !== game.user.id) return;
  const vehicles = game.actors.filter(actor => (
    actor.type === 'vehicle'
    && actor.system.domain === 'land'
    && actor.system.landVehicle?.fuelFire
    && !actor.system.landVehicle.destroyed
    && Number(actor.system.landVehicle.fuelFireDeadline) > 0
    && Number(actor.system.landVehicle.fuelFireDeadline) <= Number(worldTime)
  ));
  for (const vehicle of vehicles) {
    await destroyVehicle(vehicle, 'fuelFire');
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: vehicle }),
      content: `<div class="yzegs chat-card vehicle-damage-card"><h3>${
        localize('YZEGS.LandVehicle.Damage.DestroyedTitle')
      }</h3><p>${localize('YZEGS.LandVehicle.Damage.DestroyedByFuelFire', { vehicle: vehicle.name })}</p></div>`,
    });
  }
}

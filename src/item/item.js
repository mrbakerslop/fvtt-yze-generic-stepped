import { YearZeroRoll } from '../lib/yzur.js';
import { getChatCardActor } from '../components/chat/chat.js';
import { YZEGS } from '../system/config.js';
import { getCharacterFieldLabels } from '../system/character-field-labels.js';
import { getAttributeAndSkill, getDieSize, YZEGSRoller } from '../components/roll/dice.js';
import YZEGSDialog from '../components/dialog/dialog.js';
import { getSkillCombatType } from '../system/combat-modifiers.js';
import { usesItemQuantity } from '../system/item-quantity.js';
import {
  isCompatibleWeaponAmmunition,
  weaponUsesInternalMagazine,
} from '../system/ammunition-compatibility.js';
import {
  getInternalReloadAmount,
  getReloadModifier,
  getReloadSkill,
  getReloadSources,
  INTERNAL_RELOAD_MODES,
  INTERNAL_RELOAD_MODE_SETTING,
  isActorInActiveCombat,
  isHeavyWeapon,
  resolveReloadAction,
} from '../system/reloading.js';
import { getEffectiveWeaponProfile } from '../system/weapon-profile.js';
import { getClearJamModifier, resolveClearJamAction } from '../system/weapon-jams.js';
import { getRangedPreparation } from '../system/ranged-actions.js';
import { getTwilightAction } from '../system/twilight-actions.js';
import { coverAppliesAgainst, isBlockableAction } from '../system/defense.js';
import { createCloseAttackDeclaration } from '../system/defense-workflows.js';
import { getEnclosingVehicle } from '../system/suppression.js';
import {
  CQ_ENGAGEMENT_FLAG,
  urbanCombatEnabled,
  URBAN_SYSTEM_ID,
} from '../system/urban-operations.js';
import {
  beginCloseQuartersEngagement,
  exposeAttackerForHuggingWall,
  resolveEngagementFireTarget,
} from '../system/urban-workflows.js';
import { isConfinedSpaceScene, isRicochetEligibleWeapon } from '../system/confined-space.js';
import { isValidGuidedWeaponTarget, targetInFiringArc } from '../system/water-rules.js';
import {
  ambushPreventsBlock,
  consumeAmbushOpening,
  getAmbushAttackModifier,
} from '../system/initiative-workflows.js';
import {
  prepareCloseCombatEdges,
  findFriendlyFireTargets,
  isDefenseless,
  prepareRangedCombatEdges,
  prepareRangedCombatPointEdges,
  movedSincePreviousTurn,
  sumEdgeModifiers,
} from '../system/combat-edge-workflows.js';
import { getMachineGunSupportRule } from '../system/combat-edge-rules.js';
import { CALLED_VEHICLE_COMPONENTS } from '../system/land-vehicle-damage-rules.js';
import {
  isCloseCombatPositionAllowed,
  requiresCloseCombatSameGridSpace,
} from '../system/close-combat-positioning.js';
import {
  getHeavyWeaponAttribute,
  getHeavyWeaponTargetModifier,
  isArtilleryWeapon,
  usesHeavyWeaponRules,
} from '../system/heavy-weapons.js';
import { pickExplosionTargetPoint, snapshotCanvasPoint } from '../system/blast-workflows.js';
import { ITEM_CHAT_TEMPLATES } from '../system/item-chat-templates.js';

/**
 * Year Zero Engine - Generic Stepped Dice Item.
 * @extends {Item} Extends the basic Item
 */
export default class ItemYZEGS extends Item {
  /* ------------------------------------------- */
  /*  Properties                                 */
  /* ------------------------------------------- */

  get qty() {
    return this.system.qty;
  }

  get isPhysical() {
    return YZEGS.physicalItems.includes(this.type);
  }

  get hasDamage() {
    return !!this.system.damage;
  }

  get hasAttack() {
    return this.hasDamage || this.hasAmmo;
  }

  get isStashed() {
    if (this.isPhysical) return this.system.backpack;
    return null;
  }

  get isEquipped() {
    return this.system.equipped;
  }

  get isDisposable() {
    return !!this.system.props?.disposable;
  }

  get isMounted() {
    if (this.system.props?.mounted == undefined) return null;
    return this.isEquipped && this.system.props?.mounted;
  }

  get hasAmmo() {
    return !!this.system.ammo && (
      !!this.system.mag?.max
      || !!this.system.props?.ammoBelt
      || !!this.system.props?.magazineFed
      || !!this.system.props?.internalMagazine
    );
  }

  get hasReliability() {
    return !!this.system.reliability?.max;
  }

  get hasModifier() {
    if (!this.system.rollModifiers) return false;
    return !foundry.utils.isEmpty(this.system.rollModifiers);
  }

  // get inVehicle() {
  //   return this.actor?.type === 'vehicle';
  // }

  /**
   * The name with a quantity in parentheses.
   * @type {string}
   * @readonly
   */
  get detailedName() {
    let str = this.name;
    if (this.type === 'ammunition') {
      const ammo = this.system.ammo;
      str += ` [${ammo.value}/${ammo.max}]`;
    }
    else if (this.type === 'weapon' && this.actor?.type === 'vehicle') {
      const ffv = [];
      for (const [k, v] of Object.entries(this.system.featuresForVehicle)) {
        if (v) ffv.push(k.toUpperCase());
      }
      if (ffv.length) str += ` (${ffv.join(', ')})`;
    }
    if (this.qty > 1) {
      str += ` (${this.qty})`;
    }
    return str;
  }

  get modifiersDescription() {
    if (!this.hasModifier) return undefined;
    return this._getModifiersDescription(this.system.rollModifiers);
  }

  get encumbranceModifiers() {
    if (!this.hasModifier) return 0;
    return this._getModifiersEncumbrance(this.system.rollModifiers);
  }

  /* ------------------------------------------- */
  /*  Data Preparation                           */
  /* ------------------------------------------- */

  /**
   * Augments the basic Item data model with additional dynamic data.
   * @override
   */
  prepareData() {
    super.prepareData();

    const actorData = this.actor ?? {};
    const system = this.system;

    if (this.type === 'ammunition') {
      if (system.props?.ammoBox) {
        system.props.magazine = false;
        system.props.ammoBelt = false;
      }
      else if (system.props?.ammoBelt) system.props.magazine = false;
      else if (system.props?.magazine) system.props.ammoBelt = false;
    }
    else if (this.type === 'weapon') {
      if (system.props?.internalMagazine) {
        system.props.magazineFed = false;
        system.props.ammoBelt = false;
      }
      else if (system.props?.ammoBelt) system.props.magazineFed = false;
      else if (system.props?.magazineFed) system.props.ammoBelt = false;
    }

    // Magazine and belt Items each represent one physical ammunition carrier.
    // Their rounds are tracked by ammo.value, so a generic stack is ambiguous.
    if (!usesItemQuantity(this.type, system)) system.qty = 1;

    this._prepareEncumbrance(this.type, system);

    switch (this.type) {
      case 'weapon':
        this._prepareWeapon(system, actorData);
        break;
      case 'grenade':
        system.effectiveAttack = getEffectiveWeaponProfile(system);
        break;
      case 'skill':
        system.value = getDieSize(system.score);
        break;
    }
  }

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    if (this.type === 'ammunition') {
      if (this.system.props?.ammoBox) {
        this.updateSource({
          'system.props.magazine': false,
          'system.props.ammoBelt': false,
        });
      }
      else if (this.system.props?.ammoBelt) {
        this.updateSource({
          'system.props.magazine': false,
          'system.props.ammoBox': false,
        });
      }
    }
    else if (this.type === 'weapon') {
      if (this.system.props?.internalMagazine) {
        this.updateSource({
          'system.props.magazineFed': false,
          'system.props.ammoBelt': false,
        });
      }
      else if (this.system.props?.ammoBelt) {
        this.updateSource({ 'system.props.magazineFed': false });
      }
    }
    if (!usesItemQuantity(this.type, this.system)) this.updateSource({ 'system.qty': 1 });
  }

  /** @override */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);
    const magazineChange = foundry.utils.getProperty(changed, 'system.props.magazine')
      ?? changed['system.props.magazine'];
    const ammoBeltChange = foundry.utils.getProperty(changed, 'system.props.ammoBelt')
      ?? changed['system.props.ammoBelt'];
    const ammoBoxChange = foundry.utils.getProperty(changed, 'system.props.ammoBox')
      ?? changed['system.props.ammoBox'];
    const magazineFedChange = foundry.utils.getProperty(changed, 'system.props.magazineFed')
      ?? changed['system.props.magazineFed'];
    const internalMagazineChange = foundry.utils.getProperty(changed, 'system.props.internalMagazine')
      ?? changed['system.props.internalMagazine'];
    if (this.type === 'ammunition') {
      let isMagazine = magazineChange ?? this.system.props?.magazine;
      let isAmmoBelt = ammoBeltChange ?? this.system.props?.ammoBelt;
      let isAmmoBox = ammoBoxChange ?? this.system.props?.ammoBox;
      if (ammoBoxChange === true) {
        isMagazine = false;
        isAmmoBelt = false;
      }
      else if (ammoBeltChange === true) {
        isMagazine = false;
        isAmmoBox = false;
      }
      else if (magazineChange === true) {
        isAmmoBelt = false;
        isAmmoBox = false;
      }
      foundry.utils.setProperty(changed, 'system.props.magazine', isMagazine);
      foundry.utils.setProperty(changed, 'system.props.ammoBelt', isAmmoBelt);
      foundry.utils.setProperty(changed, 'system.props.ammoBox', isAmmoBox);
      if (isMagazine || isAmmoBelt) foundry.utils.setProperty(changed, 'system.qty', 1);
    }
    else if (this.type === 'weapon') {
      let isAmmoBelt = ammoBeltChange ?? this.system.props?.ammoBelt;
      let isMagazineFed = magazineFedChange ?? this.system.props?.magazineFed;
      let isInternalMagazine = internalMagazineChange ?? this.system.props?.internalMagazine;
      if (internalMagazineChange === true) {
        isAmmoBelt = false;
        isMagazineFed = false;
      }
      else if (ammoBeltChange === true) {
        isMagazineFed = false;
        isInternalMagazine = false;
      }
      else if (magazineFedChange === true) {
        isAmmoBelt = false;
        isInternalMagazine = false;
      }
      foundry.utils.setProperty(changed, 'system.props.ammoBelt', isAmmoBelt);
      foundry.utils.setProperty(changed, 'system.props.magazineFed', isMagazineFed);
      foundry.utils.setProperty(changed, 'system.props.internalMagazine', isInternalMagazine);
      if (ammoBeltChange !== undefined || magazineFedChange !== undefined || internalMagazineChange !== undefined) {
        foundry.utils.setProperty(changed, 'system.mag.target', '');
      }
    }
  }

  /* ------------------------------------------- */

  /**
   * Prepares weapon data.
   * @param {Object} system       Item's system
   * @param {Object} actorData  Actor's data (1x)
   * @private
   */
  _prepareWeapon(system, actorData = {}) {
    // Adds "data.mount: [number]" property.
    if (actorData.type === 'vehicle') {
      if (system.equipped && system.props?.mounted) {
        system.isMounted = true;
      }
      else {
        system.isMounted = false;
      }
    }

    if (this.hasAmmo) {
      const internal = weaponUsesInternalMagazine(this);
      const ammunition = this.actor?.items.get(system.mag.target);
      system.reload = {
        value: internal
          ? Math.max(0, Number(system.mag.value) || 0)
          : Math.max(0, Number(ammunition?.system.ammo?.value) || 0),
        max: internal
          ? Math.max(0, Number(system.mag.max) || 0)
          : Math.max(0, Number(ammunition?.system.ammo?.max ?? system.mag.max) || 0),
        sourceName: internal ? '' : ammunition?.name ?? '',
      };
      system.effectiveAttack = getEffectiveWeaponProfile(system, ammunition);
    }
    else {
      system.effectiveAttack = getEffectiveWeaponProfile(system);
    }
  }

  /* ------------------------------------------- */

  /**
   * Calculates a custom encumbrance for items.
   * @param {string} type  Item type
   * @param {Object} system  Item's system
   * @private
   */
  _prepareEncumbrance(type, system) {
    let weight = 0;
    if (type === 'ammunition' && usesItemQuantity(type, system)) {
      weight = system.qty * system.weight * system.ammo.value;
    }
    else {
      weight = system.qty * system.weight;
    }
    if (!weight) system.encumbrance = 0;
    else system.encumbrance = weight;
  }

  /* ------------------------------------------- */

  /**
   * Returns a number summing all encumbrance modifiers from specialties.
   * @param {Object} modifiersData item.system.rollModifiers
   * @returns {number}
   */
  _getModifiersEncumbrance(modifiersData) {
    let out = 0;

    for (const m of Object.values(modifiersData)) {
      if (m && m.name === 'constant.encumbrance') {
        out += +m.value;
      }
    }
    return out;
  }

  /* ------------------------------------------- */

  /**
   * Returns a string resuming the modifiers.
   * @param {Object} modifiersData item.system.rollModifiers
   * @returns {string}
   * @private
   */
  _getModifiersDescription(modifiersData) {
    const out = [];

    for (const m of Object.values(modifiersData)) {
      if (m && m.name) {
        const [t, n] = m.name.split('.');
        let type = '';
        switch (t) {
          case 'attribute':
            type = 'Attribute';
            break;
          case 'constant':
            type = 'Constant';
            break;
          case 'skill':
            type = 'Skill';
            break;
          case 'action':
            type = 'Action';
            break;
          case 'travel':
            type = 'TravelTask';
            break;
        }
        let targetLabel;
        if (t === 'attribute') targetLabel = getCharacterFieldLabels()[n];
        else if (t === 'skill') targetLabel = this.actor?.getSkill(n)?.name ?? game.items.get(n)?.name ?? n;
        else targetLabel = game.i18n.localize(`YZEGS.${type}Names.${n}`);
        const str = targetLabel + ` ${m.value}`;
        out.push(str);
      }
    }
    return out.join(', ');
  }

  /* ------------------------------------------- */
  /*  Event Handlers                             */
  /* ------------------------------------------- */

  /** @override */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);

    // When creating an item in a character.
    if (this.actor && this.actor.type === 'character') {
      // When creating an injury in a character.
      if (this.type === 'injury') {
        // If there is a heal time set.
        let healTime = this.system.healTime;
        if (healTime && !Number(this.system.state?.healingDays)) {
          try {
            const roll = Roll.create(healTime);
            await roll.evaluate();
            healTime = roll.terms.reduce((sum, t) => sum + t.values.reduce((tot, v) => tot + v, 0), 0);
            await this.update({ 'system.state.healingDays': Math.max(0, Number(healTime) || 0) });
          }
          catch (e) {
            console.warn('yzegs | Item#_onCreate | Invalid formula for Injury heal time roll.');
          }
        }
      }
    }
  }

  /* ------------------------------------------- */
  /*  Item Roll                                  */
  /* ------------------------------------------- */

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or reload roll options.
   * @param {string}  [messageMode] The message visibility mode for the card
   * @param {Actor}   [actor]       The actor that rolled the item, if any
   * @param {boolean} [sendMessage] Whether to automatically create a chat message (if true) or simply return
   *   the prepared chat message data (if false).
   * @return {Promise<ChatMessage|object>}
   */
  async roll({ messageMode, actor = null, askForOptions = false, sendMessage = true } = {}) {
    if (this.type === 'skill') {
      actor = actor ?? this.actor;
      if (!actor) return this.displayCard({ messageMode, sendMessage });
      const attributeName = this.system.attribute;
      return YZEGSRoller.taskCheck({
        title: this.name,
        actor,
        attributeName,
        skillName: this.id,
        combatType: getSkillCombatType(this),
        attribute: actor.system.attributes?.[attributeName]?.value ?? 0,
        skill: this.system.value,
        askForOptions,
        messageMode,
        sendMessage,
      });
    }
    if (['weapon', 'grenade'].includes(this.type)) {
      return this.rollAttack({ messageMode, sendMessage, askForOptions }, actor ?? this.actor);
    }
    else if (this.type === 'armor') {
      const mod = await YZEGSDialog.chooseValue({
        value: 0,
        title: game.i18n.format('YZEGS.Dialog.ChooseValue.Armor', {
          name: this.name,
        }),
      });
      return this.updateArmor(mod?.value ?? 0);
    }
    else if (this.type === 'ammunition') {
      const mod = await YZEGSDialog.chooseValue({
        value: 0,
        title: game.i18n.format('YZEGS.Dialog.ChooseValue.Ammo', { name: this.name }),
      });
      return this.updateAmmo(mod?.value ?? 0);
    }
    else if (this.isDisposable) {
      const mod = await YZEGSDialog.chooseValue({
        value: 0,
        title: game.i18n.format('YZEGS.Dialog.ChooseValue.Qty', { name: this.name }),
      });
      if (mod?.value) {
        return this.update({ 'system.qty': this.qty + mod.value });
      }
      else return;
    }
    // Creates or returns the chat message data.
    return this.displayCard({ messageMode, sendMessage });
  }

  /* ------------------------------------------- */

  /**
   * Places an attack using an item (weapon, grenade, or equipment).
   * @param {object} options Roll options which are configured and provided to the task check
   * @param {Actor}  actor   (for Vehicles) You can define another actor that holds the weapon
   * @returns {Promise<YearZeroRoll|ChatMessage>}
   * @async
   */
  async rollAttack(options = {}, actor = null) {
    if (!this.hasAttack && !this.actor) {
      throw new Error('You may not place an Attack Roll with this Item.');
    }
    if (!this.actor) throw new Error('This weapon has no bearer.');
    if (this.hasReliability && this.system.reliability.value <= 0) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Chat.Roll.NoReliabilityNotif'));
    }
    if (this.type === 'weapon' && this.system.jammed) {
      return ui.notifications.warn(game.i18n.format('YZEGS.Jam.CannotFire', { weapon: this.name }));
    }
    const bearer = actor ?? this.actor;
    if (bearer.type === 'vehicle' && bearer.system.domain === 'land'
      && bearer.system.landVehicle?.destroyed) {
      return ui.notifications.warn(game.i18n.format('YZEGS.LandVehicle.Errors.Destroyed', {
        vehicle: bearer.name,
      }));
    }
    const bearerInWater = bearer.statuses?.has?.('swimming') || bearer.statuses?.has?.('submerged');
    if (bearerInWater && this.type === 'weapon' && Boolean(this.system.ammo)) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Water.Errors.NoRangedWhileSwimming'));
    }
    const itemType = String(this.system.itemType ?? '').toLocaleLowerCase();
    const isBow = this.type === 'weapon' && /bow/.test(itemType) && !/crossbow/.test(itemType);
    if (isBow && !this.getFlag('fvtt-yze-generic-stepped', 'prepared')) {
      return ui.notifications.warn(game.i18n.format('YZEGS.CombatActions.Errors.BowNotPrepared', {
        weapon: this.name,
      }));
    }
    if (this.type === 'grenade' && !this.getFlag('fvtt-yze-generic-stepped', 'prepared')) {
      return ui.notifications.warn(game.i18n.format('YZEGS.CombatActions.Errors.GrenadeNotPrepared', {
        weapon: this.name,
      }));
    }

    // Prepares data.
    const itemData = this.system;
    const heavyWeaponRules = usesHeavyWeaponRules(this);
    const artillery = isArtilleryWeapon(this);
    let defaultActionId = 'meleeAttack';
    if (this.type === 'grenade') defaultActionId = 'throwWeapon';
    else if (/bow|crossbow/.test(itemType)) defaultActionId = 'shootBow';
    else if (heavyWeaponRules) defaultActionId = 'shootHeavyWeapon';
    else if (itemData.ammo) defaultActionId = 'shootFirearm';
    let title = game.i18n.format('YZEGS.Combat.Attack', { weapon: this.name });
    let qty = itemData.qty;
    const skillItem = actor?.getSkill(itemData.skill) ?? this.actor.getSkill(itemData.skill);
    let attributeName = skillItem?.system.attribute ?? itemData.attribute;
    const machineGunSupport = getMachineGunSupportRule(itemData.itemType, itemData.props);
    const heavyAttribute = getHeavyWeaponAttribute(this);
    if (heavyAttribute) attributeName = heavyAttribute;
    if (machineGunSupport.machineGun
      && (itemData.props?.tripod || itemData.props?.mounted)) attributeName = 'agl';
    const skillName = skillItem?.id ?? itemData.skill;
    const isDisposable = itemData.props.disposable;

    // Prepares values.
    if (!actor) actor = this.actor;
    if (
      actor.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG)
      && defaultActionId !== 'meleeAttack'
    ) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Urban.Engagement.RestrictedAction'));
    }
    const inActiveCombat = isActorInActiveCombat(actor, game.combat);
    const currentActor = game.combat?.combatant?.actor;
    const actingOutOfTurn = inActiveCombat
      && currentActor
      && currentActor.uuid !== actor.uuid
      && currentActor.id !== actor.id;
    const reactiveAttack = options?.combatAction?.id === 'retreatFreeAttack';
    if (actingOutOfTurn && !actor.statuses?.has?.('overwatch') && !reactiveAttack) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.CombatActions.Errors.NotYourTurn'));
    }
    const actorData = actor.system;
    const attribute = actorData.attributes?.[attributeName]?.value ?? 0;
    const skill = skillItem?.system.value ?? 0;
    let rof = heavyWeaponRules ? 0 : itemData.rof;
    let targetTokens = [...(game.user.targets ?? [])];
    let targetActors = targetTokens.map(token => token.actor).filter(Boolean);
    if (options?.targetActorUuid) {
      try {
        // eslint-disable-next-line no-undef
        const explicitTarget = await fromUuid(options.targetActorUuid);
        const explicitActor = explicitTarget?.actor ?? explicitTarget;
        if (explicitActor) {
          targetActors = [explicitActor];
          targetTokens = explicitActor.getActiveTokens?.(true, true) ?? [];
        }
      }
      catch (_error) { /* Validation below handles a stale explicit target. */ }
    }
    if (options?.defense?.defenderUuid) {
      try {
        // A declared attack remains tied to the defender who answered it even if
        // the attacker changes token targets while the staged workflow is open.
        // eslint-disable-next-line no-undef
        const declaredDefender = fromUuidSync(options.defense.defenderUuid);
        if (declaredDefender) {
          const defenderActor = declaredDefender.actor ?? declaredDefender;
          targetActors = [defenderActor];
          targetTokens = defenderActor.getActiveTokens?.(true, true) ?? [];
        }
      }
      catch (_error) { /* Stale targets are handled by the linked chat workflow. */ }
    }
    if (targetActors.length === 1 && ['shootFirearm', 'shootBow', 'shootHeavyWeapon'].includes(defaultActionId)) {
      const resolvedTarget = await resolveEngagementFireTarget(actor, targetActors[0]);
      if (resolvedTarget?.uuid !== targetActors[0].uuid) {
        targetActors = [resolvedTarget];
        targetTokens = resolvedTarget.getActiveTokens?.(true, true) ?? [];
      }
    }
    const effectiveProfile = getEffectiveWeaponProfile(
      this,
      this.actor.items.get(this.system.mag.target),
    );
    const explosiveAttack = ['A', 'B', 'C', 'D'].includes(
      String(effectiveProfile.blast ?? '').toLocaleUpperCase(),
    );
    const guidance = this.system.guidance ?? { mode: 'none' };
    const guidanceMode = guidance.mode ?? 'none';
    let targetPoint = targetTokens[0]?.center
      ? snapshotCanvasPoint(targetTokens[0].center)
      : null;
    if (explosiveAttack && !targetActors.length && guidanceMode === 'none') {
      targetPoint = await pickExplosionTargetPoint();
      if (!targetPoint) return null;
    }
    let targetMode = '';
    if (targetActors[0]) {
      targetMode = ['character', 'npc'].includes(targetActors[0].type) ? 'individual' : 'large';
    }
    else if (targetPoint) targetMode = 'hex';
    const ambushOpening = targetActors.length === 1 && ambushPreventsBlock(actor, targetActors[0]);
    const ambushModifier = ambushOpening ? getAmbushAttackModifier(actor, targetActors[0]) : 0;
    const isRangedAttack = defaultActionId !== 'meleeAttack';
    let combatEdges = { modifiers: [], damageReduction: 0, band: '', forcedLocation: '' };
    if (isRangedAttack) {
      combatEdges = targetMode === 'hex'
        ? prepareRangedCombatPointEdges(actor, targetPoint, this)
        : prepareRangedCombatEdges(actor, targetActors[0] ?? null, this);
      const heavyTargetModifier = getHeavyWeaponTargetModifier(this, targetMode);
      if (heavyTargetModifier) {
        combatEdges.modifiers.push({
          id: 'heavy-individual-target',
          label: game.i18n.localize('YZEGS.Heavy.Modifiers.IndividualTarget'),
          value: heavyTargetModifier,
          displayValue: `−${Math.abs(heavyTargetModifier)}`,
        });
      }
      const enclosing = actor.type === 'vehicle'
        ? { vehicle: actor }
        : getEnclosingVehicle(actor, game.actors);
      const stabilized = Boolean(
        this.system.featuresForVehicle?.s
        || (
          this.system.featuresForVehicle?.fcs
          && this.actor?.system.components?.fcs?.active
          && Number(this.actor.system.components.fcs.damage) < 1
        ),
      );
      if (enclosing?.vehicle && movedSincePreviousTurn(actor, enclosing.vehicle) && !stabilized) {
        combatEdges.modifiers.push({
          id: 'ranged-moving-vehicle',
          label: game.i18n.localize('YZEGS.CombatModifiers.Entries.rangedMovingVehicle'),
          value: -2,
          displayValue: '−2',
        });
      }
      if (combatEdges.unsupported) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.CombatEdges.Errors.HeavyMachineGunSupport'));
      }
    }
    else if (targetActors.length === 1) combatEdges = prepareCloseCombatEdges(actor, targetActors[0]);
    if (targetActors.length === 1) {
      if (!isRangedAttack && !isCloseCombatPositionAllowed(
        combatEdges.differentHex,
        requiresCloseCombatSameGridSpace(),
      )) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.CombatEdges.Errors.CloseSameHex'));
      }
      if (isRangedAttack && combatEdges.outOfRange) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.CombatEdges.Errors.OutOfRange'));
      }
    }
    else if (targetMode === 'hex' && isRangedAttack && combatEdges.outOfRange) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.CombatEdges.Errors.OutOfRange'));
    }
    if (this.type === 'grenade'
      && !['', 'sameHex', 'short'].includes(combatEdges.band)) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Heavy.Errors.GrenadeShortRange'));
    }
    if (guidanceMode !== 'none') {
      if (targetActors.length !== 1) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.Guidance.Errors.SingleTarget'));
      }
      if (!isValidGuidedWeaponTarget(this.system.guidance.targetClass, targetActors[0])) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.Guidance.Errors.InvalidTarget'));
      }
      const sourceToken = actor.getActiveTokens?.(true, true)?.[0];
      const targetToken = targetTokens[0];
      if (!targetInFiringArc(sourceToken, targetToken, this.system.guidance.firingArc)) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.Guidance.Errors.FiringArc'));
      }
    }
    const targetUuids = targetActors.map(target => target.uuid);
    if (targetActors.length === 1 && ['shootFirearm', 'shootBow', 'shootHeavyWeapon'].includes(defaultActionId)) {
      await exposeAttackerForHuggingWall(actor, targetActors[0]);
    }
    if (
      isBlockableAction(defaultActionId)
      && !options?.skipDefenseDeclaration
      && !ambushOpening
      && !isDefenseless(targetActors[0])
    ) {
      if (targetActors.length !== 1) {
        return ui.notifications.warn(game.i18n.localize('YZEGS.Defense.SelectSingleTarget'));
      }
      return createCloseAttackDeclaration({
        attacker: actor,
        defender: targetActors[0],
        item: this,
        actionId: defaultActionId,
        selection: { actionId: defaultActionId, targetUuid: targetActors[0].uuid, itemId: this.id },
      });
    }
    const usesRangedPreparation = this.type === 'weapon' && (Boolean(itemData.ammo) || /bow/.test(itemType));
    const rangedPreparation = usesRangedPreparation
      ? getRangedPreparation(actor, this, targetUuids)
      : { blocked: false, modifier: 0, noAmmoDice: false };
    const breaksAim = usesRangedPreparation && actor.statuses?.has?.('aiming') && !rangedPreparation.aimed;
    if (rangedPreparation.blocked) {
      return ui.notifications.warn(game.i18n.format('YZEGS.CombatActions.Errors.HeavyWeaponNotAimed', {
        weapon: this.name,
      }));
    }
    if (rangedPreparation.noAmmoDice) rof = 0;

    // Gets the magazine.
    const track =
      (this.actor.type === 'character' && game.settings.get('fvtt-yze-generic-stepped', 'trackPcAmmo')) ||
      (this.actor.type === 'npc' && game.settings.get('fvtt-yze-generic-stepped', 'trackNpcAmmo')) ||
      (this.actor.type === 'vehicle' && game.settings.get('fvtt-yze-generic-stepped', 'trackVehicleAmmo'));

    let ammo = null;
    if (track && this.hasAmmo) {
      if (weaponUsesInternalMagazine(this)) {
        const ammoLeft = this.system.mag.value;
        if (ammoLeft <= 0) {
          ui.notifications.warn(game.i18n.format('YZEGS.Combat.NoAmmoLeft', { weapon: this.name }));
          return;
        }
        ammo = this;
        rof = Math.min(rof, ammoLeft - 1);
      }
      else {
        ammo = this.actor.items.get(this.system.mag.target);
        if (ammo?.system) {
          if (!isCompatibleWeaponAmmunition(this, ammo)) {
            ui.notifications.warn(game.i18n.format('YZEGS.Combat.IncompatibleAmmo', {
              ammo: ammo.name,
              weapon: this.name,
            }));
            return;
          }
          const ammoLeft = ammo.system.ammo.value ?? ammo.system.qty;
          if (ammoLeft <= 0) {
            ui.notifications.warn(game.i18n.format('YZEGS.Combat.NoAmmoLeft', { weapon: this.name }));
            return;
          }
          title += ` [${ammo.name}]`;
          rof = Math.min(rof, ammoLeft - 1);
        }
        else {
          ui.notifications.warn(game.i18n.format('YZEGS.Combat.NoMag', { weapon: this.name }));
          return;
        }
      }
    }

    // Checks unit quantity.
    if (track && isDisposable && qty <= 0) {
      ui.notifications.warn(game.i18n.format('YZEGS.Combat.NoQuantityLeft', { weapon: this.name }));
      return;
    }

    // Composes the options for the task check.
    const safeOptions = foundry.utils.getType(options) === 'Object' ? options : {};
    const defaultAction = getTwilightAction(defaultActionId);
    const rollConfig = foundry.utils.mergeObject(
      {
        title,
        attributeName,
        skillName,
        attribute,
        skill,
        combatType: getSkillCombatType(skillItem),
        rof,
        locate: true,
        hideCombatActions: false,
        combatAction: {
          id: defaultAction.id,
          label: game.i18n.localize(defaultAction.label),
          speed: defaultAction.speed,
          speedLabel: game.i18n.localize(`YZEGS.ActionTypes.${defaultAction.speed}`),
          value: 0,
          displayValue: '–',
        },
      },
      safeOptions,
    );
    const actionChoices = [rollConfig.combatAction];
    const canBlindFire = urbanCombatEnabled()
      && this.type === 'weapon'
      && Boolean(itemData.ammo)
      && defaultActionId !== 'meleeAttack';
    if (canBlindFire) {
      const blindFire = getTwilightAction('blindFire');
      actionChoices.push({
        id: blindFire.id,
        label: game.i18n.localize(blindFire.label),
        speed: blindFire.speed,
        speedLabel: game.i18n.localize(`YZEGS.ActionTypes.${blindFire.speed}`),
        value: 0,
        displayValue: '–',
        rollMode: 'blindFire',
        hint: game.i18n.localize('YZEGS.CombatActions.Hints.blindFire'),
      });
    }
    rollConfig.combatActionChoices = rollConfig.hideCombatActions ? [] : actionChoices;
    rollConfig.modifier = (Number(rollConfig.modifier) || 0)
      + rangedPreparation.modifier
      + ambushModifier
      + sumEdgeModifiers(combatEdges.modifiers);
    rollConfig.automaticModifiers = [...combatEdges.modifiers];
    if (bearerInWater && this.type === 'weapon' && this.system.props?.swinging) rollConfig.modifier -= 2;
    if (targetActors.length === 1
      && (targetActors[0].statuses?.has?.('swimming') || targetActors[0].statuses?.has?.('submerged'))
      && defaultActionId !== 'meleeAttack') rollConfig.modifier -= 1;
    const targetCover = targetActors.length === 1 ? targetActors[0].coverDetails : null;
    if (
      defaultActionId !== 'meleeAttack'
      && targetCover?.type === 'fullCover'
      && coverAppliesAgainst(targetCover, actor.uuid)
    ) {
      rollConfig.modifier -= 3;
      rollConfig.automaticModifiers.push({
        id: 'ranged-full-cover',
        label: game.i18n.localize('YZEGS.CombatModifiers.Entries.rangedFullCover'),
        value: -3,
        displayValue: '−3',
      });
    }
    // Better to not put them in a mergeObject:
    rollConfig.actor = actor;
    rollConfig.item = this;
    rollConfig.attackData = effectiveProfile;
    rollConfig.attackData.machineGunAgility = attributeName === 'agl'
      && machineGunSupport.machineGun
      && (itemData.props?.tripod || itemData.props?.mounted);
    rollConfig.attackData.ignoreCover = !isRangedAttack;
    if (combatEdges.damageReduction) {
      rollConfig.attackData.damage = Math.max(
        0,
        Number(rollConfig.attackData.damage) - combatEdges.damageReduction,
      );
      rollConfig.attackData.shotgunDamageReduction = combatEdges.damageReduction;
    }
    if (combatEdges.band) rollConfig.attackData.rangeBand = combatEdges.band;
    if (combatEdges.fireControlRange) rollConfig.attackData.fireControlRange = true;
    if (combatEdges.forcedLocation) rollConfig.attackData.forcedLocation = combatEdges.forcedLocation;
    if (targetActors.length === 1) {
      rollConfig.attackData.automatedModifierIds = isRangedAttack ? [
        'ranged-short-range', 'ranged-medium-range', 'ranged-long-range', 'ranged-extreme-range',
        'ranged-active-same-hex-handy', 'ranged-active-same-hex-other',
        'ranged-defenseless-same-hex', 'ranged-target-prone', 'ranged-full-cover',
        'ranged-large-target', 'ranged-moving-target', 'ranged-moving-vehicle',
        'ranged-elevated-position',
      ] : [
        'close-attacker-prone', 'close-target-prone', 'close-defenseless-target',
      ];
    }
    if (combatEdges.oneHanded?.allowed && this.system.props?.twoHanded) {
      rollConfig.attackData.oneHanded = {
        ...combatEdges.oneHanded,
        beyondShort: combatEdges.oneHandedBeyondShort,
      };
    }
    rollConfig.attackData.confinedSpace = isConfinedSpaceScene();
    rollConfig.attackData.ricochetEligible = rollConfig.attackData.confinedSpace
      && this.type === 'weapon'
      && isRicochetEligibleWeapon(this);
    rollConfig.attackData.airburst = Boolean(this.system.props?.airburst);
    rollConfig.attackData.directional = Boolean(this.system.props?.directional);
    rollConfig.attackData.sourceActorUuid = actor.uuid;
    rollConfig.attackData.sourceItemUuid = this.uuid;
    rollConfig.attackData.targetPoint = targetPoint;
    rollConfig.attackData.targetMode = targetMode;
    rollConfig.attackData.heavyWeaponRules = heavyWeaponRules;
    rollConfig.attackData.artillery = artillery;
    rollConfig.attackData.indirectFireAllowed = Boolean(
      heavyWeaponRules && this.system.props?.indirectFire,
    );
    rollConfig.attackData.indirectFireObserved = Boolean(
      actor.getFlag('fvtt-yze-generic-stepped', 'indirectFireObservation')?.ready,
    );
    if (artillery) {
      const correction = actor.getFlag('fvtt-yze-generic-stepped', 'artilleryCorrection');
      const samePoint = correction?.itemUuid === this.uuid
        && correction?.targetPoint?.sceneId === targetPoint?.sceneId
        && correction?.targetPoint?.i === targetPoint?.i
        && correction?.targetPoint?.j === targetPoint?.j;
      const correctionBonus = samePoint ? Math.min(3, Number(correction.bonus) || 0) : 0;
      if (correctionBonus) {
        rollConfig.modifier += correctionBonus;
        rollConfig.automaticModifiers.push({
          id: 'artillery-correction',
          label: game.i18n.localize('YZEGS.Heavy.Modifiers.Correction'),
          value: correctionBonus,
          displayValue: `+${correctionBonus}`,
        });
        rollConfig.attackData.correctionBonus = correctionBonus;
      }
    }
    rollConfig.attackData.guidance = foundry.utils.deepClone(guidance);
    if (targetActors.length === 1) rollConfig.attackData.primaryTargetUuid = targetActors[0].uuid;
    if (this.type === 'weapon' && targetActors.length === 1 && targetActors[0].type === 'vehicle'
      && targetActors[0].system.domain === 'land') {
      rollConfig.locate = false;
      rollConfig.attackData.vehicleComponentChoices = Object.fromEntries([
        ['none', ''],
        ...CALLED_VEHICLE_COMPONENTS.map(component => [
          component,
          `YZEGS.LandVehicle.Components.${component}`,
        ]),
      ]);
    }
    const friendlyFireTargets = isRangedAttack && targetActors.length === 1 && Boolean(itemData.ammo)
      ? findFriendlyFireTargets(actor, targetActors[0])
      : [];
    if (friendlyFireTargets.length) {
      rollConfig.attackData.friendlyFireTargets = friendlyFireTargets.map(entry => ({
        actorUuid: entry.actorUuid,
        tokenUuid: entry.tokenUuid,
        name: entry.name,
      }));
    }
    // An explosive attack resolves its single suppression trigger with the
    // separate blast rolls, avoiding duplicate CUF checks for a direct target.
    const isSuppressiveFire = this.type === 'weapon'
      && !isBow
      && Boolean(itemData.ammo)
      && !explosiveAttack;
    if (isSuppressiveFire) {
      const seenTargets = new Set();
      const suppressionTargets = targetActors.filter(target => {
        if (
          !target?.uuid
          || !['character', 'npc', 'vehicle'].includes(target.type)
          || seenTargets.has(target.uuid)
        ) return false;
        seenTargets.add(target.uuid);
        return true;
      }).map(target => {
        const token = targetTokens.find(entry => entry.actor?.uuid === target.uuid);
        const enclosing = getEnclosingVehicle(target, game.actors);
        return {
          actorUuid: target.uuid,
          tokenUuid: token?.document?.uuid ?? token?.uuid ?? target.token?.uuid ?? '',
          name: target.name,
          cause: 'fire',
          sourceName: actor.name,
          status: target.type === 'vehicle' || enclosing ? 'immune' : 'pending',
          vehicleName: target.type === 'vehicle' ? target.name : enclosing?.vehicle?.name ?? '',
        };
      });
      for (const friendly of friendlyFireTargets) {
        if (seenTargets.has(friendly.actorUuid)) continue;
        seenTargets.add(friendly.actorUuid);
        const enclosing = getEnclosingVehicle(friendly.actor, game.actors);
        suppressionTargets.push({
          actorUuid: friendly.actorUuid,
          tokenUuid: friendly.tokenUuid,
          name: friendly.name,
          cause: 'friendlyFire',
          sourceName: actor.name,
          force: true,
          status: enclosing ? 'immune' : 'pending',
          vehicleName: enclosing?.vehicle?.name ?? '',
        });
      }
      rollConfig.suppression = {
        complete: suppressionTargets.length > 0
          && suppressionTargets.every(target => target.status !== 'pending'),
        targets: suppressionTargets,
      };
    }

    // Performs the task check.
    const message = await YZEGSRoller.taskCheck(rollConfig);
    if (!message) return;
    if (message instanceof YearZeroRoll) return message;

    if (ambushOpening) await consumeAmbushOpening(actor);

    const roll = message.rolls[0];

    if (roll.options.attackData?.indirectFire) {
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'indirectFireObservation');
    }
    const explosiveHit = Number(roll.baseSuccessQty) > 0
      && !roll.options.attackData?.automaticDeviation;
    if (artillery && explosiveHit) {
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'artilleryDeviation');
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'artilleryCorrection');
    }

    if (defaultActionId === 'meleeAttack' && targetActors.length === 1) {
      await beginCloseQuartersEngagement(actor, targetActors[0]);
    }

    if (breaksAim) {
      await actor.toggleStatusEffect('aiming', { active: false });
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionAim');
    }
    else if (rangedPreparation.aimed && targetUuids.length === 1) {
      const aim = actor.getFlag('fvtt-yze-generic-stepped', 'actionAim') ?? {};
      if (aim.targetUuid === '*') {
        await actor.setFlag('fvtt-yze-generic-stepped', 'actionAim', {
          ...aim,
          targetUuid: targetUuids[0],
        });
      }
    }
    if (actor.statuses?.has?.('overwatch')) {
      await actor.toggleStatusEffect('overwatch', { active: false });
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionOverwatch');
    }

    if (isBow || this.type === 'grenade') {
      await this.unsetFlag('fvtt-yze-generic-stepped', 'prepared');
    }

    const flagData = {};

    // Consumes unit(s).
    if (track && isDisposable && qty > 0) {
      qty--;
      await this.update({ 'system.qty': qty });
    }

    // Consumes ammo.
    if (ammo) {
      const ammoDiff = await this.consumeAmmo(Math.max(1, roll.ammoSpent), ammo); // ? why roll.ammoSpent + 1 here
      flagData.ammoSpent = ammoDiff;
      flagData.ammo = ammo.id;
    }

    // ? There is no jam on unpushed rolls.
    // Decreases reliability.
    // if (this.hasReliability && roll.jamCount) {
    //   const newRel = await this.updateReliability(-roll.jamCount);
    //   if (newRel) flagData.reliability = newRel;
    // }

    // Updates message's flags.
    if (!foundry.utils.isEmpty(flagData)) {
      await message.setFlag('fvtt-yze-generic-stepped', 'data', flagData);
    }

    return message;
  }

  /* ------------------------------------------- */

  /**
   * Updates the reliability value of an item based on its interval [0, max].
   * @param {number}   jam          How much to modify the reliability
   * @param {boolean} [update=true] Whether to update the item
   * @returns {number} The real difference applied
   * @async
   */
  async updateReliability(jam, update = true) {
    if (jam === 0) return 0;
    if (!this.hasReliability) return 0;
    const val = this.system.reliability.value;
    const max = this.system.reliability.max;
    const rel = Math.clamp(val + jam, 0, max);
    if (update && rel !== val) await this.update({ 'system.reliability.value': rel });
    return rel - val;
  }

  /* ------------------------------------------- */

  /**
   * Updates the armor rating of an armor based on its interval [0, max].
   * @param {number}   mod          How much to modify the armor rating
   * @param {boolean} [update=true] Whether to update the item
   * @returns {number} The real difference applied
   * @async
   */
  async updateArmor(mod, update = true) {
    if (mod === 0) return 0;
    if (!this.type === 'armor') return 0;
    const val = this.system.rating.value;
    const max = this.system.rating.max;
    const rel = Math.clamp(val + mod, 0, max);
    if (update && rel !== val) await this.update({ 'system.rating.value': rel });
    return rel - val;
  }

  /* ------------------------------------------- */

  /**
   * Consumes a quantity of ammo from the weapon's magazine,
   * updates the weapon data, and return the quantity of ammo consumed.
   * If the quantity is negative, it will increase the ammo count.
   * @param {number}  qty   Quantity of ammo to consume
   * @param {Item?}  [ammo] The ammo item may be defined if you already have it
   * @returns {number} The real quantity of ammo consumed
   * @async
   */
  async consumeAmmo(qty, ammo) {
    if (!this.hasAmmo) return 0;
    ammo = ammo ?? (weaponUsesInternalMagazine(this) ? this : this.actor.items.get(this.system.mag.target));
    if (!ammo) return 0;
    return ammo.updateAmmo(-qty);
  }

  /** Reload this weapon using the Twilight: 2000 action and skill procedure. */
  async reload() {
    if (this.type !== 'weapon' || !this.hasAmmo || !this.actor || !this.isOwner) return null;
    const { canActorAttemptAction, getActorImpairment } = await import('../system/critical-injuries.js');
    if (!canActorAttemptAction(this.actor, 'reload')) {
      const state = getActorImpairment(this.actor);
      ui.notifications.warn(game.i18n.localize(state.dead
        ? 'YZEGS.Critical.Errors.DeadCannotAct'
        : 'YZEGS.Critical.Errors.IncapacitatedCannotAct'));
      return null;
    }

    const internal = weaponUsesInternalMagazine(this);
    const loaded = internal
      ? Math.max(0, Math.trunc(Number(this.system.mag.value) || 0))
      : Math.max(0, Math.trunc(Number(this.actor.items.get(this.system.mag.target)?.system.ammo?.value) || 0));
    const capacity = internal
      ? Math.max(0, Math.trunc(Number(this.system.mag.max) || 0))
      : Math.max(0, Math.trunc(Number(this.actor.items.get(this.system.mag.target)?.system.ammo?.max
        ?? this.system.mag.max) || 0));
    const currentAmmunition = this.actor.items.get(this.system.mag.target);

    const sources = getReloadSources(this);
    if (!sources.length) {
      const key = internal && capacity > 0 && loaded >= capacity
        ? 'YZEGS.Reload.AlreadyFull'
        : 'YZEGS.Reload.NoCompatibleSource';
      ui.notifications.warn(game.i18n.format(key, { weapon: this.name }));
      return null;
    }

    const weaponSkill = this.actor.getSkill(this.system.skill);
    const heavyWeapon = isHeavyWeapon(this, weaponSkill);
    const reloaders = this._getReloadActors(heavyWeapon);
    if (!reloaders.length) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Reload.NoReloadingCharacter'));
      return null;
    }
    const selectedReloader = reloaders[0];
    const selectedReloaderInCombat = isActorInActiveCombat(selectedReloader, game.combat);
    const sourceOptions = Object.fromEntries(sources.map(ammunition => {
      const count = internal
        ? game.i18n.format('YZEGS.Reload.LooseRoundsAvailable', { count: ammunition.system.qty })
        : `${ammunition.system.ammo.value}/${ammunition.system.ammo.max}`;
      return [ammunition.id, `${ammunition.name} — ${count}`];
    }));
    const reloaderOptions = Object.fromEntries(reloaders.map(actor => {
      const fast = Math.max(0, Number(actor.system.actions?.fast?.value) || 0);
      const slow = Math.max(0, Number(actor.system.actions?.slow?.value) || 0);
      return [actor.id, `${actor.name} — ${game.i18n.format('YZEGS.Reload.ActionCounts', { fast, slow })}`];
    }));
    const options = await YZEGSDialog.chooseReload({
      weaponName: this.name,
      loaded,
      capacity,
      currentLoadName: currentAmmunition?.name ?? game.i18n.localize('YZEGS.Reload.NothingLoaded'),
      sourceOptions,
      selectedSource: sources[0].id,
      reloaderOptions,
      selectedReloader: selectedReloader.id,
      showReloader: reloaders.length > 1 || !['character', 'npc'].includes(this.actor.type),
      heavyWeapon,
      inActiveCombat: selectedReloaderInCombat,
      automaticModifier: getReloadModifier(selectedReloader),
      hasBackpackSource: selectedReloaderInCombat
        && sources.some(ammunition => ammunition.system.backpack),
      actionSummary: game.i18n.format('YZEGS.Reload.ActionCounts', {
        fast: selectedReloader.system.actions?.fast?.value ?? 0,
        slow: selectedReloader.system.actions?.slow?.value ?? 0,
      }),
    });
    if (options.cancelled) return null;

    const source = this.actor.items.get(options.sourceId);
    const reloader = reloaders.find(actor => actor.id === options.reloaderId) ?? selectedReloader;
    if (!source || !getReloadSources(this).some(candidate => candidate.id === source.id)) {
      ui.notifications.warn(game.i18n.format('YZEGS.Reload.SourceUnavailable', { weapon: this.name }));
      return null;
    }

    const inActiveCombat = isActorInActiveCombat(reloader, game.combat);
    if (
      reloader.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG)
      && (heavyWeapon || (source.system.backpack && inActiveCombat))
    ) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Urban.Engagement.RestrictedAction'));
      return null;
    }

    const rangedCombat = inActiveCombat && !heavyWeapon
      ? getReloadSkill(reloader, 'rangedCombat', 'Ranged Combat')
      : null;
    if (inActiveCombat && !heavyWeapon && !rangedCombat) {
      ui.notifications.warn(game.i18n.format('YZEGS.Reload.SkillMissing', { skill: 'Ranged Combat' }));
      return null;
    }

    if (source.system.backpack && inActiveCombat) {
      const retrieved = await this._retrieveReloadSource(source, reloader);
      if (!retrieved) return null;
    }
    else if (source.system.backpack) {
      await source.update({ 'system.backpack': false });
    }

    const fastAvailable = Math.max(0, Number(reloader.system.actions?.fast?.value) || 0);
    const slowAvailable = Math.max(0, Number(reloader.system.actions?.slow?.value) || 0);
    const missingRequiredAction = inActiveCombat && (
      (heavyWeapon && slowAvailable <= 0)
      || (!heavyWeapon && fastAvailable <= 0 && slowAvailable <= 0)
    );
    if (missingRequiredAction) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Reload.NoActionAvailable'));
      const unavailableResult = resolveReloadAction({
        inCombat: true,
        heavyWeapon,
        success: true,
        fast: fastAvailable,
        slow: slowAvailable,
      });
      await this._postReloadResult({
        reloader,
        source,
        actionResult: unavailableResult,
        heavyWeapon,
        loaded: 0,
      });
      return unavailableResult;
    }

    let succeeded = true;
    if (inActiveCombat && !heavyWeapon) {
      const statData = getAttributeAndSkill(rangedCombat, reloader);
      const rollMessage = await YZEGSRoller.taskCheck({
        ...statData,
        title: game.i18n.format('YZEGS.Reload.RollTitle', { weapon: this.name }),
        actor: reloader,
        modifier: getReloadModifier(reloader) + options.modifier,
        maxPush: 0,
        skipDialog: true,
      });
      if (!rollMessage) return null;
      succeeded = rollMessage.rolls[0].baseSuccessQty > 0;
    }

    const actionResult = resolveReloadAction({
      inCombat: inActiveCombat,
      heavyWeapon,
      success: succeeded,
      fast: reloader.system.actions?.fast?.value,
      slow: reloader.system.actions?.slow?.value,
    });
    if (actionResult.spentFrom) await this._spendAction(reloader, actionResult.spentFrom);
    if (!actionResult.complete) {
      const key = actionResult.forfeited ? 'YZEGS.Reload.FastActionForfeited' : 'YZEGS.Reload.NoActionAvailable';
      ui.notifications.warn(game.i18n.localize(key));
      await this._postReloadResult({ reloader, source, actionResult, heavyWeapon, loaded: 0 });
      return actionResult;
    }

    const roundsLoaded = await this._applyReloadSource(source, {
      useGranularRule: inActiveCombat,
    });
    await this._refreshOpenSheets();
    await this._postReloadResult({ reloader, source, actionResult, heavyWeapon, loaded: roundsLoaded });
    return { ...actionResult, roundsLoaded };
  }

  /** Backward-compatible entry point for existing buttons and macros. */
  reloadInternalMagazine() {
    return this.reload();
  }

  /** Attempt to clear this Weapon's persistent jam using its linked combat Skill. */
  async clearJam() {
    if (this.type !== 'weapon' || !this.actor || !this.isOwner) return null;
    const { canActorAttemptAction, getActorImpairment } = await import('../system/critical-injuries.js');
    if (!canActorAttemptAction(this.actor, 'clearJam')) {
      const state = getActorImpairment(this.actor);
      ui.notifications.warn(game.i18n.localize(state.dead
        ? 'YZEGS.Critical.Errors.DeadCannotAct'
        : 'YZEGS.Critical.Errors.IncapacitatedCannotAct'));
      return null;
    }
    if (!this.system.jammed) {
      ui.notifications.info(game.i18n.format('YZEGS.Jam.NotJammed', { weapon: this.name }));
      return null;
    }
    if (this.hasReliability && this.system.reliability.value <= 0) {
      ui.notifications.warn(game.i18n.format('YZEGS.Jam.Broken', { weapon: this.name }));
      return null;
    }
    if (!['character', 'npc'].includes(this.actor.type)) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Jam.NoCharacter'));
      return null;
    }
    if (this.actor.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG)) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Urban.Engagement.RestrictedAction'));
      return null;
    }

    const skillItem = this.actor.getSkill(this.system.skill);
    if (!skillItem) {
      ui.notifications.warn(game.i18n.format('YZEGS.Jam.SkillMissing', {
        skill: this.system.skill || game.i18n.localize('YZEGS.SkillNames.rangedCombat'),
      }));
      return null;
    }

    const inActiveCombat = isActorInActiveCombat(this.actor, game.combat);
    const actionResult = resolveClearJamAction({
      inCombat: inActiveCombat,
      slow: this.actor.system.actions?.slow?.value,
    });
    if (!actionResult.available) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Jam.NoSlowAction'));
      return actionResult;
    }
    if (actionResult.spentFrom) await this._spendAction(this.actor, actionResult.spentFrom);

    const statData = getAttributeAndSkill(skillItem, this.actor);
    const rollMessage = await YZEGSRoller.taskCheck({
      ...statData,
      title: game.i18n.format('YZEGS.Jam.RollTitle', { weapon: this.name }),
      actor: this.actor,
      item: this,
      modifier: getClearJamModifier(this.actor),
      maxPush: 0,
      skipDialog: true,
    });
    if (!rollMessage) return null;

    const success = rollMessage.rolls[0].baseSuccessQty > 0;
    if (success) {
      await this.update({ 'system.jammed': false });
      ui.notifications.info(game.i18n.format('YZEGS.Jam.Cleared', { weapon: this.name }));
    }
    else {
      ui.notifications.warn(game.i18n.format('YZEGS.Jam.ClearFailed', { weapon: this.name }));
    }
    return { ...actionResult, success };
  }

  /** Refresh open Weapon Item windows after a reload changes this Item or a sibling Ammo Item. */
  async _refreshOpenSheets() {
    for (const app of Object.values(this.apps)) {
      if (!app.rendered) continue;
      if (app instanceof foundry.applications.api.ApplicationV2) await app.render({ force: true });
      else app.render(false);
    }
  }

  _getReloadActors(heavyWeapon) {
    const bearer = ['character', 'npc'].includes(this.actor.type) ? this.actor : null;
    if (!heavyWeapon && bearer) return [bearer];
    const candidates = game.actors.contents.filter(actor => (
      ['character', 'npc'].includes(actor.type) && (game.user.isGM || actor.isOwner)
    ));
    if (bearer) {
      const index = candidates.findIndex(actor => actor.id === bearer.id);
      if (index >= 0) candidates.splice(index, 1);
      candidates.unshift(bearer);
    }
    return candidates;
  }

  async _retrieveReloadSource(source, reloader) {
    const slow = Math.max(0, Number(reloader.system.actions?.slow?.value) || 0);
    if (!slow) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Reload.BackpackNeedsSlowAction'));
      return false;
    }
    const mobility = getReloadSkill(reloader, 'mobility', 'Mobility');
    if (!mobility) {
      ui.notifications.warn(game.i18n.format('YZEGS.Reload.SkillMissing', { skill: 'Mobility' }));
      return false;
    }
    const statData = getAttributeAndSkill(mobility, reloader);
    const rollMessage = await YZEGSRoller.taskCheck({
      ...statData,
      title: game.i18n.format('YZEGS.Reload.RetrieveTitle', { ammo: source.name }),
      actor: reloader,
      maxPush: 0,
      skipDialog: true,
    });
    if (!rollMessage) return false;
    await this._spendAction(reloader, 'slow');
    if (rollMessage.rolls[0].baseSuccessQty <= 0) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Reload.RetrieveFailed'));
      await this._postReloadResult({ reloader, source, retrievalFailed: true, loaded: 0 });
      return false;
    }
    await source.update({ 'system.backpack': false });
    ui.notifications.info(game.i18n.format('YZEGS.Reload.Retrieved', { ammo: source.name }));
    return true;
  }

  async _spendAction(actor, action) {
    const current = Math.max(0, Number(actor.system.actions?.[action]?.value) || 0);
    if (!current) return false;
    await actor.update({ [`system.actions.${action}.value`]: current - 1 });
    return true;
  }

  async _applyReloadSource(source, { useGranularRule = true } = {}) {
    if (!weaponUsesInternalMagazine(this)) {
      await this.update({ 'system.mag.target': source.id });
      return Math.max(0, Math.trunc(Number(source.system.ammo.value) || 0));
    }

    const loaded = Math.max(0, Math.trunc(Number(this.system.mag.value) || 0));
    const capacity = Math.max(0, Math.trunc(Number(this.system.mag.max) || 0));
    const available = Math.max(0, Math.trunc(Number(source.system.qty) || 0));
    const previousTarget = this.system.mag.target;
    const previousAmmunition = this.actor.items.get(previousTarget);
    const switchingAmmunition = loaded > 0 && previousTarget && previousTarget !== source.id;
    const retainedRounds = switchingAmmunition ? 0 : loaded;
    const perRound = useGranularRule && game.settings.get(
      'fvtt-yze-generic-stepped',
      INTERNAL_RELOAD_MODE_SETTING,
    ) === INTERNAL_RELOAD_MODES.PER_ROUND;
    const amount = getInternalReloadAmount({
      loaded: retainedRounds,
      capacity,
      available,
      perRound,
    });
    if (!amount) return 0;
    const updates = [
      {
        _id: this.id,
        'system.mag.value': retainedRounds + amount,
        'system.mag.target': source.id,
      },
      { _id: source.id, 'system.qty': available - amount },
    ];
    if (switchingAmmunition && previousAmmunition) {
      const previousQuantity = Math.max(0, Math.trunc(Number(previousAmmunition.system.qty) || 0));
      updates.push({
        _id: previousAmmunition.id,
        'system.qty': previousQuantity + loaded,
      });
    }
    await this.actor.updateEmbeddedDocuments('Item', updates);
    return amount;
  }

  async _postReloadResult({
    reloader,
    source,
    actionResult = {},
    heavyWeapon = false,
    retrievalFailed = false,
    loaded = 0,
  }) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/chat/reload-chat.hbs',
      {
        weapon: this.name,
        ammunition: source.name,
        reloader: reloader.name,
        action: actionResult.action,
        complete: actionResult.complete ?? false,
        forfeited: actionResult.forfeited ?? false,
        heavyWeapon,
        retrievalFailed,
        loaded,
      },
    );
    return ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: reloader, token: reloader.token }),
      content,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  /* ------------------------------------------- */

  /**
   * Updates the ammo value of a magazine based on its interval [0, max].
   * @param {number}   modifier     How much to modify the magazine
   * @param {boolean} [update=true] Whether to update the ammo item
   * @returns {number} The real difference applied
   * @async
   */
  async updateAmmo(modifier, update = true) {
    if (modifier === 0) return 0;

    let ammoData = {};
    if (this.type === 'ammunition') {
      ammoData = this.system.ammo;
    }
    else if (this.type === 'weapon') {
      ammoData = weaponUsesInternalMagazine(this)
        ? this.system.mag
        : { value: this.system.qty, max: 100000 };
    }
    else {
      throw new Error('yzegs | ItemYZEGS#updateAmmo() | This is not an ammunition!');
    }
    const ammoValue = ammoData.value || 0;
    const ammoMax = ammoData.max;
    const newAmmoValue = Math.clamp(ammoValue + modifier, 0, ammoMax);

    if (update) {
      switch (this.type) {
        case 'ammunition':
          await this.update({ 'system.ammo.value': newAmmoValue });
          break;
        case 'weapon':
          if (weaponUsesInternalMagazine(this)) await this.update({ 'system.mag.value': newAmmoValue });
          else await this.update({ 'system.qty': newAmmoValue });
          break;
      }
    }
    return newAmmoValue - ammoValue;
  }

  /* ------------------------------------------- */
  /*  Chat Card                                  */
  /* ------------------------------------------- */

  /**
   * Display the chat card for an Item as a Chat Message.
   * @param {string?}  messageMode       The message visibility mode to apply to the created card
   * @param {boolean} [sendMessage=true] Whether to send the message or return its data
   * @returns {Promise<ChatMessage|object>}
   * @async
   */
  async displayCard({ messageMode, sendMessage = true } = {}) {
    // Renders the chat card template.
    const actor = this.actor;
    const token = actor?.token;
    const cardData = {
      id: this.id,
      name: this.name,
      img: this.img,
      system: this.system,
      actorId: actor?.id ?? null,
      tokenId: token ? `${token.parent.id}.${token.id}` : null,
      owner: game.user.id,
      config: YZEGS,
      canReload: this.type === 'weapon' && this.hasAmmo,
      canClearJam: this.type === 'weapon'
        && this.system.jammed
        && ['character', 'npc'].includes(actor?.type),
    };

    // Creates the ChatMessage data object.
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor, token }),
      content: await foundry.applications.handlebars.renderTemplate(ItemYZEGS.CHAT_TEMPLATE[this.type], cardData),
      // flavor: this.name,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    };

    // Apply the message mode to adjust message visibility.
    ChatMessage.applyMode(chatData, messageMode ?? game.settings.get('core', 'messageMode'));

    // Creates the chat message or return its data.
    return sendMessage ? ChatMessage.create(chatData) : chatData;
  }

  /* ------------------------------------------- */
  /*  Chat Card Actions                          */
  /* ------------------------------------------- */

  static chatListeners(html) {
    const button = html.querySelectorAll('.card-buttons button');
    for (let i = 0; i < button.length; i++) {
      button[i].addEventListener('click', this._onChatCardAction.bind(this));
    }


    // html.on('click', '.card-buttons button', this._onChatCardAction.bind(this));
  }

  /* ------------------------------------------- */

  /**
   * Handles execution of a chat card action via a click event on one of the card buttons.
   * @param {Event} event The originating click event
   * @returns {Promise} A promise which resolves once the handler workflow is complete
   * @private
   * @static
   * @async
   */
  static async _onChatCardAction(event) {
    event.preventDefault();

    // Extracts the card's data.
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest('.chat-card');
    const messageId = card.closest('.message').dataset.messageId;
    const message = game.messages.get(messageId);
    const action = button.dataset.action;
    const itemId = card.dataset.itemId;

    // Validates permission to proceed with the roll.
    if (!(game.user.isGM || message.isAuthor)) {
      button.style.display = 'none';
      return;
    }

    // Recovers the actor for the chat card.
    const actor = getChatCardActor(card);
    if (!actor) {
      button.style.display = 'none';
      return;
    }

    // Gets the item.
    const item = actor.items.get(itemId);
    if (!item) {
      return ui.notifications.error(game.i18n.localize('YZEGS.Chat.Roll.NoItemNotif'));
    }

    // Handles different actions.
    const askForOptions = event.shiftKey;
    switch (action) {
      case 'attack':
        await item.rollAttack({ askForOptions });
        break;
      case 'reload':
        await item.reload();
        break;
      case 'clearJam':
        await item.clearJam();
        break;
    }

    // Re-enables the button.
    button.disabled = false;
  }
}

/* ------------------------------------------- */

/**
 * Default templates for the items in the chat.
 * @constant
 */
ItemYZEGS.CHAT_TEMPLATE = ITEM_CHAT_TEMPLATES;

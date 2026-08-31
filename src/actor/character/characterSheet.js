import ActorSheetYZEGS from '../actorSheet.js';
import { YZEGSRoller, getAttributeAndSkill } from '../../components/roll/dice.js';
import { enrichTextFields } from '../../utils/utils.js';
import { getCharacterFieldLabels } from '../../system/character-field-labels.js';
import { getExperienceConfig } from '../../system/experience-config.js';
import {
  advanceSkill,
  awardExperience,
  canManageExperience,
  getAvailableSpecialtyOptions,
  getExperienceQuestions,
  getSkillAdvancement,
  learnSpecialty,
  setSkillExperienceEligibility,
} from '../../system/experience.js';
import YZEGSDialog from '../../components/dialog/dialog.js';
import { chooseArchetype } from '../../system/archetypes.js';
import {
  beginStabilization,
  getActorImpairment,
  rollDeathSave,
  rollStabilization,
} from '../../system/critical-injuries.js';
import {
  drawActorInitiative,
  exchangeActorInitiative,
} from '../../system/initiative-workflows.js';
import {
  chooseDiseaseCaregiver,
  resolveDiseaseCheck,
} from '../../system/disease-workflows.js';
import { resolveHypothermiaCheck } from '../../system/environmental-hazards.js';

/**
 * Year Zero Engine - Generic Stepped Dice Actor Sheet for Character.
 * @extends {ActorSheetYZEGS} Extends the YZEGS ActorSheet
 */
export default class ActorSheetYZEGSCharacter extends ActorSheetYZEGS {
  /* ------------------------------------------- */
  /*  Sheet Properties                           */
  /* ------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      chooseArchetype: this.#onChooseArchetype,
      drawInitiative: this.#onDrawInitiative,
      exchangeInitiative: this.#onExchangeInitiative,
    },
    classes: ['character'],
    position: { width: 1040, height: 715 },
  };

  /**
   * Open the Archetype-driven character builder.
   * @this {ActorSheetYZEGSCharacter}
   * @returns {Promise<*>}
   */
  static #onChooseArchetype() {
    return chooseArchetype(this.actor);
  }

  static #onDrawInitiative() {
    return drawActorInitiative(this.actor);
  }

  static #onExchangeInitiative() {
    return exchangeActorInitiative(this.actor);
  }

  static TABS = {
    ...ActorSheetYZEGS.TABS,
    experience: {
      tabs: [{ id: 'skills' }, { id: 'specialties' }, { id: 'history' }],
      initial: 'skills',
    },
  };

  /** @override */
  _getFrameButtons(options) {
    const buttons = super._getFrameButtons(options);
    if (!this.isEditable) return buttons;
    buttons.unshift(
      {
        action: 'exchangeInitiative',
        icon: 'fa-solid fa-right-left',
        label: 'YZEGS.Initiative.Exchange',
      },
      {
        action: 'drawInitiative',
        icon: 'fa-solid fa-list-ol',
        label: 'YZEGS.Initiative.Draw',
      },
    );
    if (this.actor.type === 'character') {
      buttons.unshift({
        action: 'chooseArchetype',
        icon: 'fa-solid fa-person-circle-plus',
        label: 'YZEGS.Archetype.Choose',
      });
    }
    return buttons;
  }

  /* ------------------------------------------- */
  /*  Sheet Data Preparation                     */
  /* ------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const sheetData = await super._prepareContext(options);
    sheetData.appearanceValue = this.actor.system.bio?.appearance ?? '';
    sheetData.characterFieldLabels = getCharacterFieldLabels();
    sheetData.archetype = {
      uuid: this.actor.system.creation?.archetypeUuid ?? '',
      name: this.actor.system.creation?.archetypeName ?? '',
    };
    sheetData.skillsByAttribute = Object.fromEntries(Object.keys(CONFIG.YZEGS.attributes).map(attribute => [
      attribute,
      [],
    ]));

    for (const skill of this.actor.itemTypes.skill) {
      const attribute = skill.system.attribute;
      if (!(attribute in sheetData.skillsByAttribute)) continue;
      sheetData.skillsByAttribute[attribute].push({
        id: skill.id,
        name: skill.name,
        score: skill.system.score,
        value: skill.system.value,
      });
    }
    for (const skills of Object.values(sheetData.skillsByAttribute)) {
      skills.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: 'base' }));
    }

    if (this.actor.type === 'character') {
      await enrichTextFields(sheetData, ['system.bio.appearance']);
      this._prepareExperience(sheetData);
    }
    const impairment = getActorImpairment(this.actor);
    let impairmentLabel = '';
    if (impairment.dead) impairmentLabel = game.i18n.localize('YZEGS.Critical.Dead');
    else if (impairment.damage) impairmentLabel = game.i18n.localize('YZEGS.Critical.IncapacitatedDamage');
    else if (impairment.stress) impairmentLabel = game.i18n.localize('YZEGS.Critical.IncapacitatedStress');
    sheetData.impairment = {
      ...impairment,
      label: impairmentLabel,
    };
    sheetData.criticalInjuries = (this.actor.itemTypes.injury ?? []).map(injury => {
      const state = injury.system.state ?? {};
      const treatment = state.treatment ?? {};
      const stage = state.stage || '';
      let deadline = '';
      if (state.due) deadline = game.i18n.localize('YZEGS.Critical.DeathSaveDue');
      else if (stage && stage !== 'stabilized') {
        deadline = game.i18n.localize(`YZEGS.Critical.Stage.${stage}`);
      }
      return {
        id: injury.id,
        name: injury.name,
        lethal: injury.system.lethal,
        instantDeath: injury.system.instantDeath || state.instantDeath,
        stage,
        stabilized: state.stabilized || stage === 'stabilized',
        due: state.due,
        deadline,
        healingDays: state.healingDays,
        stabilizationLocked: state.stabilizationLocked,
        treatmentActive: Boolean(treatment.healerUuid),
        treatmentReady: Boolean(treatment.ready),
        canResolveTreatment: Boolean(treatment.healerUuid) && (Boolean(treatment.ready) || game.user.isGM),
        treatmentHealer: treatment.healerName ?? '',
      };
    });
    sheetData.diseaseItems = (this.actor.itemTypes.disease ?? []).map(disease => ({
      id: disease.id,
      name: disease.name,
      phase: disease.system.state?.phase || 'incubating',
      phaseLabel: game.i18n.localize(`YZEGS.Disease.Phases.${disease.system.state?.phase || 'incubating'}`),
      due: Boolean(disease.system.state?.due),
      antibioticsUsed: Boolean(disease.system.state?.antibioticsUsed),
      caregiverName: disease.system.state?.caregiverName ?? '',
      recovered: disease.system.state?.phase === 'recovered',
    }));
    return sheetData;
  }

  _prepareExperience(sheetData) {
    const config = getExperienceConfig();
    const canManage = this.isEditable && canManageExperience(this.actor, config);
    const skills = this.actor.itemTypes.skill
      .map(skill => {
        const advancement = getSkillAdvancement(skill, this.actor, config);
        return {
          id: skill.id,
          name: skill.name,
          ...advancement,
          canPurchase: canManage && !advancement.maximum && advancement.affordable,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: 'base' }));
    const historyEntries = [...(this.actor.system.xp.history ?? [])].reverse().map(entry => {
      let description;
      if (entry.type === 'skill') {
        const historyKey = entry.from === '–'
          ? 'YZEGS.Experience.HistorySkillLearned'
          : 'YZEGS.Experience.HistorySkill';
        description = game.i18n.format(historyKey, {
          name: entry.subjectName,
          from: entry.from,
          to: entry.to,
        });
      }
      else if (entry.type === 'specialty') {
        description = game.i18n.format('YZEGS.Experience.HistorySpecialty', { name: entry.subjectName });
      }
      else {
        description = entry.note
          || entry.questions?.join('; ')
          || game.i18n.localize('YZEGS.Experience.HistoryAward');
      }
      return {
        ...entry,
        description,
        date: new Date(entry.timestamp).toLocaleString(game.i18n.lang),
        amount: entry.amount > 0 ? `+${entry.amount}` : String(entry.amount),
        earned: entry.amount > 0,
      };
    });
    const skillColumnLength = Math.ceil(skills.length / 2);
    const skillColumns = skills.length
      ? [skills.slice(0, skillColumnLength), skills.slice(skillColumnLength)].filter(column => column.length)
      : [];

    sheetData.experience = {
      current: Math.max(0, Number(this.actor.system.xp.value) || 0),
      total: Math.max(0, Number(this.actor.system.xp.total) || 0),
      canAward: game.user.isGM && this.isEditable,
      canManage,
      canMarkEligibility: this.isEditable && this.actor.isOwner,
      skills,
      skillColumns,
      specialties: [...this.actor.itemTypes.specialty]
        .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: 'base' })),
      specialtyCost: config.specialtyCost,
      canAffordSpecialty: Number(this.actor.system.xp.value) >= config.specialtyCost,
      history: historyEntries,
    };
  }

  /* ------------------------------------------- */
  /*  Sheet Listeners                            */
  /* ------------------------------------------- */

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this._createContextMenu(this._getSkillContextOptions, '.stat-skill[data-item-id]', {
      hookName: 'getSkillContextOptions',
      parentClassHooks: false,
      fixed: true,
    });
  }

  /**
   * Context-menu actions for embedded Skill Items.
   * @returns {foundry.applications.ux.ContextMenuEntry[]}
   * @protected
   */
  _getSkillContextOptions() {
    const getSkill = target => this.actor.items.get(target.dataset.itemId);
    return [
      {
        label: 'YZEGS.ActorSheet.Edit',
        icon: 'fa-solid fa-pen-to-square',
        visible: this.isEditable,
        onClick: (_event, target) => getSkill(target)?.sheet.render({ force: true }),
      },
      {
        label: 'YZEGS.ActorSheet.Delete',
        icon: 'fa-solid fa-trash',
        visible: this.isEditable,
        onClick: (_event, target) => {
          const skill = getSkill(target);
          if (skill?.type === 'skill') return this.actor.deleteEmbeddedDocuments('Item', [skill.id]);
          return null;
        },
      },
    ];
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    const activeExperienceTab = this.element.querySelector(
      `.tabs [data-group="experience"][data-tab="${this.tabGroups.experience}"]`,
    );
    if (activeExperienceTab) {
      this.changeTab(this.tabGroups.experience, 'experience', { force: true, updatePosition: false });
    }

    // Everything below here is only needed if the sheet is editable.
    if (!this.isEditable) return;

    html.find('.skill-score-selector').change(this._onSkillScoreChange.bind(this));
    html.find('.boxes-radiation').on('click contextmenu', super._onValueChange.bind(this));
    html.find('.boxes-capacity').on('click contextmenu', this._onCapacityChange.bind(this));
    html.find('.capacity-increase').click(this._onCapacityIncrease.bind(this));
    html.find('.capacity-decrease').click(this._onCapacityDecrease.bind(this));
    html.find('.experience-skill-eligibility').on('change', this._onExperienceEligibility.bind(this));
    html.find('.experience-advance-skill').click(this._onAdvanceSkill.bind(this));
    html.find('.experience-learn-specialty').click(this._onLearnSpecialty.bind(this));
    html.find('.critical-death-save').click(this._onCriticalDeathSave.bind(this));
    html.find('.critical-stabilize').click(this._onCriticalStabilize.bind(this));
    html.find('.critical-resolve-treatment').click(this._onCriticalResolveTreatment.bind(this));
    html.find('.disease-check').click(this._onDiseaseCheck.bind(this));
    html.find('.disease-treat').click(this._onDiseaseTreat.bind(this));
    html.find('.hypothermia-check').click(this._onHypothermiaCheck.bind(this));

    if (game.user.isGM) html.find('.experience-award').click(this._onAwardExperience.bind(this));

    // Owner-only listeners.
    if (this.actor.isOwner) {
      html.find('.attribute-roll').click(this._onAttributeRoll.bind(this));
      html.find('.skill-roll').click(this._onSkillRoll.bind(this));
      html.find('.cuf-roll').click(this._onCoolnessRoll.bind(this));
      html.find('.unit-morale-roll').click(this._onUnitMoraleRoll.bind(this));
      html.find('.radiation-roll').click(this._onRadiationRoll.bind(this));
    }
  }

  _criticalInjuryFromEvent(event) {
    const id = event.currentTarget.closest('.item')?.dataset.itemId;
    return this.actor.items.get(id);
  }

  _onCriticalDeathSave(event) {
    event.preventDefault();
    return rollDeathSave(this.actor, this._criticalInjuryFromEvent(event));
  }

  _onCriticalStabilize(event) {
    event.preventDefault();
    return beginStabilization(this.actor, this._criticalInjuryFromEvent(event));
  }

  _onCriticalResolveTreatment(event) {
    event.preventDefault();
    return rollStabilization(this.actor, this._criticalInjuryFromEvent(event));
  }

  _diseaseFromEvent(event) {
    const id = event.currentTarget.closest('.item')?.dataset.itemId;
    return this.actor.items.get(id);
  }

  _onDiseaseCheck(event) {
    event.preventDefault();
    return resolveDiseaseCheck(this.actor, this._diseaseFromEvent(event));
  }

  _onDiseaseTreat(event) {
    event.preventDefault();
    return chooseDiseaseCaregiver(this.actor, this._diseaseFromEvent(event));
  }

  _onHypothermiaCheck(event) {
    event.preventDefault();
    return resolveHypothermiaCheck(this.actor);
  }

  async _onExperienceEligibility(event) {
    event.preventDefault();
    const skillId = event.currentTarget.closest('.experience-skill-row')?.dataset.itemId;
    try {
      await setSkillExperienceEligibility(this.actor, skillId, event.currentTarget.checked);
    }
    catch (error) {
      ui.notifications.error(error.message);
    }
  }

  async _onAwardExperience(event) {
    event.preventDefault();
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await YZEGSDialog.awardExperience({
        actorName: this.actor.name,
        questions: getExperienceQuestions(),
      });
      if (result.cancelled) return;
      await awardExperience(this.actor, result);
      ui.notifications.info(game.i18n.format('YZEGS.Experience.AwardedNotification', {
        amount: result.amount,
        name: this.actor.name,
      }));
    }
    catch (error) {
      ui.notifications.error(error.message);
    }
    finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  async _onAdvanceSkill(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const skillId = button.closest('.experience-skill-row')?.dataset.itemId;
    const skill = this.actor.items.get(skillId);
    if (!skill) return;
    button.disabled = true;
    try {
      const config = getExperienceConfig();
      const advancement = getSkillAdvancement(skill, this.actor, config);
      const result = await YZEGSDialog.advanceSkill({
        skillName: skill.name,
        currentXp: this.actor.system.xp.value,
        ...advancement,
        prerequisitesOff: config.prerequisiteMode === 'off',
        prerequisiteWarning: config.prerequisiteMode === 'warn' && !advancement.eligible,
      });
      if (result.cancelled) return;
      await advanceSkill(this.actor, skill.id, result);
      if (advancement.learning) {
        ui.notifications.info(game.i18n.localize('YZEGS.Experience.SkillLearnedNotification'));
      }
      else {
        ui.notifications.info(game.i18n.format('YZEGS.Experience.AdvancedNotification', {
          name: skill.name,
          rating: advancement.target,
        }));
      }
    }
    catch (error) {
      ui.notifications.error(error.message);
    }
    finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  async _onLearnSpecialty(event) {
    event.preventDefault();
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const specialties = await getAvailableSpecialtyOptions(this.actor);
      if (!Object.keys(specialties).length) {
        ui.notifications.warn(game.i18n.localize('YZEGS.Experience.Errors.NoAvailableSpecialties'));
        return;
      }
      const config = getExperienceConfig();
      const result = await YZEGSDialog.learnSpecialty({
        specialties,
        cost: config.specialtyCost,
        currentXp: this.actor.system.xp.value,
      });
      if (result.cancelled) return;
      if (!result.sourceUuid) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.ChooseSpecialty'));
      await learnSpecialty(this.actor, result.sourceUuid, result);
      ui.notifications.info(game.i18n.localize('YZEGS.Experience.SpecialtyLearnedNotification'));
    }
    catch (error) {
      ui.notifications.error(error.message);
    }
    finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  /* ------------------------------------------- */

  _onAttributeRoll(event) {
    event.preventDefault();
    const attributeName = event.currentTarget.dataset.attribute;
    const attribute = this.actor.system.attributes[attributeName].value;
    const title = game.i18n.localize(CONFIG.YZEGS.attributes[attributeName]);
    return YZEGSRoller.taskCheck({
      title,
      attributeName,
      actor: this.actor,
      attribute,
      skill: 0,
      askForOptions: event.shiftKey,
    });
  }

  /* ------------------------------------------- */

  _onSkillRoll(event) {
    event.preventDefault();
    const skill = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!skill || skill.type !== 'skill') return null;
    const statData = getAttributeAndSkill(skill, this.actor);
    return YZEGSRoller.taskCheck({
      ...statData,
      actor: this.actor,
      askForOptions: event.shiftKey,
    });
  }

  _onSkillScoreChange(event) {
    event.preventDefault();
    const skill = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!skill || skill.type !== 'skill') return null;
    return skill.update({ 'system.score': event.currentTarget.value });
  }

  /* ------------------------------------------- */

  _onCoolnessRoll(event) {
    event.preventDefault();
    const stat = event.currentTarget.closest('.stat');
    const type = stat.dataset.type;
    return this._onMoraleRoll(type);
  }

  _onUnitMoraleRoll(event) {
    event.preventDefault();
    const stat = event.currentTarget.closest('.stat');
    const type = stat.dataset.type;
    return this._onMoraleRoll(type);
  }

  _onMoraleRoll(type) {
    return YZEGSRoller.cufCheck({
      actor: this.actor,
      unitMorale: type === 'cuf' ? false : true,
    });
  }

  /* ------------------------------------------- */

  _onRadiationRoll(event) {
    event.preventDefault();
    return this.actor.rollRadiationAttack({ askForOptions: event.shiftKey });
  }

  /* ------------------------------------------- */

  /** Left-clic: -1, Right-clic: +1 */
  _onCapacityChange(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const min = +elem.dataset.min || 0;
    const max = +elem.dataset.max || 10;
    const field = elem.dataset.field;
    const currentCount = foundry.utils.getProperty(this.actor, `system.${field}.value`) || 0;
    let newCount = currentCount;

    if (event.type === 'click') newCount--;
    else newCount++; // contextmenu
    newCount = Math.clamp(newCount, min, max);

    return this.actor.update({ [`system.${field}.value`]: newCount });
  }

  _onCapacityIncrease(event) {
    this._changeCapacityModifier(event, 1);
  }

  _onCapacityDecrease(event) {
    this._changeCapacityModifier(event, -1);
  }

  _changeCapacityModifier(event, mod) {
    event.preventDefault();
    const elem = event.currentTarget;
    const field = elem.dataset.field;

    const maxi = foundry.utils.getProperty(this.actor, `system.${field}.max`);
    if (mod < 0 && maxi < 2) return;
    if (mod > 0 && maxi > 11) return;

    const min = -12;
    const max = 12;
    const currentMod = foundry.utils.getProperty(this.actor, `system.${field}.modifier`) || 0;
    const newMod = Math.clamp(currentMod + mod, min, max);

    return this.actor.update({ [`system.${field}.modifier`]: newMod });
  }
}

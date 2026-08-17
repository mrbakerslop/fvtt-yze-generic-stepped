import { activateCheckboxControls } from '../checkbox-control.js';
import { activateRatingMenus } from '../rating-menu.js';

function getSelectedMenuOption(input) {
  const menu = input?.closest('.rating-menu');
  return [...(menu?.querySelectorAll('.rating-menu-option') ?? [])]
    .find(option => option.dataset.value === input.value) ?? null;
}

function setMenuValue(menu, value) {
  const input = menu?.querySelector('.rating-menu-input');
  const options = [...(menu?.querySelectorAll('.rating-menu-option') ?? [])];
  const selected = options.find(option => option.dataset.value === value && !option.hidden && !option.disabled)
    ?? options.find(option => option.dataset.value === '');
  if (!input || !selected) return;
  input.value = selected.dataset.value ?? '';
  for (const option of options) {
    const isSelected = option === selected;
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-selected', String(isSelected));
  }
  const trigger = menu.querySelector('.rating-menu-trigger');
  if (trigger) {
    trigger.textContent = selected.textContent.trim();
    trigger.title = selected.textContent.trim();
  }
}

/**
 * V2 dialog helpers used by the system's rolls and item actions.
 */
export default class YZEGSDialog {
  static get Dialog() {
    return foundry.applications.api.DialogV2;
  }

  static _activateListeners(dialog) {
    const html = $(dialog.element);

    activateRatingMenus(dialog.element);
    activateCheckboxControls(dialog.element, (path, value) => {
      const hiddenInput = [...dialog.element.querySelectorAll('input[type="hidden"]')]
        .find(input => input.name === path);
      if (hiddenInput) hiddenInput.value = String(value);
    });

    html.find('input').focus(event => event.currentTarget.select());

    html.find('input[type=range]').change(event => {
      event.preventDefault();
      const elem = event.currentTarget;
      const span = elem.nextElementSibling;
      span.innerHTML = ['attribute', 'skill'].includes(elem.name) && elem.value < 6 ? 0 : elem.value;
    });

    html.find('.modifier-change').click(event => {
      event.preventDefault();
      const elem = event.currentTarget;
      const target = html.find(`input[name="${elem.dataset.target}"]`)[0];
      let value = parseInt(target.value) || 0;
      if (elem.dataset.change === 'plus') value++;
      else if (elem.dataset.change === 'minus') value--;
      target.value = value >= 0 ? `+${value}` : value;
    });

    html.find('input[name=combatAction]').on('change', function () {
      const modifierInput = html.find('input[name=modifier]')[0];
      const previousValue = Number(this.dataset.currentValue) || 0;
      const selectedValue = Number(getSelectedMenuOption(this)?.dataset.valueModifier) || 0;
      const value = (Number(modifierInput.value) || 0) - previousValue + selectedValue;
      modifierInput.value = value >= 0 ? `+${value}` : value;
      this.dataset.currentValue = String(selectedValue);
    });

    html.find('.checkbox-control-toggle.item-modifier').on('change', function () {
      const modifierInput = html.find('input[name=modifier]')[0];
      let value = Number(modifierInput.value) || 0;
      const modifierValue = Number(this.dataset.value) || 0;
      value += this.checked ? modifierValue : -modifierValue;
      modifierInput.value = value >= 0 ? `+${value}` : value;
    });

    const calledLocation = dialog.element.querySelector('input[name="calledLocation"]');
    if (calledLocation) {
      calledLocation.addEventListener('change', function () {
        const modifierInput = dialog.element.querySelector('input[name="modifier"]');
        const previous = Number(this.dataset.currentModifier) || 0;
        const current = this.value ? -2 : 0;
        const value = (Number(modifierInput?.value) || 0) - previous + current;
        if (modifierInput) modifierInput.value = value >= 0 ? `+${value}` : value;
        this.dataset.currentModifier = String(current);
      });
    }

    html.find('.checkbox-control-toggle.one-handed-toggle').on('change', function () {
      const modifierInput = dialog.element.querySelector('input[name="modifier"]');
      const penalty = Number(this.dataset.value) || 0;
      const value = (Number(modifierInput?.value) || 0) + (this.checked ? penalty : -penalty);
      if (modifierInput) modifierInput.value = value >= 0 ? `+${value}` : value;
    });

    html.find('.checkbox-control-toggle.situational-modifier').on('change', function () {
      const exclusiveGroup = this.dataset.exclusiveGroup;
      if (!this.checked || !exclusiveGroup) return;
      const modifierInput = html.find('input[name=modifier]')[0];
      let value = Number(modifierInput.value) || 0;
      const controls = dialog.element.querySelectorAll(
        `.situational-modifier[data-exclusive-group="${exclusiveGroup}"]`,
      );
      for (const control of controls) {
        if (control === this || !control.checked) continue;
        control.checked = false;
        control.classList.remove('is-checked');
        control.setAttribute('aria-checked', 'false');
        value -= Number(control.dataset.value) || 0;
      }
      modifierInput.value = value >= 0 ? `+${value}` : value;
    });

    html.find('.checkbox-control-toggle.social-factor-toggle').on('change', function () {
      const exclusiveGroup = this.dataset.exclusiveGroup;
      if (!this.checked || !exclusiveGroup) return;
      for (const control of dialog.element.querySelectorAll(
        `.social-factor-toggle[data-exclusive-group="${exclusiveGroup}"]`,
      )) {
        if (control === this || !control.checked) continue;
        control.checked = false;
        control.classList.remove('is-checked');
        control.setAttribute('aria-checked', 'false');
        const hidden = [...dialog.element.querySelectorAll('input[type="hidden"]')]
          .find(input => input.name === control.closest('.checkbox-control')?.dataset.path);
        if (hidden) hidden.value = 'false';
      }
    });

    const updateExperienceAwardTotal = () => {
      const output = dialog.element.querySelector('.experience-award-total');
      if (!output) return;
      const questionTotal = [...dialog.element.querySelectorAll('.experience-award-question')]
        .filter(question => question.querySelector('.checkbox-control-toggle')?.checked)
        .reduce((total, question) => total + Number(question.dataset.amount ?? 0), 0);
      const adjustment = Number(dialog.element.querySelector('[name="adjustment"]')?.value ?? 0);
      output.textContent = String(Math.max(0, questionTotal + adjustment));
    };
    html.find('.experience-award-question .checkbox-control-toggle').on('change', updateExperienceAwardTotal);
    html.find('[name="adjustment"]').on('input', updateExperienceAwardTotal);
    updateExperienceAwardTotal();

    const actionInput = dialog.element.querySelector(
      'input[name="actionId"], input[name="combatAction"]',
    );
    if (actionInput) {
      const updateActionFields = () => {
        const option = getSelectedMenuOption(actionInput);
        const actionId = actionInput.value;
        const targetMode = option?.dataset.targetMode || 'none';
        const itemMode = option?.dataset.itemMode || 'none';
        const targetGroup = dialog.element.querySelector('.action-dialog-target');
        const itemGroup = dialog.element.querySelector('.action-dialog-item');
        const targetMenu = targetGroup?.querySelector('.rating-menu');
        const itemMenu = itemGroup?.querySelector('.rating-menu');
        const targetInput = targetMenu?.querySelector('.rating-menu-input');
        const itemInput = itemMenu?.querySelector('.rating-menu-input');
        const modifierInput = dialog.element.querySelector('input[name="modifier"]');
        for (const modifierLabel of dialog.element.querySelectorAll('.contextual-action-modifier')) {
          const control = modifierLabel.querySelector('.contextual-action-modifier-toggle');
          const applies = String(modifierLabel.dataset.actionIds ?? '').split(' ').includes(actionId);
          const shouldCheck = applies && modifierLabel.dataset.defaultActive === 'true';
          if (control?.checked !== shouldCheck) {
            const modifierValue = Number(control?.dataset.value) || 0;
            const value = (Number(modifierInput?.value) || 0) + (shouldCheck ? modifierValue : -modifierValue);
            if (modifierInput) modifierInput.value = value >= 0 ? `+${value}` : value;
            control.checked = shouldCheck;
            control.classList.toggle('is-checked', shouldCheck);
            control.setAttribute('aria-checked', String(shouldCheck));
          }
          modifierLabel.hidden = !applies;
        }
        if (targetGroup) targetGroup.hidden = targetMode === 'none';
        if (itemGroup) itemGroup.hidden = itemMode === 'none';
        if (targetInput) {
          const targetOptions = [...targetMenu.querySelectorAll('.rating-menu-option')];
          for (const targetOption of targetOptions) {
            if (!targetOption.dataset.value) continue;
            targetOption.hidden = targetMode === 'vehicle' && targetOption.dataset.type !== 'vehicle';
          }
          const selectedTarget = getSelectedMenuOption(targetInput);
          if (selectedTarget?.hidden || selectedTarget?.disabled) setMenuValue(targetMenu, '');
          const eligibleTargets = targetOptions.filter(targetOption => (
            targetOption.dataset.value && !targetOption.hidden && !targetOption.disabled
            && targetOption.dataset.self !== 'true'
          ));
          if (!targetInput.value && (
            ['other', 'vehicle'].includes(targetMode)
            || (targetMode === 'optional' && eligibleTargets.length === 1)
          )) setMenuValue(targetMenu, eligibleTargets[0]?.dataset.value ?? '');
        }
        if (itemInput) {
          const itemOptions = [...itemMenu.querySelectorAll('.rating-menu-option')];
          for (const itemOption of itemOptions) {
            if (!itemOption.dataset.value) continue;
            itemOption.hidden = !String(itemOption.dataset.actions ?? '').split(' ').includes(actionId);
          }
          const selectedItem = getSelectedMenuOption(itemInput);
          if (selectedItem?.hidden || selectedItem?.disabled) setMenuValue(itemMenu, '');
          if (!itemInput.value && itemMode !== 'none' && !itemMode.endsWith('Optional')) {
            const firstItem = itemOptions.find(itemOption => (
              itemOption.dataset.value && !itemOption.hidden && !itemOption.disabled
            ));
            setMenuValue(itemMenu, firstItem?.dataset.value ?? '');
          }
        }
        const hint = dialog.element.querySelector('.action-dialog-hint');
        if (hint) {
          hint.textContent = option?.dataset.hint ?? '';
          hint.hidden = !hint.textContent;
        }
        const formula = dialog.element.querySelector('input[name="formula"]');
        if (formula) {
          formula.dataset.standardFormula ??= formula.value;
          formula.value = option?.dataset.rollMode === 'blindFire'
            ? game.i18n.localize('YZEGS.Urban.BlindFire.Formula')
            : formula.dataset.standardFormula;
        }
      };
      actionInput.addEventListener('change', updateActionFields);
      updateActionFields();
    }
  }

  static _contentElement(content) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    return wrapper;
  }

  static async _wait({ title, content, actionLabel, processForm, options = {} }) {
    const config = foundry.utils.mergeObject(
      {
        classes: ['yzegs'],
        window: { title },
        content: this._contentElement(content),
        buttons: [
          {
            action: 'confirm',
            label: actionLabel,
            default: true,
            callback: (_event, button) => processForm(button.form),
          },
          {
            action: 'cancel',
            label: game.i18n.localize('YZEGS.Dialog.Actions.Cancel'),
            type: 'button',
            callback: () => ({ cancelled: true }),
          },
        ],
        rejectClose: false,
        render: (_event, dialog) => this._activateListeners(dialog),
      },
      options,
      { inplace: false },
    );
    const result = await this.Dialog.wait(config);
    return result ?? { cancelled: true };
  }

  static async askRollOptions(rollData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/roll-dialog.hbs',
      { data: rollData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: rollData.title,
      content,
      actionLabel: game.i18n.localize('YZEGS.Dialog.Actions.Normal'),
      processForm: this._processRollOptions,
      options,
    });
  }

  static async chooseTwilightAction(actionData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/action-dialog.hbs',
      { data: actionData },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.CombatActions.DialogTitle'),
      content,
      actionLabel: game.i18n.localize('YZEGS.CombatActions.Perform'),
      processForm: form => ({
        actionId: form.elements.namedItem('actionId')?.value ?? '',
        targetUuid: form.elements.namedItem('targetUuid')?.value ?? '',
        itemId: form.elements.namedItem('itemId')?.value ?? '',
      }),
      options,
    });
  }

  static async configureSocialConflict(data, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/social-conflict-dialog.hbs',
      { data },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Social.SetupTitle'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Social.Declare'),
      processForm: form => ({
        stakes: String(form.elements.namedItem('stakes')?.value ?? '').trim(),
        offer: String(form.elements.namedItem('offer')?.value ?? '').trim(),
        selectedFactors: [...form.querySelectorAll('.social-factor-toggle.is-checked')]
          .map(control => control.closest('.checkbox-control')?.dataset.path?.replace('factor.', ''))
          .filter(Boolean),
        customModifier: Number(form.elements.namedItem('customModifier')?.value) || 0,
        groupMode: form.elements.namedItem('groupMode')?.value ?? 'spokesperson',
        resistanceVisibility: form.elements.namedItem('resistanceVisibility')?.value ?? 'public',
        startingPrice: Number(form.elements.namedItem('startingPrice')?.value) || 0,
        direction: form.elements.namedItem('direction')?.value ?? 'buy',
      }),
      options,
    });
  }

  static async socialResponse(data, actionLabel, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/social-response-dialog.hbs',
      { data },
    );
    return this._wait({
      title: data.title,
      content,
      actionLabel,
      processForm: form => ({ details: String(form.elements.namedItem('details')?.value ?? '').trim() }),
      options,
    });
  }

  static _processRollOptions(form) {
    const actionInput = form.elements.namedItem('combatAction');
    const selectedAction = getSelectedMenuOption(actionInput);
    const actionValue = Number(selectedAction?.dataset.valueModifier) || 0;
    let actionDisplayValue = '–';
    if (actionValue) actionDisplayValue = actionValue >= 0 ? `+${actionValue}` : `−${Math.abs(actionValue)}`;
    const combatAction = actionInput?.value ? {
      id: actionInput.value,
      label: selectedAction.dataset.label,
      value: actionValue,
      displayValue: actionDisplayValue,
      speed: selectedAction.dataset.actionSpeed,
      speedLabel: selectedAction.dataset.actionSpeedLabel,
      registry: selectedAction.dataset.registry === 'true',
      rollMode: selectedAction.dataset.rollMode ?? '',
    } : null;
    const situationalModifiers = [...form.querySelectorAll('.situational-modifier.is-checked')].map(control => {
      const value = Number(control.dataset.value) || 0;
      let displayValue = '–';
      if (value) displayValue = value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
      return {
        id: control.dataset.modifierId,
        label: control.dataset.label,
        value,
        displayValue,
      };
    });
    return {
      attribute: parseInt(form.attribute?.value) || 0,
      skill: parseInt(form.skill?.value) || 0,
      rof: parseInt(form.rof?.value) || 0,
      modifier: parseInt(form.modifier.value) || 0,
      combatAction,
      targetUuid: form.elements.namedItem('targetUuid')?.value ?? '',
      itemId: form.elements.namedItem('itemId')?.value ?? '',
      situationalModifiers,
      calledLocation: form.elements.namedItem('calledLocation')?.value ?? '',
      oneHanded: form.elements.namedItem('oneHanded')?.value === 'true',
      indirectFire: form.elements.namedItem('indirectFire')?.value === 'true',
      locate: form.elements.namedItem('locate')?.value === 'true',
      maxPush: parseInt(form.maxPush.value) || 1,
      messageMode: form.messageMode.value,
    };
  }

  static async askCuFOptions(rollData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/cuf-dialog.hbs',
      { data: rollData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: rollData.title,
      content,
      actionLabel: game.i18n.localize('YZEGS.Dialog.Actions.Normal'),
      processForm: this._processCuFOptions,
      options,
    });
  }

  static async chooseBlastResolution({
    blast = 'D', indoor = false, airburst = false, directional = false, automatic = false,
  } = {}, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/blast-dialog.hbs',
      {
        data: {
          blast,
          indoor,
          airburst,
          directional,
          automatic,
          blastChoices: { A: 'A', B: 'B', C: 'C', D: 'D' },
        },
      },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Urban.Blast.Resolve'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Urban.Blast.Roll'),
      processForm: form => ({
        blast: form.elements.namedItem('blast')?.value ?? blast,
        contained: form.elements.namedItem('contained')?.value === 'true',
      }),
      options,
    });
  }

  static _processCuFOptions(form) {
    return {
      unitMorale: form.elements.namedItem('unitMorale')?.value === 'true',
      modifier: parseInt(form.modifier.value) || 0,
      messageMode: form.messageMode.value,
    };
  }

  static async chooseActor(actors, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/actor-choice-dialog.hbs',
      { actors, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Dialog.Actor.ChooseActor'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Dialog.Actions.Ok'),
      processForm: this._processActorChoice,
      options,
    });
  }

  static _processActorChoice(form) {
    return { actor: form.actor.value };
  }

  static async chooseReload(reloadData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/reload-dialog.hbs',
      { data: reloadData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.format('YZEGS.Reload.DialogTitle', { weapon: reloadData.weaponName }),
      content,
      actionLabel: game.i18n.localize('YZEGS.Dialog.Actions.Reload'),
      processForm: this._processReloadChoice,
      options,
    });
  }

  static _processReloadChoice(form) {
    return {
      sourceId: form.elements.namedItem('sourceId')?.value ?? '',
      reloaderId: form.elements.namedItem('reloaderId')?.value ?? '',
      modifier: Number(form.elements.namedItem('modifier')?.value) || 0,
    };
  }

  static async awardExperience(experienceData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/experience-award-dialog.hbs',
      { data: experienceData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Experience.AwardTitle'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Experience.AwardXp'),
      processForm: form => this._processExperienceAward(form, experienceData.questions),
      options,
    });
  }

  static _processExperienceAward(form, questions) {
    const selectedQuestions = questions.filter(question => (
      form.elements.namedItem(`questions.${question.id}`)?.value === 'true'
    ));
    const adjustment = Number(form.elements.namedItem('adjustment')?.value ?? 0);
    return {
      amount: Math.max(0, selectedQuestions.reduce((total, question) => total + question.amount, 0) + adjustment),
      note: form.elements.namedItem('note')?.value ?? '',
      questions: selectedQuestions.map(question => question.label),
    };
  }

  static async advanceSkill(experienceData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/experience-skill-dialog.hbs',
      { data: experienceData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.localize(experienceData.learning
        ? 'YZEGS.Experience.LearnSkillTitle'
        : 'YZEGS.Experience.AdvanceSkillTitle'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Experience.SpendXp'),
      processForm: form => ({
        trained: form.elements.namedItem('trained')?.value === 'true',
      }),
      options,
    });
  }

  static async learnSkill(experienceData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/experience-new-skill-dialog.hbs',
      { data: experienceData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Experience.LearnSkillTitle'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Experience.SpendXp'),
      processForm: form => ({
        sourceUuid: form.elements.namedItem('skill')?.value ?? '',
        experienced: form.elements.namedItem('experienced')?.value === 'true',
        trained: form.elements.namedItem('trained')?.value === 'true',
      }),
      options,
    });
  }

  static async learnSpecialty(experienceData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/experience-specialty-dialog.hbs',
      { data: experienceData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Experience.LearnSpecialtyTitle'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Experience.SpendXp'),
      processForm: form => ({
        sourceUuid: form.elements.namedItem('specialty')?.value ?? '',
        trainingSucceeded: form.elements.namedItem('trainingSucceeded')?.value === 'true',
      }),
      options,
    });
  }

  static async chooseDamage(damageData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/damage-choice-dialog.hbs',
      { data: damageData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Dialog.Damage.ChooseDamage'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Dialog.Actions.Ok'),
      processForm: this._processDamageChoice,
      options,
    });
  }

  static async chooseBlockMethod(blockData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/block-choice-dialog.hbs',
      { data: blockData },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Defense.Block'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Defense.DeclareBlock'),
      processForm: form => ({ itemUuid: form.elements.namedItem('itemUuid')?.value ?? '' }),
      options,
    });
  }

  static async chooseCloseAttackMethod(attackData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/close-attack-choice-dialog.hbs',
      { data: attackData },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.ActionNames.retreatFreeAttack'),
      content,
      actionLabel: game.i18n.localize('YZEGS.CombatEdges.RollFreeAttack'),
      processForm: form => ({ itemUuid: form.elements.namedItem('itemUuid')?.value ?? '' }),
      options,
    });
  }

  static async chooseCover(coverData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/cover-dialog.hbs',
      { data: coverData },
    );
    return this._wait({
      title: game.i18n.localize('YZEGS.Cover.Configure'),
      content,
      actionLabel: game.i18n.localize('YZEGS.Cover.TakeCover'),
      processForm: form => ({
        armor: Math.max(0, Math.trunc(Number(form.elements.namedItem('armor')?.value) || 0)),
      }),
      options,
    });
  }

  static _processDamageChoice(form) {
    return {
      ammoSpend: parseInt(form.elements.namedItem('ammoSpend')?.value) || 0,
      adjustment: parseInt(form.elements.namedItem('adjustment')?.value) || 0,
      barriers: form.barriers?.value,
    };
  }

  static async chooseValue(valueData, options) {
    const content = await foundry.applications.handlebars.renderTemplate(
      'systems/fvtt-yze-generic-stepped/templates/components/dialog/value-choice-dialog.hbs',
      { data: valueData, config: CONFIG.YZEGS },
    );
    return this._wait({
      title: valueData.title,
      content,
      actionLabel: game.i18n.localize('YZEGS.Dialog.Actions.Ok'),
      processForm: this._processValueChoice,
      options,
    });
  }

  static _processValueChoice(form) {
    return { value: parseInt(form.modifier.value) || 0 };
  }
}

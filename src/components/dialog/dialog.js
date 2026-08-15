import { activateCheckboxControls } from '../checkbox-control.js';
import { activateRatingMenus } from '../rating-menu.js';

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
      let value = parseInt(target.value);
      if (elem.dataset.change === 'plus') value++;
      else if (elem.dataset.change === 'minus') value--;
      target.value = value >= 0 ? `+${value}` : value;
    });

    html.find('.checkbox-control-toggle.item-modifier').on('change', function () {
      const modifierInput = html.find('input[name=modifier]')[0];
      let value = +modifierInput.value;
      value += this.checked ? +this.dataset.value : -this.dataset.value;
      modifierInput.value = value >= 0 ? `+${value}` : value;
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

  static _processRollOptions(form) {
    return {
      attribute: parseInt(form.attribute?.value) || 0,
      skill: parseInt(form.skill?.value) || 0,
      rof: parseInt(form.rof?.value) || 0,
      modifier: parseInt(form.modifier.value) || 0,
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

  static _processCuFOptions(form) {
    return {
      unitMorale: form.elements.namedItem('unitMorale')?.value === 'true',
      modifier: parseInt(form.modifier.value) || 0,
      maxPush: parseInt(form.maxPush.value) || 1,
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

  static _processDamageChoice(form) {
    return {
      damage: parseInt(form.damage.value) || 0,
      hitCount: parseInt(form.hits?.value) || 0,
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

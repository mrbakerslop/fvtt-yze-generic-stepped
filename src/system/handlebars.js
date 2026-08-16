/* eslint-disable quotes */
import { attackCausesSuppression } from './suppression.js';
import {
  guidedImpactCanApply,
  guidedImpactCanEvade,
  guidedImpactCanSchedule,
  guidedImpactIsPending,
  guidedImpactWasEvaded,
} from './guided-weapons.js';

/**
 * Defines a set of template paths to pre-load.
 * Pre-loaded templates are compiled and cached for fast access when rendering.
 * @return {Promise}
 */
export async function preloadHandlebarsTemplates() {
  // /* Esbuild defines the paths for us at build time. */
  // // eslint-disable-next-line no-undef
  // const paths = PATHS;
  // console.log('YZEGS | Loading Handlebars templates:', paths);
  // return loadTemplates(paths);
  return foundry.applications.handlebars.loadTemplates([
    // Shared Partials
    // 'templates/dice/roll.html',

    // Actor Sheet Partials
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/actor-stats.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/actor-combat.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/actor-equipment.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/actor-description.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/actor-experience.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/capacity-boxes.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/radiation-boxes.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/slots/slot-buttons.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/slots/weapon-slot.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/slots/armor-slot.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/slots/gear-slot.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/slots/ammo-slot.hbs',

    // Vehicle Sheet Partials
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/vehicle-crew.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/vehicle-combat.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/vehicle-cargo.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/vehicle-components.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/parts/slots/vehicle-weapon-slot.hbs',

    // Party Sheet Partials
    'systems/fvtt-yze-generic-stepped/templates/actor/party/sheet-tabs/main-tab.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/party/sheet-tabs/travel-tab.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/party/components/action-component.hbs',
    'systems/fvtt-yze-generic-stepped/templates/actor/party/components/member-component.hbs',

    // Item Sheet Partials
    'systems/fvtt-yze-generic-stepped/templates/item/parts/item-header.hbs',
    'systems/fvtt-yze-generic-stepped/templates/item/parts/item-modifiers.hbs',
    'systems/fvtt-yze-generic-stepped/templates/item/parts/item-description.hbs',

    // Chat Partials
  ]);
}

/* -------------------------------------------- */
/*  HandlebarsJS Custom Helpers                 */
/* -------------------------------------------- */

/**
 * Defines Handlebars custom Helpers and Partials.
 */
export function registerHandlebars() {
  Handlebars.registerHelper('guidedImpactCanApply', guidedImpactCanApply);
  Handlebars.registerHelper('guidedImpactCanSchedule', guidedImpactCanSchedule);
  Handlebars.registerHelper('guidedImpactIsPending', guidedImpactIsPending);
  Handlebars.registerHelper('guidedImpactWasEvaded', guidedImpactWasEvaded);
  Handlebars.registerHelper('guidedImpactCanEvade', guidedImpactCanEvade);
  Handlebars.registerHelper('effectiveAttackSuccesses', roll => {
    const defense = roll?.options?.defense;
    return defense?.status === 'resolved'
      ? Math.max(0, Number(defense.remainingSuccesses) || 0)
      : Math.max(0, Number(roll?.baseSuccessQty) || 0);
  });

  Handlebars.registerHelper('defensePending', roll => (
    roll?.options?.defense?.status === 'awaitingBlockRoll'
  ));

  Handlebars.registerHelper('suppressionRequired', roll => (
    Boolean(roll?.options?.suppression) && (roll.options.suppression.force || attackCausesSuppression({
      attackSuccesses: roll?.options?.defense?.status === 'resolved'
        ? roll.options.defense.remainingSuccesses
        : roll?.baseSuccessQty,
      ammoSuccesses: roll?.hitCount,
    }))
  ));

  Handlebars.registerHelper('hasBlast', roll => (
    ['A', 'B', 'C', 'D'].includes(String(roll?.options?.attackData?.blast ?? '').toLocaleUpperCase())
  ));

  Handlebars.registerHelper('confinedRicochetRequired', roll => {
    const defense = roll?.options?.defense;
    const successes = defense?.status === 'resolved'
      ? Math.max(0, Number(defense.remainingSuccesses) || 0)
      : Math.max(0, Number(roll?.baseSuccessQty) || 0);
    return Boolean(
      roll?.options?.attackData?.ricochetEligible
      && roll.options.attackData.primaryTargetUuid
      && !roll.options.confinedSpaceResolution?.ricochet
      && defense?.status !== 'awaitingBlockRoll'
      && successes === 0,
    );
  });

  Handlebars.registerHelper('confinedCollapseRequired', roll => Boolean(
    roll?.options?.attackData?.confinedSpace
    && ['A', 'B', 'C', 'D'].includes(String(roll.options.attackData.blast).toLocaleUpperCase())
    && !roll.options.attackData.blastResolution
    && !roll.options.confinedSpaceResolution?.collapse,
  ));

  Handlebars.registerHelper('concat', function () {
    let str = '';
    for (const arg in arguments) {
      if (typeof arguments[arg] !== 'object') {
        str += arguments[arg];
      }
    }
    return str;
  });

  Handlebars.registerHelper('capitalize', function (val) {
    return typeof val === 'string' && val.length > 0 ? val[0].toUpperCase() + val.slice(1) : val;
  });

  Handlebars.registerHelper('toLowerCase', function (str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper('toUpperCase', function (str) {
    return str.toUpperCase();
  });

  // Handlebars.registerHelper('flps_enrich', function (content) {
  //   // Enriches content.
  //   content = TextEditor.enrichHTML(content, { documents: true, async: true });
  //   return new Handlebars.SafeString(content);
  // });

  Handlebars.registerHelper('times', function (n, content) {
    let str = '';
    for (let i = 0; i < n; i++) {
      content.data.max = n;
      content.data.index = i + 1;
      str += content.fn(i);
    }
    return str;
  });

  Handlebars.registerHelper('mathMin', function (a, b) {
    return Math.min(a, b);
  });

  Handlebars.registerHelper('mathMax', function (a, b) {
    return Math.max(a, b);
  });

  Handlebars.registerHelper('add', function (a, b) {
    return a + b;
  });

  Handlebars.registerHelper('divide', function (a, b) {
    return a / b;
  });

  Handlebars.registerHelper('multiply', function (a, b) {
    return a * b;
  });

  Handlebars.registerHelper('ratio', function (a, b) {
    return (a / b) * 100;
  });

  /**
   * Shared custom menu for a stepped-die rating.
   * Parameters:
   * * `name` - The affected document path (omitted for embedded Skill Items).
   * * `selected` - The current rating.
   * * `editable` - Whether the menu can be changed.
   * * `inputClass` - Optional class for a specialised change listener.
   * * `itemId` - Optional embedded Item ID.
   */
  Handlebars.registerPartial(
    'scoreSelector',
    `<div class="rating-menu">
      <input type="hidden" class="rating-menu-input {{inputClass}}" value="{{selected}}" data-dtype="String"
        {{#if name}}name="{{name}}"{{/if}} {{#if itemId}}data-item-id="{{itemId}}"{{/if}}>
      <button type="button" class="rating-menu-trigger" aria-haspopup="listbox" aria-expanded="false"
        {{#unless editable}}disabled{{/unless}}>{{selected}}</button>
      <div class="rating-menu-options" role="listbox">
      {{#each @root.config.dieScores as |score|}}
        <button type="button" class="rating-menu-option{{#if (eq score ../selected)}} is-selected{{/if}}"
          data-value="{{score}}" role="option" tabindex="-1"
          aria-selected="{{#if (eq score ../selected)}}true{{else}}false{{/if}}">{{score}}</button>
      {{/each}}
      </div>
    </div>`,
  );

  /** Shared custom menu for a key/label options object. */
  Handlebars.registerPartial(
    'optionMenu',
    `<div class="rating-menu option-menu {{menuClass}}">
      <input type="hidden" class="rating-menu-input {{inputClass}}" value="{{selected}}" data-dtype="String"
        {{#if name}}name="{{name}}"{{/if}}>
      <button type="button" class="rating-menu-trigger" aria-haspopup="listbox" aria-expanded="false"
        {{#unless editable}}disabled{{/unless}}>
        {{#if selected}}
          {{#if (lookup options selected)}}
            {{#if localize}}{{localize (lookup options selected)}}{{else}}{{lookup options selected}}{{/if}}
          {{else}}–{{/if}}
        {{else}}–{{/if}}
      </button>
      <div class="rating-menu-options" role="listbox">
      {{#unless noBlank}}
        <button type="button" class="rating-menu-option{{#unless selected}} is-selected{{/unless}}"
          data-value="" role="option" tabindex="-1"
          aria-selected="{{#unless selected}}true{{else}}false{{/unless}}">–</button>
      {{/unless}}
      {{#each options as |label value|}}
        <button type="button" class="rating-menu-option{{#if (eq value ../selected)}} is-selected{{/if}}"
          data-value="{{value}}" role="option" tabindex="-1"
          aria-selected="{{#if (eq value ../selected)}}true{{else}}false{{/if}}">
          {{#if label}}{{#if ../localize}}{{localize label}}{{else}}{{label}}{{/if}}{{else}}–{{/if}}
        </button>
      {{/each}}
      </div>
    </div>`,
  );

  /** Shared custom menu for options divided into labelled groups. */
  Handlebars.registerPartial(
    'groupedOptionMenu',
    `<div class="rating-menu option-menu grouped-option-menu {{menuClass}}">
      <input type="hidden" class="rating-menu-input {{inputClass}}" value="{{selected}}" data-dtype="String"
        {{#if name}}name="{{name}}"{{/if}}>
      <button type="button" class="rating-menu-trigger" aria-haspopup="listbox" aria-expanded="false"
        {{#unless editable}}disabled{{/unless}}>
        {{#if selectedLabel}}{{selectedLabel}}{{else}}{{localize placeholder}}{{/if}}
      </button>
      <div class="rating-menu-options" role="listbox">
      {{#each groups as |group|}}
        <div class="rating-menu-group-label">{{group.label}}</div>
        {{#each group.options as |label value|}}
        <button type="button" class="rating-menu-option{{#if (eq value ../../selected)}} is-selected{{/if}}"
          data-value="{{value}}" role="option" tabindex="-1"
          aria-selected="{{#if (eq value ../../selected)}}true{{else}}false{{/if}}">{{label}}</button>
        {{/each}}
      {{/each}}
      </div>
    </div>`,
  );

  /** Custom menu for dialog choices which carry contextual filtering metadata. */
  Handlebars.registerPartial(
    'dialogChoiceMenu',
    `<div class="rating-menu option-menu dialog-option-menu {{menuClass}}">
      <input type="hidden" class="rating-menu-input {{inputClass}}" name="{{name}}"
        value="{{selected}}" data-dtype="String">
      <button type="button" class="rating-menu-trigger" aria-haspopup="listbox" aria-expanded="false"
        title="{{selectedLabel}}">
        {{#if selectedLabel}}{{selectedLabel}}{{else}}{{placeholder}}{{/if}}
      </button>
      <div class="rating-menu-options" role="listbox">
      {{#unless noBlank}}
        <button type="button" class="rating-menu-option{{#unless selected}} is-selected{{/unless}}"
          data-value="" role="option" tabindex="-1"
          aria-selected="{{#unless selected}}true{{else}}false{{/unless}}">{{placeholder}}</button>
      {{/unless}}
      {{#each choices as |choice|}}
        <button type="button" class="rating-menu-option{{#if (eq choice.value ../selected)}} is-selected{{/if}}"
          data-value="{{choice.value}}" data-type="{{choice.type}}" data-self="{{choice.self}}"
          data-actions="{{choice.actionIds}}" role="option" tabindex="-1"
          aria-selected="{{#if (eq choice.value ../selected)}}true{{else}}false{{/if}}"
          {{#if choice.disabled}}disabled{{/if}}>{{choice.label}}</button>
      {{/each}}
      </div>
    </div>`,
  );

  /** Grouped custom menu for Twilight: 2000 actions and their workflow metadata. */
  Handlebars.registerPartial(
    'dialogActionMenu',
    `<div class="rating-menu option-menu grouped-option-menu dialog-option-menu action-option-menu">
      <input type="hidden" class="rating-menu-input {{inputClass}}" name="{{name}}"
        value="{{selected}}" data-dtype="String">
      <button type="button" class="rating-menu-trigger" aria-haspopup="listbox" aria-expanded="false"
        title="{{selectedLabel}}">
        {{#if selectedLabel}}{{selectedLabel}}{{else}}{{placeholder}}{{/if}}
      </button>
      <div class="rating-menu-options" role="listbox">
      {{#unless noBlank}}
        <button type="button" class="rating-menu-option{{#unless selected}} is-selected{{/unless}}"
          data-value="" data-value-modifier="0" role="option" tabindex="-1"
          aria-selected="{{#unless selected}}true{{else}}false{{/unless}}"
          {{#if blankDisabled}}disabled{{/if}}>{{placeholder}}</button>
      {{/unless}}
      {{#each groups as |group|}}
        <div class="rating-menu-group-label">{{#if group.name}}{{group.name}}{{else}}{{group.label}}{{/if}}</div>
        {{#each group.actions as |action|}}
        <button type="button" class="rating-menu-option{{#if (eq action.id ../../selected)}} is-selected{{/if}}"
          data-value="{{action.id}}" data-value-modifier="{{action.value}}" data-label="{{action.name}}"
          data-action-speed="{{action.group}}" data-action-speed-label="{{action.speedName}}"
          data-registry="{{action.registry}}" data-target-mode="{{action.target}}"
          data-item-mode="{{action.item}}" data-hint="{{action.hint}}" data-roll-mode="{{action.rollMode}}"
          title="{{action.name}}"
          role="option" tabindex="-1" aria-selected="{{#if (eq action.id ../../selected)}}true{{else}}false{{/if}}"
          {{#if action.disabled}}disabled{{/if}}>
          {{action.name}}{{#if action.value}} ({{action.displayValue}}){{/if}}{{#if action.usesSlowForFast}}
            — {{localize 'YZEGS.CombatActions.UsesSlow'}}{{/if}}{{#if action.disabled}}
            — {{localize 'YZEGS.CombatActions.Unavailable'}}{{/if}}
        </button>
        {{/each}}
      {{/each}}
      </div>
    </div>`,
  );

  /** Shared editable custom menu with filtered suggestions and free-text values. */
  Handlebars.registerPartial(
    'comboMenu',
    `<div class="rating-menu option-menu combo-menu {{menuClass}}">
      <input type="text" class="rating-menu-trigger rating-menu-input combo-menu-input {{inputClass}}"
        value="{{selected}}" data-dtype="String" autocomplete="off" role="combobox"
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false"
        {{#if name}}name="{{name}}"{{/if}} {{#unless editable}}disabled{{/unless}}>
      <div class="rating-menu-options" role="listbox">
      {{#each options as |label value|}}
        <button type="button" class="rating-menu-option{{#if (eq value ../selected)}} is-selected{{/if}}"
          data-value="{{value}}" role="option" tabindex="-1"
          aria-selected="{{#if (eq value ../selected)}}true{{else}}false{{/if}}">{{label}}</button>
      {{/each}}
      </div>
    </div>`,
  );

  /** Shared system-owned checkbox control: `name`, `value`, and `editable`. */
  Handlebars.registerPartial(
    'checkboxControl',
    `<span class="checkbox-control" data-path="{{name}}">
      <button type="button" role="checkbox"
        {{#if id}}id="{{id}}"{{/if}}
        class="checkbox-control-toggle {{inputClass}}{{#if value}} is-checked{{/if}}"
        aria-checked="{{#if value}}true{{else}}false{{/if}}"
        {{#if ariaLabel}}aria-label="{{ariaLabel}}"{{/if}}
        data-value="{{dataValue}}"
        {{#if dataModifierId}}data-modifier-id="{{dataModifierId}}"{{/if}}
        {{#if dataLabel}}data-label="{{dataLabel}}"{{/if}}
        {{#if dataExclusiveGroup}}data-exclusive-group="{{dataExclusiveGroup}}"{{/if}}
        {{#unless editable}}disabled{{/unless}}></button>
    </span>`,
  );
}

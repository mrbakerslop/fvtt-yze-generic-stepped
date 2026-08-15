/* eslint-disable quotes */
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
        {{#if dataValue}}data-value="{{dataValue}}"{{/if}}
        {{#unless editable}}disabled{{/unless}}></button>
    </span>`,
  );
}

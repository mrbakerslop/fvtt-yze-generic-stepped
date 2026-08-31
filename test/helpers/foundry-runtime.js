/* eslint-disable no-empty-function, no-shadow, no-undef */

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

class MockCollection extends Map {
  get contents() {
    return [...this.values()];
  }

  find(predicate) {
    return this.contents.find(predicate);
  }

  filter(predicate) {
    return this.contents.filter(predicate);
  }

  map(predicate) {
    return this.contents.map(predicate);
  }
}

class MockApplication {
  static DEFAULT_OPTIONS = {};

  constructor(document = {}, options = {}) {
    this.document = document;
    this.actor = document;
    this.item = document;
    this.options = options;
    this.isEditable = true;
    this.tabGroups = { primary: 'main' };
    this.element = { querySelector: () => null, querySelectorAll: () => [] };
  }

  _configureRenderParts() {
    return clone(this.constructor.PARTS ?? { sheet: { template: '' } });
  }

  async _prepareContext() {
    return {};
  }

  _getFrameButtons() {
    return [];
  }
}

class MockDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.system ??= {};
    this.items ??= new MockCollection();
  }
}

class MockDie {
  static MODIFIERS = {};
  static SERIALIZE_ATTRIBUTES = [];

  constructor(data = {}) {
    Object.assign(this, data);
    this.number ??= 1;
    this.faces ??= 6;
    this.results ??= [];
    this.options ??= {};
  }
}

class MockRoll {
  constructor(formula = '', data = {}, options = {}) {
    this.formula = formula;
    this.data = data;
    this.options = options;
    this.terms = [];
  }
}

class MockField {
  constructor(options = {}) {
    this.options = options;
  }
}

/** Install the minimum browser and Foundry API surface needed to import and initialize the system. */
export function installFoundryRuntime() {
  const hooks = new Map();
  const sheetRegistrations = [];
  const settingValues = new Map();
  const socketHandlers = new Map();

  globalThis.Hooks = {
    once(name, callback) {
      hooks.set(name, [...(hooks.get(name) ?? []), { callback, once: true }]);
    },
    on(name, callback) {
      hooks.set(name, [...(hooks.get(name) ?? []), { callback, once: false }]);
    },
    callAll() {},
  };

  const utils = {
    Collection: MockCollection,
    deepClone: clone,
    escapeHTML: value => String(value ?? ''),
    expandObject: value => value,
    getProperty(object, path) {
      return String(path).split('.').reduce((value, key) => value?.[key], object);
    },
    getType: value => value?.constructor?.name ?? typeof value,
    hasProperty(object, path) {
      return this.getProperty(object, path) !== undefined;
    },
    isEmpty: value => !value || Object.keys(value).length === 0,
    isNewerVersion: () => false,
    mergeObject(original, update) {
      return Object.assign(original, update);
    },
    randomID: () => 'runtimeSmokeId',
    setProperty(object, path, value) {
      const keys = String(path).split('.');
      const final = keys.pop();
      const target = keys.reduce((entry, key) => (entry[key] ??= {}), object);
      target[final] = value;
      return true;
    },
  };

  const HandlebarsApplicationMixin = Base => class extends Base {};
  const fields = Object.fromEntries([
    'ArrayField', 'BooleanField', 'HTMLField', 'NumberField', 'ObjectField', 'SchemaField', 'StringField',
  ].map(name => [name, class extends MockField {}]));

  globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    applications: {
      api: {
        ApplicationV2: MockApplication,
        DialogV2: {},
        HandlebarsApplicationMixin,
      },
      apps: {
        DocumentSheetConfig: {
          registerSheet(documentClass, namespace, sheetClass, options) {
            sheetRegistrations.push({ documentClass, namespace, sheetClass, options });
          },
        },
      },
      handlebars: {
        loadTemplates: async paths => paths,
        renderTemplate: async (template, data) => ({ template, data }),
      },
      sheets: { ActorSheetV2: MockApplication, ItemSheetV2: MockApplication },
      ux: {
        ContextMenuEntry: class {},
        TextEditor: { implementation: { enrichHTML: async value => value, getDragEventData: () => ({}) } },
      },
    },
    data: {
      fields,
      operators: { ForcedDeletion: class {} },
      regionBehaviors: { RegionBehaviorType: class {} },
    },
    dice: {
      terms: {
        DiceTerm: class { static fromData(data) { return data; } },
        Die: MockDie,
        OperatorTerm: class { constructor(data) { Object.assign(this, data); } },
      },
    },
    documents: { ChatMessage: class extends MockDocument {} },
    utils,
  };

  globalThis.Actor = class extends MockDocument {};
  globalThis.Item = class extends MockDocument {};
  globalThis.Combat = class extends MockDocument {};
  globalThis.Roll = MockRoll;
  globalThis.ChatMessage = foundry.documents.ChatMessage;
  globalThis.Macro = class extends MockDocument {};
  globalThis.ActiveEffect = class extends MockDocument {};
  globalThis.TextEditor = { createAnchor: options => options };
  globalThis.Handlebars = {
    SafeString: class { constructor(value) { this.value = value; } },
    registerHelper() {},
    registerPartial() {},
  };
  globalThis.$ = () => ({ find: () => ({ click() {}, each() {}, focus() {} }) });
  globalThis.HTMLElement = class {};
  globalThis.fromUuid = async () => null;
  globalThis.fromUuidSync = () => null;
  globalThis.fetch = async () => ({ ok: true, async text() { return '[]'; } });

  globalThis.CONST = {
    CHAT_MESSAGE_STYLES: { OTHER: 0, ROLL: 1 },
    CHAT_MESSAGE_TYPES: { ROLL: 1 },
    DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2, OWNER: 3 },
    REGION_EVENTS: { TOKEN_ENTER: 'tokenEnter', TOKEN_EXIT: 'tokenExit', TOKEN_MOVE_WITHIN: 'tokenMoveWithin' },
    TOKEN_DISPLAY_MODES: { NONE: 0, OWNER_HOVER: 20, ALWAYS: 50 },
    TOKEN_DISPOSITIONS: { HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 },
  };

  globalThis.CONFIG = {
    Actor: { dataModels: {}, documentClass: Actor },
    Combat: {},
    Dice: { fulfillment: { dice: {} }, rolls: [], terms: {} },
    Item: { dataModels: {}, documentClass: Item },
    RegionBehavior: { dataModels: {}, typeHints: {}, typeIcons: {}, typeLabels: {} },
    TextEditor: { enrichers: [] },
    debug: { dice: false },
    fontDefinitions: {},
    statusEffects: [],
  };

  const documents = () => new MockCollection();
  globalThis.game = {
    actors: documents(),
    combats: documents(),
    folders: documents(),
    i18n: {
      lang: 'en',
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`,
      localize: key => key,
    },
    items: documents(),
    macros: documents(),
    messages: documents(),
    packs: documents(),
    scenes: documents(),
    settings: {
      get(namespace, key) {
        return settingValues.get(`${namespace}.${key}`);
      },
      register(namespace, key, options) {
        const id = `${namespace}.${key}`;
        if (!settingValues.has(id)) settingValues.set(id, clone(options.default));
      },
      registerMenu() {},
      async set(namespace, key, value) {
        settingValues.set(`${namespace}.${key}`, value);
        return value;
      },
    },
    socket: {
      emit() {},
      on(name, callback) {
        socketHandlers.set(name, [...(socketHandlers.get(name) ?? []), callback]);
      },
    },
    system: { version: '14.0.15' },
    tables: documents(),
    user: { id: 'runtime-user', isGM: true },
    users: documents(),
  };
  globalThis.canvas = { ready: false, scene: null, tokens: { controlled: [] } };
  globalThis.ui = { notifications: { error() {}, info() {}, warn() {} } };

  return {
    hooks,
    settingValues,
    sheetRegistrations,
    socketHandlers,
    async trigger(name, ...args) {
      const registered = hooks.get(name) ?? [];
      hooks.set(name, registered.filter(entry => !entry.once));
      for (const { callback } of registered) await callback(...args);
    },
  };
}

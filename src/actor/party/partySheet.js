/* eslint-disable max-len */
import ActorSheetYZEGS from '../actorSheet.js';
import { TravelActionsConfig } from './components/travel-actions.js';
import { isCityTravelScene } from '../../system/scene-grid.js';
import { getCityFuelUsed } from '../../system/urban-operations.js';
import { getWaterTravelProfile } from '../../system/water-rules.js';
import { advanceWaterTravelShift, rollWaterFishing } from '../../system/water-travel.js';

export default class ActorSheetYZEGSParty extends ActorSheetYZEGS {
  static DEFAULT_OPTIONS = {
    classes: ['character', 'party'],
    position: { width: 700, height: 830 },
  };

  static TABS = {
    primary: {
      tabs: [{ id: 'main' }, { id: 'travel' }, { id: 'note' }],
      initial: 'main',
    },
  };

  get actorProperties() {
    return this.actor.system;
  }

  async _prepareContext(options) {
    const partyData = await super._prepareContext(options);
    partyData.partyMembers = {};
    partyData.travel = {};
    partyData.waterTravel = Boolean(
      this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelMode'),
    );
    partyData.cityTravel = !partyData.waterTravel && (isCityTravelScene() || Boolean(
      this.actor.getFlag('fvtt-yze-generic-stepped', 'cityTravelMode'),
    ));
    partyData.cityStretch = Number(
      this.actor.getFlag('fvtt-yze-generic-stepped', 'cityTravelStretch'),
    ) || 0;
    partyData.isGM = game.user.isGM;
    partyData.waterStretch = Number(this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelStretch')) || 0;
    partyData.waterTerrain = this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelTerrain') || 'river';
    partyData.waterNight = Boolean(this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelNight'));
    partyData.waterVesselUuid = this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelVessel') || '';
    partyData.waterNavigatorUuid = this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelNavigator') || '';
    partyData.waterRouteBranch = Boolean(this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelRouteBranch'));
    partyData.waterTerrainChoices = {
      river: game.i18n.localize('YZEGS.WaterTravel.Terrain.River'),
      coast: game.i18n.localize('YZEGS.WaterTravel.Terrain.Coast'),
      openWater: game.i18n.localize('YZEGS.WaterTravel.Terrain.OpenWater'),
    };
    partyData.waterVesselChoices = Object.fromEntries(game.actors
      .filter(actor => actor.type === 'vehicle' && ['watercraft', 'amphibious'].includes(actor.system.domain))
      .map(actor => [actor.uuid, actor.name]));
    partyData.waterProfile = getWaterTravelProfile(partyData.waterTerrain, { night: partyData.waterNight });
    const selectedVessel = partyData.waterVesselUuid
      ? game.actors.find(actor => actor.uuid === partyData.waterVesselUuid)
      : null;
    partyData.waterCanCamp = Number(selectedVessel?.system.watercraft?.size) >= 2;
    partyData.travelActions = await this.getTravelActions(partyData.cityTravel, partyData.waterTravel);
    let ownedActorId, assignedActorId, travelAction;
    for (let i = 0; i < (partyData.system.members || []).length; i++) {
      ownedActorId = partyData.system.members[i];
      const member = game.actors.get(ownedActorId);
      if (!member) continue;
      partyData.partyMembers[ownedActorId] = member;
      // eslint-disable-next-line max-len
      partyData.partyMembers[ownedActorId].enrichedName = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        `@Actor[${partyData.partyMembers[ownedActorId].name}]`,
        { async: true },
      );
    }
    partyData.waterNavigatorChoices = Object.fromEntries(Object.values(partyData.partyMembers)
      .map(actor => [actor.uuid, actor.name]));
    for (const travelActionKey in partyData.system.travel) {
      travelAction = partyData.system.travel[travelActionKey];
      partyData.travel[travelActionKey] = {};

      if (typeof travelAction === 'object') {
        for (let i = 0; i < travelAction.length; i++) {
          assignedActorId = travelAction[i];
          if (assignedActorId != null) {
            partyData.travel[travelActionKey][assignedActorId] = game.actors.get(assignedActorId);
          }
        }
      }
      else if (travelAction !== '') {
        partyData.travel[travelActionKey][travelAction] = game.actors.get(travelAction);
      }
    }
    return partyData;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    html.find('.member-delete').click(this.handleRemoveMember.bind(this));
    html.find('.reset').click(async event => {
      event.preventDefault();
      await this.assignPartyMembersToAction(this.actor.system.members, 'other');
      this.render(true);
    });
    html.find('.city-travel-toggle').on('change', async event => {
      await this.setCityTravelMode(event.currentTarget.checked);
      this.render(true);
    });
    html.find('.water-travel-toggle').on('change', async event => {
      await this.setWaterTravelMode(event.currentTarget.checked);
      this.render(true);
    });
    html.find('.water-travel-terrain').on('change', async event => {
      await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelTerrain', event.currentTarget.value);
      this.render(true);
    });
    html.find('.water-travel-vessel').on('change', async event => {
      await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelVessel', event.currentTarget.value);
      this.render(true);
    });
    html.find('.water-travel-night').on('change', async event => {
      await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelNight', event.currentTarget.checked);
      this.render(true);
    });
    html.find('.water-travel-navigator').on('change', async event => {
      await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelNavigator', event.currentTarget.value);
    });
    html.find('.water-travel-route-branch').on('change', async event => {
      await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelRouteBranch', event.currentTarget.checked);
      this.render(true);
    });
    html.find('.water-fishing-roll').on('click', async event => {
      event.preventDefault();
      await rollWaterFishing(
        this.actor,
        this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelTerrain') || 'river',
      );
    });
    html.find('.water-shift-advance').on('click', async event => {
      event.preventDefault();
      await this.advanceWaterShift();
      this.render(true);
    });
    html.find('.city-stretch-advance').on('click', async event => {
      event.preventDefault();
      await this.advanceCityStretch();
      this.render(true);
    });
    const updateCityFuel = () => {
      const output = this.element.querySelector('.city-fuel-result');
      if (!output) return;
      const consumption = Number(this.element.querySelector('[name="cityFuelConsumption"]')?.value) || 0;
      const roadHexes = Number(this.element.querySelector('[name="cityRoadHexes"]')?.value) || 0;
      const offRoadHexes = Number(this.element.querySelector('[name="cityOffRoadHexes"]')?.value) || 0;
      const fuelMultiplier = Number(this.element.querySelector('[name="cityFuelMultiplier"]')?.value) || 1;
      output.textContent = String(getCityFuelUsed(consumption, { roadHexes, offRoadHexes, fuelMultiplier }));
    };
    html.find('.city-fuel-calculator input').on('input change', updateCityFuel);
    updateCityFuel();

    let button;
    for (const key in TravelActionsConfig) {
      for (let i = 0; i < TravelActionsConfig[key].buttons.length; i++) {
        button = TravelActionsConfig[key].buttons[i];
        html.find('.' + button.class).click(button.handler.bind(this, this));
      }
    }
  }

  async getTravelActions(cityTravel = false, waterTravel = false) {
    const travelActions = Object.fromEntries(Object.entries(TravelActionsConfig).map(([key, action]) => [
      key,
      { ...action, buttons: (cityTravel && key === 'march') || (waterTravel && key === 'fish')
        ? [] : [...action.buttons] },
    ]));
    for (const action of Object.values(travelActions)) {
      action.displayJournalEntry = !!action.journalEntryName && !!game.journal.getName(action.journalEntryName);
      if (action.displayJournalEntry) {
        const str = `@JournalEntry[${action.journalEntryName.capitalize()}]{${game.i18n.localize(action.name)}}`;
        action.enrichedEntryName = await foundry.applications.ux.TextEditor.implementation.enrichHTML(str, { async: true });
      }
    }
    return travelActions;
  }

  async setCityTravelMode(enabled) {
    await this.actor.setFlag('fvtt-yze-generic-stepped', 'cityTravelMode', Boolean(enabled));
    if (enabled) await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelMode', false);
    if (!enabled) return;
    const allowed = new Set(['march', 'drive', 'watch', 'other']);
    const update = {};
    const displaced = new Set(this.actor.system.travel.other ?? []);
    for (const [key, assignment] of Object.entries(this.actor.system.travel)) {
      if (allowed.has(key)) continue;
      for (const actorId of Array.isArray(assignment) ? assignment : [assignment]) {
        if (actorId) displaced.add(actorId);
      }
      update[`system.travel.${key}`] = Array.isArray(assignment) ? [] : '';
    }
    update['system.travel.other'] = [...displaced];
    await this.actor.update(update);
  }

  async setWaterTravelMode(enabled) {
    await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelMode', Boolean(enabled));
    if (!enabled) return;
    await this.actor.setFlag('fvtt-yze-generic-stepped', 'cityTravelMode', false);
    const allowed = new Set(['drive', 'watch', 'fish', 'rest', 'sleep', 'camp', 'other']);
    const update = {};
    const displaced = new Set(this.actor.system.travel.other ?? []);
    for (const [key, assignment] of Object.entries(this.actor.system.travel)) {
      if (allowed.has(key)) continue;
      for (const actorId of Array.isArray(assignment) ? assignment : [assignment]) {
        if (actorId) displaced.add(actorId);
      }
      update[`system.travel.${key}`] = Array.isArray(assignment) ? [] : '';
    }
    update['system.travel.other'] = [...displaced];
    await this.actor.update(update);
  }

  async advanceWaterShift() {
    if (!game.user.isGM) return false;
    const vesselUuid = this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelVessel') || '';
    const terrain = this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelTerrain') || 'river';
    const night = Boolean(this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelNight'));
    const navigatorUuid = this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelNavigator') || '';
    const routeBranch = Boolean(this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelRouteBranch'));
    const result = await advanceWaterTravelShift(this.actor, {
      vesselUuid, terrain, night, navigatorUuid, routeBranch,
    });
    if (!result) return false;
    const stretch = (Number(this.actor.getFlag('fvtt-yze-generic-stepped', 'waterTravelStretch')) || 0) + 1;
    await this.actor.setFlag('fvtt-yze-generic-stepped', 'waterTravelStretch', stretch);
    return true;
  }

  async advanceCityStretch() {
    if (!game.user.isGM) return false;
    const stretch = (Number(
      this.actor.getFlag('fvtt-yze-generic-stepped', 'cityTravelStretch'),
    ) || 0) + 1;
    await this.actor.setFlag('fvtt-yze-generic-stepped', 'cityTravelStretch', stretch);
    const content = `<p>${game.i18n.format('YZEGS.Urban.CityTravel.StretchReminder', { stretch })}</p>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      whisper: ChatMessage.getWhisperRecipients('GM').map(user => user.id),
    });
    return true;
  }

  async handleRemoveMember(event) {
    event.preventDefault();
    const div = $(event.currentTarget).parents('.party-member');
    const entityId = div.data('entity-id');

    const partyMembers = [...this.actor.system.members];
    partyMembers.splice(partyMembers.indexOf(entityId), 1);

    const updateData = {
      'system.members': partyMembers,
    };

    let travelAction, actionParticipants;
    for (const travelActionKey in this.actor.system.travel) {
      travelAction = this.actor.system.travel[travelActionKey];
      if (travelAction.indexOf(entityId) < 0) continue;

      if (typeof travelAction === 'object') {
        actionParticipants = [...travelAction];
        actionParticipants.splice(actionParticipants.indexOf(entityId), 1);
        updateData['system.travel.' + travelActionKey] = actionParticipants;
      }
      else {
        updateData['system.travel.' + travelActionKey] = '';
      }
    }

    await this.actor.update(updateData);

    div.slideUp(200, () => this.render(false));
  }

  _onDragStart(event) {
    if (event.currentTarget.dataset.itemId !== undefined) {
      super._onDragStart(event);
      return;
    }

    const entityId = event.currentTarget.dataset.entityId;
    const actor = game.actors.get(entityId);
    if (!actor) return;
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'Actor',
        action: 'assign',
        id: entityId,
        uuid: actor.uuid,
      }),
    );
  }

  async _onDropActor(event, actor) {
    const draggedItem = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (!actor || actor.type !== 'character') return null;

    if (draggedItem.action === 'assign') {
      await this.handleTravelActionAssignment(event, actor);
    }
    else {
      await this.handleAddToParty(actor);
    }
    this.render(true);
    return actor;
  }

  async handleTravelActionAssignment(event, actor) {
    const targetElement = event.target;
    const actionContainer = targetElement.classList.contains('travel-action')
      ? targetElement
      : targetElement.closest('.travel-action');
    if (actionContainer === null) return; // character was dragged god knows where; just pretend it never happened

    return this.assignPartyMembersToAction(actor, actionContainer.dataset.travelAction);
  }

  async assignPartyMembersToAction(partyMembers, travelActionKey) {
    if (!Array.isArray(partyMembers)) partyMembers = [partyMembers];

    const updateData = {};
    let updDataKey, partyMemberId;
    for (let i = 0; i < partyMembers.length; i++) {
      partyMemberId = typeof partyMembers[i] === 'object' ? partyMembers[i].id : partyMembers[i];

      // remove party member from the current assignment
      let travelAction, actionParticipants;
      for (const key in this.actor.system.travel) {
        travelAction = this.actor.system.travel[key];
        if (travelAction.indexOf(partyMemberId) < 0) continue;

        updDataKey = 'system.travel.' + key;
        if (typeof travelAction === 'object') {
          if (updateData[updDataKey] === undefined) {
            actionParticipants = [...travelAction];
            actionParticipants.splice(actionParticipants.indexOf(partyMemberId), 1);
            updateData[updDataKey] = actionParticipants;
          }
          else {
            updateData[updDataKey].splice(updateData[updDataKey].indexOf(partyMemberId), 1);
          }
        }
        else {
          updateData[updDataKey] = '';
        }
      }

      // add party member to a new assignment
      updDataKey = 'system.travel.' + travelActionKey;
      if (typeof this.actor.system.travel[travelActionKey] === 'object') {
        if (updateData[updDataKey] === undefined) {
          actionParticipants = [...this.actor.system.travel[travelActionKey]];
          actionParticipants.push(partyMemberId);
          updateData[updDataKey] = actionParticipants;
        }
        else {
          updateData[updDataKey].push(partyMemberId);
        }
      }
      else {
        updateData[updDataKey] = partyMemberId;
        // if someone was already assigned here we must move that character to the "Other" assignment
        if (this.actor.system.travel[travelActionKey] !== '') {
          if (updateData['system.travel.other'] === undefined) {
            actionParticipants = [...this.actor.system.travel.other];
            actionParticipants.push(this.actor.system.travel[travelActionKey]);
            updateData['system.travel.other'] = actionParticipants;
          }
          else {
            updateData['system.travel.other'].push(this.actor.system.travel[travelActionKey]);
          }
        }
      }
    }

    await this.actor.update(updateData);
  }

  async handleAddToParty(actor) {
    let partyMembers = [...this.actor.system.members];
    const initialCount = partyMembers.length;
    partyMembers.push(actor.id);
    partyMembers = [...new Set(partyMembers)]; // remove duplicate values
    if (initialCount === partyMembers.length) return; // nothing changed

    const travelOther = [...this.actor.system.travel.other];
    travelOther.push(actor.id);
    await this.actor.update({ 'system.members': partyMembers, 'system.travel.other': travelOther });
  }
}

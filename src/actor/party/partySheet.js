/* eslint-disable max-len */
import ActorSheetYZEGS from '../actorSheet.js';
import { TravelActionsConfig } from './components/travel-actions.js';

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
    partyData.travelActions = await this.getTravelActions();
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

    let button;
    for (const key in TravelActionsConfig) {
      for (let i = 0; i < TravelActionsConfig[key].buttons.length; i++) {
        button = TravelActionsConfig[key].buttons[i];
        html.find('.' + button.class).click(button.handler.bind(this, this));
      }
    }
  }

  async getTravelActions() {
    const travelActions = TravelActionsConfig;
    for (const action of Object.values(travelActions)) {
      action.displayJournalEntry = !!action.journalEntryName && !!game.journal.getName(action.journalEntryName);
      if (action.displayJournalEntry) {
        const str = `@JournalEntry[${action.journalEntryName.capitalize()}]{${game.i18n.localize(action.name)}}`;
        action.enrichedEntryName = await foundry.applications.ux.TextEditor.implementation.enrichHTML(str, { async: true });
      }
    }
    return travelActions;
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

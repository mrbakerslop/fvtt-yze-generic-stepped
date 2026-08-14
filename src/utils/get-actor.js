export async function getActiveActor() {
  let actor;
  if (game.user.isGM && canvas.ready && canvas.tokens.controlled.length > 1) {
    return chooseActor(canvas.tokens.controlled.map(t => t.actor), {
      title: game.i18n.localize('YZEGS.MACRO.GetActorTitle'),
      notes: game.i18n.localize('YZEGS.MACRO.GetActorHint'),
    });
  }
  const speaker = ChatMessage.getSpeaker();
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) {
    ui.notifications.warn(game.i18n.format('YZEGS.MACRO.NoActor', {
      actor: speaker.alias,
    }));
    return;
  }
  return actor;
}

/**
 * Displays a dialog for requesting the choice of an Actor.
 * @see {@link foundry.applications.api.DialogV2}
 * @param {Actor[]} actors
 * @param {Object} [options]
 * @param {string} [options.title]
 * @param {string} [options.notes]
 * @returns {Promise<Actor>} Selected Actor
 */
export async function chooseActor(actors = [], options = {}) {
  let content = '<div class="form-group">'
    + '<select id="actor" style="width: 100%;">';

  actors.forEach((a, i) => {
    content += `<option value="${a.id}"${i === 0 ? ' selected' : ''}>`
      + `<img src="${a.img}" width="24" height="24"/>`
      + `${a.name} (HP: ${a.system.health.value}/${a.system.health.max}) (ID: ${a.id})`
      + '</option>';
  });

  content += '</select>';
  if (options.notes) content += `<p class="notes">${options.notes}</p>`;
  content += '</div>';

  const actorId = await foundry.applications.api.DialogV2.prompt({
    classes: ['yzegs'],
    window: { title: options.title ?? 'Choose an Actor' },
    content,
    ok: {
      label: game.i18n.localize('YZEGS.Dialog.Actions.Ok'),
      callback: (_event, button) => button.form.querySelector('#actor').value,
    },
    rejectClose: false,
    position: { width: 400 },
  });

  return actors.find(a => a.id === actorId);
}

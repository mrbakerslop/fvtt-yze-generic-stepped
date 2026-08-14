/* eslint-disable max-len */
export class CharacterPickerDialog {
  /**
   * Show dialog that allows to pick a character from a list
   *
   */
  static async show(title, characters = [], onSelect, onCancel) {
    onSelect ||= () => undefined;
    onCancel ||= () => undefined;

    const characterSelector = await this.buildCharacterSelector(characters);

    let selected = false;
    await foundry.applications.api.DialogV2.wait({
      classes: ['yzegs'],
      window: { title },
      content: this.buildDivHtmlDialog(characterSelector),
      buttons: [{
        action: 'cancel',
        icon: 'fas fa-times',
        label: 'Cancel',
        default: true,
      }],
      rejectClose: false,
      render: (_event, dialog) => {
        $(dialog.element).find('.party-member').click(event => {
          selected = true;
          onSelect($(event.currentTarget).data('entity-id'));
          dialog.close();
        });
      },
    });
    if (!selected) onCancel();
  }

  /**
   * @param  {Array} characters Array with character IDs
   */
  static async buildCharacterSelector(characters) {
    let html = '';
    let actor;
    for (let i = 0; i < characters.length; i++) {
      actor = characters[i] instanceof Actor ? characters[i] : game.actors.get(characters[i]);
      html += await foundry.applications.handlebars.renderTemplate('systems/fvtt-yze-generic-stepped/templates/actor/party/components/member-component.hbs', {
        partyMember: actor,
        noCharSheetLink: true,
      });
    }
    return `<ol>${html}</ol>`;
  }

  /**
   * @param  {string} divContent
   */
  static buildDivHtmlDialog(divContent) {
    return '<div class=\'flex row roll-dialog\'>' + divContent + '</div>';
  }
}

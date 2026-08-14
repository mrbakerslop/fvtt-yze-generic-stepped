export class InfoDialog {
  /**
   * Display informational message.
   *
   * @param  {string}   title
   * @param  {string}   message
   * @param  {Function} onClose
   */
  static async show(title, message, onClose = () => undefined) {
    await foundry.applications.api.DialogV2.prompt({
      classes: ['yzegs'],
      window: { title },
      content: this.buildDivHtmlDialog(message),
      ok: {
        icon: 'fas fa-check',
        label: 'OK',
      },
      rejectClose: false,
    });
    onClose();
  }

  /**
   * @param  {string} divContent
   */
  static buildDivHtmlDialog(divContent) {
    return '<div class=\'flex row roll-dialog\'>' + divContent + '</div>';
  }
}

const template = templateName => (
  `systems/fvtt-yze-generic-stepped/templates/components/chat/${templateName}-chat.hbs`
);

/** Chat-card template coverage for every Item data model exposed by the system manifest. */
export const ITEM_CHAT_TEMPLATES = Object.freeze({
  weapon: template('weapon'),
  grenade: template('weapon'),
  armor: template('armor'),
  gear: template('gear'),
  ammunition: template('gear'),
  skill: template('gear'),
  specialty: template('gear'),
  injury: template('gear'),
  disease: template('gear'),
  archetype: template('gear'),
});

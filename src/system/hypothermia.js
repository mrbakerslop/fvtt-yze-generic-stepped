/** Keep the mechanical condition and the token status in agreement, including recovery. */
export async function setHypothermia(actor, active) {
  if (!['character', 'npc'].includes(actor?.type)) return;
  active = Boolean(active);
  if (Boolean(actor.system.conditions?.hypothermic) !== active) {
    await actor.update({ 'system.conditions.hypothermic': active }, { yzegsHypothermiaSync: true });
  }
  if (Boolean(actor.statuses?.has('hypothermia')) !== active) {
    await actor.toggleStatusEffect('hypothermia', { active });
  }
}

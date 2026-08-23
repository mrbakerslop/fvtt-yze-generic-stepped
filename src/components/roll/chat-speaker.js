/**
 * Build stable ChatMessage speaker data from the document references preserved
 * on a roll. This avoids Foundry falling back to whichever token happens to be
 * controlled when a staged roll is finally sent to chat.
 */
export function getRollSpeakerData(options = {}) {
  const actor = String(options.actorId ?? '').trim();
  const scene = String(options.sceneId ?? '').trim();
  const token = String(options.tokenId ?? '').trim();
  const alias = String(options.actorName ?? '').trim();
  if (!actor && !scene && !token && !alias) return null;

  return {
    ...(scene ? { scene } : {}),
    ...(actor ? { actor } : {}),
    ...(token ? { token } : {}),
    ...(alias ? { alias } : {}),
  };
}

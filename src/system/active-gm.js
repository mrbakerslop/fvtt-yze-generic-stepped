/** Elect the same active GM on every client, independently of who triggered a hook. */
export function getPrimaryActiveGM() {
  return game.users.filter(user => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
}

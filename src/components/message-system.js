/* -------------------------------------------- */
/*  Author: @aMediocreDad                       */
/* -------------------------------------------- */
import semverComp from '@utils/semver-compare';

const SYSTEM_NAME = 'fvtt-yze-generic-stepped';

export default async function displayMessages() {
  let messages;
  try {
    const response = await fetch(`systems/${SYSTEM_NAME}/assets/messages/messages.jsonc`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    messages = JSON.parse(stripJSON(await response.text()));
  }
  catch (error) {
    console.warn(`${SYSTEM_NAME} | Unable to load system messages.`, error);
    return;
  }

  messages.forEach(message => {
    handleDisplay(message);
  });
}

const stripJSON = data => {
  return data.replace(/[^:]\/\/(.*)/g, '');
};

const handleDisplay = msg => {
  const { content, title, type } = msg;
  if (!isCurrent(msg)) return;
  if (type === 'prompt') return displayPrompt(title, content);
  if (type === 'chat') return sendToChat(title, content);
};

const isCurrent = msg => {
  const isDisplayable = msg.display !== 'once' || !hasDisplayed(msg.title);
  const correctCoreVersion =
    foundry.utils.isNewerVersion(msg['max-core-version'] ?? '100.0.0', game.version) &&
    foundry.utils.isNewerVersion(game.version, msg['min-core-version'] ?? '0.0.0');
  const correctSysVersion = semverComp(
    msg['min-sys-version'] ?? '0.0.0',
    game.system.version,
    msg['max-sys-version'] ?? '100.0.0',
    { gEqMin: true },
  );
  return isDisplayable && correctCoreVersion && correctSysVersion;
};

const hasDisplayed = identifier => {
  const settings = game.settings.get(SYSTEM_NAME, 'messages');
  if (settings?.includes(identifier)) return true;
  else return false;
};

const displayPrompt = (title, content) => {
  content = content.replace('{name}', game.user.name);
  return foundry.applications.api.DialogV2.prompt({
    classes: [SYSTEM_NAME, 'yzegs'],
    window: { title },
    content,
    ok: {
      label: 'Understood!',
      callback: () => setDisplayed(title),
    },
    position: { width: 400 },
  });
};

const sendToChat = (title, content) => {
  content = content.replace('{name}', game.user.name);
  setDisplayed(title);
  const footer = `<footer class="nue">${game.i18n.localize('NUE.FirstLaunchHint')}</footer>`;
  return ChatMessage.create({
    whisper: [game.user.id],
    speaker: { alias: 'Year Zero Engine - Generic Stepped Dice' },
    flags: { core: { canPopout: true } },
    title: title,
    content: `<div class="chat-card"><h3 class="nue">${title}</h3>${content}${footer}</div>`,
  });
};

const setDisplayed = async identifier => {
  const settings = [...game.settings.get(SYSTEM_NAME, 'messages')];
  settings.push(identifier);
  await game.settings.set(SYSTEM_NAME, 'messages', [...new Set(settings.flat())]);
};

import YZEGSDialog from '../components/dialog/dialog.js';
import { YZEGSRoller } from '../components/roll/dice.js';
import {
  closeQuartersCombatEnabled,
  getBlastDamageProfile,
  increaseIndoorBlast,
} from './urban-operations.js';
import { isConfinedSpaceScene } from './confined-space.js';

/** Resolve one separate, unpushable blast roll for every selected target. */
export async function resolveBlastTargets(sourceRoll, tokens) {
  const attack = sourceRoll?.options?.attackData;
  if (!attack || !getBlastDamageProfile(attack.blast)) return false;
  const confined = Boolean(attack.confinedSpace || isConfinedSpaceScene());
  const indoor = closeQuartersCombatEnabled() || confined;
  const choice = await YZEGSDialog.chooseBlastResolution({
    blast: indoor ? increaseIndoorBlast(attack.blast) : attack.blast,
    indoor,
    airburst: Boolean(attack.airburst),
    directional: Boolean(attack.directional),
  });
  if (choice.cancelled) return false;
  const profile = getBlastDamageProfile(choice.blast);
  if (!profile) return false;

  const unique = new Map([...tokens].filter(token => token?.actor?.uuid)
    .map(token => [token.actor.uuid, token]));
  for (const token of unique.values()) {
    const target = token.actor;
    const title = game.i18n.format('YZEGS.Urban.Blast.RollTitle', { target: target.name, blast: profile.rating });
    await YZEGSRoller.taskCheck({
      title,
      actor: target,
      attribute: profile.die,
      skill: profile.die,
      maxPush: 0,
      locate: true,
      hideCombatActions: true,
      skipDialog: true,
      attackData: {
        damage: profile.damage,
        crit: profile.crit,
        armorModifier: profile.armorModifier,
        blast: profile.rating,
        blastResolution: true,
        contained: Boolean(choice.contained),
        airburst: Boolean(attack.airburst),
        directional: Boolean(attack.directional),
        confinedSpace: confined,
        primaryTargetUuid: target.uuid,
        sourceActorUuid: sourceRoll.options.actorUuid ?? '',
      },
      suppression: {
        force: true,
        blast: true,
        complete: false,
        targets: [{
          actorUuid: target.uuid,
          tokenUuid: token.document?.uuid ?? token.uuid ?? '',
          name: target.name,
          cause: 'blast',
          sourceName: sourceRoll.name ?? '',
          status: target.type === 'vehicle' ? 'immune' : 'pending',
          vehicleName: target.type === 'vehicle' ? target.name : '',
        }],
      },
    });
  }
  return true;
}

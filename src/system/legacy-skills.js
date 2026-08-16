export const LEGACY_SKILLS = Object.freeze({
  heavyWeapons: { id: 'skillHeavyWeapon', attribute: 'str', label: 'YZEGS.SkillNames.heavyWeapons' },
  closeCombat: { id: 'skillCloseCombat', attribute: 'str', label: 'YZEGS.SkillNames.closeCombat' },
  stamina: { id: 'skillStamina0000', attribute: 'str', label: 'YZEGS.SkillNames.stamina' },
  driving: { id: 'skillDriving0000', attribute: 'agl', label: 'YZEGS.SkillNames.driving' },
  mobility: { id: 'skillMobility000', attribute: 'agl', label: 'YZEGS.SkillNames.mobility' },
  rangedCombat: { id: 'skillRangeCombat', attribute: 'agl', label: 'YZEGS.SkillNames.rangedCombat' },
  recon: { id: 'skillRecon000000', attribute: 'int', label: 'YZEGS.SkillNames.recon' },
  survival: { id: 'skillSurvival000', attribute: 'int', label: 'YZEGS.SkillNames.survival' },
  tech: { id: 'skillTech0000000', attribute: 'int', label: 'YZEGS.SkillNames.tech' },
  command: { id: 'skillCommand0000', attribute: 'emp', label: 'YZEGS.SkillNames.command' },
  persuasion: { id: 'skillPersuasion0', attribute: 'emp', label: 'YZEGS.SkillNames.persuasion' },
  medicalAid: { id: 'skillMedicalAid0', attribute: 'emp', label: 'YZEGS.SkillNames.medicalAid' },
});

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

/** Resolve the canonical Twilight: 2000 key represented by a migrated Skill Item. */
export function getLegacySkillKey(skill) {
  if (!skill || skill.type !== 'skill') return '';
  const flaggedKey = skill.getFlag?.(SYSTEM_ID, 'legacySkillKey');
  if (Object.hasOwn(LEGACY_SKILLS, flaggedKey)) return flaggedKey;
  return Object.entries(LEGACY_SKILLS).find(([, definition]) => definition.id === skill.id)?.[0] ?? '';
}

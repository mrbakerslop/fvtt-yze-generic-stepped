export const SOCIAL_CONFLICT_SETTING = 'socialConflict';

export const DEFAULT_SOCIAL_CONFLICT_CONFIG = Object.freeze({
  pcInfluenceMode: 'playerChoice',
  resistanceVisibility: 'public',
  barterPercentPerSuccess: 10,
});

export const NEGOTIATING_FACTORS = Object.freeze([
  { id: 'activeMorePeople', value: 1, label: 'YZEGS.Social.Factors.ActiveMorePeople', exclusiveGroup: 'numbers' },
  { id: 'targetMorePeople', value: -1, label: 'YZEGS.Social.Factors.TargetMorePeople', exclusiveGroup: 'numbers' },
  { id: 'costsNothing', value: 1, label: 'YZEGS.Social.Factors.CostsNothing' },
  { id: 'valuableOrDangerous', value: -1, label: 'YZEGS.Social.Factors.ValuableOrDangerous' },
  { id: 'targetGainsNothing', value: -1, label: 'YZEGS.Social.Factors.TargetGainsNothing' },
  { id: 'targetDamagedOrStressed', value: 1, label: 'YZEGS.Social.Factors.TargetDamagedOrStressed' },
  { id: 'targetSick', value: 1, label: 'YZEGS.Social.Factors.TargetSick' },
  { id: 'targetCaptive', value: 1, label: 'YZEGS.Social.Factors.TargetCaptive' },
  { id: 'activeCaptive', value: -1, label: 'YZEGS.Social.Factors.ActiveCaptive' },
  { id: 'helpedPreviously', value: 1, label: 'YZEGS.Social.Factors.HelpedPreviously' },
  { id: 'wellPresented', value: 1, label: 'YZEGS.Social.Factors.WellPresented' },
  { id: 'activeOutranks', value: 1, label: 'YZEGS.Social.Factors.ActiveOutranks', exclusiveGroup: 'rank' },
  { id: 'targetOutranks', value: -1, label: 'YZEGS.Social.Factors.TargetOutranks', exclusiveGroup: 'rank' },
  { id: 'languageTrouble', value: -1, label: 'YZEGS.Social.Factors.LanguageTrouble' },
  { id: 'notNearby', value: -1, label: 'YZEGS.Social.Factors.NotNearby' },
]);

export function normalizeSocialConflictConfig(config = {}) {
  const merged = { ...DEFAULT_SOCIAL_CONFLICT_CONFIG, ...config };
  return {
    pcInfluenceMode: ['playerChoice', 'opposed'].includes(merged.pcInfluenceMode)
      ? merged.pcInfluenceMode : DEFAULT_SOCIAL_CONFLICT_CONFIG.pcInfluenceMode,
    resistanceVisibility: ['public', 'gm'].includes(merged.resistanceVisibility)
      ? merged.resistanceVisibility : DEFAULT_SOCIAL_CONFLICT_CONFIG.resistanceVisibility,
    barterPercentPerSuccess: Math.min(100, Math.max(1, Number(merged.barterPercentPerSuccess) || 10)),
  };
}

export function getSocialConflictConfig() {
  return normalizeSocialConflictConfig(
    game.settings.get('fvtt-yze-generic-stepped', SOCIAL_CONFLICT_SETTING),
  );
}

export function calculateNegotiatingModifier(selected = [], customModifier = 0) {
  const selectedIds = new Set(selected);
  const factors = NEGOTIATING_FACTORS.filter(factor => selectedIds.has(factor.id));
  const usedGroups = new Set();
  const factorModifier = factors.reduce((total, factor) => {
    if (factor.exclusiveGroup && usedGroups.has(factor.exclusiveGroup)) return total;
    if (factor.exclusiveGroup) usedGroups.add(factor.exclusiveGroup);
    return total + factor.value;
  }, 0);
  return factorModifier + (Number(customModifier) || 0);
}

export function calculateBarterPrice({
  price = 0, netSuccesses = 0, direction = 'buy', percentPerSuccess = 10,
} = {}) {
  const base = Math.max(0, Number(price) || 0);
  const successes = Math.max(0, Number(netSuccesses) || 0);
  const percentage = Math.max(0, Number(percentPerSuccess) || 0) / 100;
  const multiplier = direction === 'sell'
    ? 1 + (successes * percentage)
    : Math.max(0, 1 - (successes * percentage));
  return Math.round(base * multiplier * 100) / 100;
}

export function usesPlayerChoice({ targetType = '', mode = '', pcInfluenceMode = 'playerChoice' } = {}) {
  return targetType === 'character' && mode !== 'interrogate' && pcInfluenceMode === 'playerChoice';
}

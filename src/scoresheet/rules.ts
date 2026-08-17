import type { RuleSet } from './model'

/**
 * Rule sets are data, not code paths: a federation that plays best-of-3 or allows
 * a serving libero gets an entry here instead of a branch in the engine.
 */
export const RULE_SETS: RuleSet[] = [
  {
    id: 'fivb-best-of-5',
    nameKey: 'rules.fivb-best-of-5',
    setsToWin: 3,
    pointsPerSet: 25,
    pointsDecidingSet: 15,
    minLead: 2,
    substitutionsPerSet: 6,
    timeoutsPerSet: 2,
    maxPlayers: 14,
    liberoMayServe: false,
  },
  {
    id: 'fivb-best-of-3',
    nameKey: 'rules.fivb-best-of-3',
    setsToWin: 2,
    pointsPerSet: 25,
    pointsDecidingSet: 15,
    minLead: 2,
    substitutionsPerSet: 6,
    timeoutsPerSet: 2,
    maxPlayers: 14,
    liberoMayServe: false,
  },
  {
    id: 'ncaa-best-of-5',
    nameKey: 'rules.ncaa-best-of-5',
    setsToWin: 3,
    pointsPerSet: 25,
    pointsDecidingSet: 15,
    minLead: 2,
    substitutionsPerSet: 15,
    timeoutsPerSet: 2,
    maxPlayers: 15,
    liberoMayServe: true,
  },
]

export const DEFAULT_RULE_SET = RULE_SETS[0] as RuleSet

export function ruleSetById(id: string): RuleSet {
  return RULE_SETS.find((rules) => rules.id === id) ?? DEFAULT_RULE_SET
}

/** Adapts the default rule set to the sets-to-win a federation reports for a match. */
export function ruleSetForSetsToWin(setsToWin: number | undefined): RuleSet {
  if (setsToWin === undefined) return DEFAULT_RULE_SET
  const match = RULE_SETS.find((rules) => rules.setsToWin === setsToWin)
  if (match) return match
  return {
    ...DEFAULT_RULE_SET,
    id: `custom-${setsToWin}`,
    nameKey: 'rules.bestOf',
    setsToWin,
  }
}

export function ruleSetName(
  rules: RuleSet,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return t(rules.nameKey, { count: rules.setsToWin * 2 - 1 })
}

/** Total sets a match can run to. */
export function maxSets(rules: RuleSet): number {
  return rules.setsToWin * 2 - 1
}

export function isDecidingSet(rules: RuleSet, setNumber: number): boolean {
  return setNumber === maxSets(rules)
}

export function targetPoints(rules: RuleSet, setNumber: number): number {
  return isDecidingSet(rules, setNumber) ? rules.pointsDecidingSet : rules.pointsPerSet
}

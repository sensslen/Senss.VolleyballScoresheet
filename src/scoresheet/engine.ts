import {
  otherSide,
  TEAM_SIDES,
  type Scoresheet,
  type SetRecord,
  type SheetPlayer,
  type Substitution,
  type TeamSide,
} from './model'
import { isDecidingSet, maxSets, targetPoints } from './rules'

export interface ServerInfo {
  /** Starting-lineup slot 0..5, i.e. positions I..VI. */
  slot: number
  playerId: string | null
  number: number | null
}

export interface ServiceRound {
  server: ServerInfo
  /** Own running-score values reached while this player served. */
  pointsScored: number[]
  scoreAtStart: { own: number; opponent: number }
}

export interface SetState {
  setNumber: number
  target: number
  isDeciding: boolean
  score: Record<TeamSide, number>
  /** Score after every rally, in order. Mirrors the running-score grid. */
  progression: Array<{ A: number; B: number; winner: TeamSide }>
  /** Side to serve the next rally; null once the set is over or before the toss. */
  servingSide: TeamSide | null
  nextServer: Record<TeamSide, ServerInfo | null>
  serviceRounds: Record<TeamSide, ServiceRound[]>
  /** Current occupants of positions I..VI. */
  courtSlots: Record<TeamSide, Array<string | null>>
  timeoutsUsed: Record<TeamSide, number>
  substitutionsUsed: Record<TeamSide, number>
  isComplete: boolean
  winner: TeamSide | null
  /** Things a scorer should look at; never blocks entry. */
  issues: string[]
}

export interface MatchState {
  setsWon: Record<TeamSide, number>
  setResults: Array<{ set: number; A: number; B: number; winner: TeamSide | null }>
  isComplete: boolean
  winner: TeamSide | null
  /** 1-based number of the set currently being played, or null when the match is over. */
  currentSetNumber: number | null
}

function emptySides<T>(value: () => T): Record<TeamSide, T> {
  return { A: value(), B: value() }
}

/**
 * The starting lineup doubles as the serving order: a team's n-th service turn is
 * taken by whoever occupies the n-th slot of its lineup. The team that receives
 * first rotates before its first service, so its order starts one slot later.
 */
function slotForServiceTurn(turnIndex: number, servesFirstInSet: boolean): number {
  const offset = servesFirstInSet ? 0 : 1
  return (turnIndex + offset) % 6
}

function playerNumber(players: SheetPlayer[], playerId: string | null): number | null {
  if (!playerId) return null
  return players.find((player) => player.id === playerId)?.number ?? null
}

/** Applies every substitution recorded up to (and including) a rally index. */
function slotsAtRally(record: SetRecord, side: TeamSide, rallyIndex: number): Array<string | null> {
  const slots = [...(record.lineups[side].slots ?? [])]
  while (slots.length < 6) slots.push(null)
  const substitutions = [...record.substitutions[side]].sort((a, b) => a.atRally - b.atRally)
  for (const substitution of substitutions) {
    if (substitution.atRally > rallyIndex) break
    if (substitution.slot >= 0 && substitution.slot < 6) slots[substitution.slot] = substitution.inPlayerId
  }
  return slots
}

export function isSetComplete(
  score: Record<TeamSide, number>,
  target: number,
  minLead: number,
): { complete: boolean; winner: TeamSide | null } {
  for (const side of TEAM_SIDES) {
    const own = score[side]
    const opponent = score[otherSide(side)]
    if (own >= target && own - opponent >= minLead) return { complete: true, winner: side }
  }
  return { complete: false, winner: null }
}

export function computeSetState(sheet: Scoresheet, setIndex: number): SetState {
  const record = sheet.sets[setIndex]
  const setNumber = setIndex + 1
  const target = targetPoints(sheet.rules, setNumber)
  const issues: string[] = []

  const state: SetState = {
    setNumber,
    target,
    isDeciding: isDecidingSet(sheet.rules, setNumber),
    score: { A: 0, B: 0 },
    progression: [],
    servingSide: null,
    nextServer: { A: null, B: null },
    serviceRounds: emptySides<ServiceRound[]>(() => []),
    courtSlots: emptySides<Array<string | null>>(() => [null, null, null, null, null, null]),
    timeoutsUsed: { A: 0, B: 0 },
    substitutionsUsed: { A: 0, B: 0 },
    isComplete: false,
    winner: null,
    issues,
  }

  if (!record) return state

  const firstServe = record.firstServe
  for (const side of TEAM_SIDES) {
    state.substitutionsUsed[side] = record.substitutions[side].length
    state.timeoutsUsed[side] = record.timeouts.filter((timeout) => timeout.team === side).length
    if (state.substitutionsUsed[side] > sheet.rules.substitutionsPerSet) {
      issues.push(`Team ${side} has more substitutions than the ${sheet.rules.substitutionsPerSet} the rules allow.`)
    }
    if (state.timeoutsUsed[side] > sheet.rules.timeoutsPerSet) {
      issues.push(`Team ${side} has more time-outs than the ${sheet.rules.timeoutsPerSet} the rules allow.`)
    }
    const filled = record.lineups[side].slots.filter(Boolean).length
    if (filled > 0 && filled < 6) {
      issues.push(`Team ${side} has only ${filled} of 6 starting positions filled for set ${setNumber}.`)
    }
  }

  if (!firstServe) {
    issues.push(`Set ${setNumber} has no first service recorded yet.`)
    return state
  }

  // Rally-by-rally replay. serviceTurns counts how often each side has gained service.
  const serviceTurns: Record<TeamSide, number> = { A: 0, B: 0 }
  let serving: TeamSide = firstServe
  serviceTurns[serving] = 1
  let currentRound = openRound(sheet, record, serving, serviceTurns[serving] - 1, firstServe, 0, state.score)
  state.serviceRounds[serving].push(currentRound)

  for (let rallyIndex = 0; rallyIndex < record.rallies.length; rallyIndex += 1) {
    const rally = record.rallies[rallyIndex]
    if (!rally) continue
    const winner = rally.winner
    state.score[winner] += 1
    state.progression.push({ A: state.score.A, B: state.score.B, winner })

    if (winner === serving) {
      // Points won on own service are struck inside the current service round.
      currentRound.pointsScored.push(state.score[winner])
    } else {
      // A side-out point is scored on the opponent's service; it opens a new round.
      serving = winner
      serviceTurns[serving] += 1
      currentRound = openRound(
        sheet,
        record,
        serving,
        serviceTurns[serving] - 1,
        firstServe,
        rallyIndex + 1,
        state.score,
      )
      state.serviceRounds[serving].push(currentRound)
    }

    const completion = isSetComplete(state.score, target, sheet.rules.minLead)
    if (completion.complete) {
      state.isComplete = true
      state.winner = completion.winner
      break
    }
  }

  // The winner's last point closes the set; a round opened by it would be empty.
  for (const side of TEAM_SIDES) {
    const rounds = state.serviceRounds[side]
    const last = rounds[rounds.length - 1]
    if (state.isComplete && last && last.pointsScored.length === 0) rounds.pop()
  }

  const lastRally = record.rallies.length - 1
  for (const side of TEAM_SIDES) {
    state.courtSlots[side] = slotsAtRally(record, side, lastRally)
  }

  if (!state.isComplete) {
    state.servingSide = serving
    for (const side of TEAM_SIDES) {
      const slot = slotForServiceTurn(Math.max(serviceTurns[side] - 1, 0), side === firstServe)
      const slots = state.courtSlots[side]
      const playerId = slots[slot] ?? null
      state.nextServer[side] = { slot, playerId, number: playerNumber(sheet.teams[side].players, playerId) }
    }

    const server = state.nextServer[serving]
    const servingPlayer = sheet.teams[serving].players.find((player) => player.id === server?.playerId)
    if (servingPlayer?.isLibero && !sheet.rules.liberoMayServe) {
      issues.push(`Team ${serving} has a libero in the service position, which these rules do not allow.`)
    }
  }

  return state
}

function openRound(
  sheet: Scoresheet,
  record: SetRecord,
  side: TeamSide,
  turnIndex: number,
  firstServe: TeamSide,
  rallyIndex: number,
  score: Record<TeamSide, number>,
): ServiceRound {
  const slot = slotForServiceTurn(turnIndex, side === firstServe)
  const slots = slotsAtRally(record, side, rallyIndex - 1)
  const playerId = slots[slot] ?? null
  return {
    server: { slot, playerId, number: playerNumber(sheet.teams[side].players, playerId) },
    pointsScored: [],
    scoreAtStart: { own: score[side], opponent: score[otherSide(side)] },
  }
}

export function computeMatchState(sheet: Scoresheet): MatchState {
  const setsWon: Record<TeamSide, number> = { A: 0, B: 0 }
  const setResults: MatchState['setResults'] = []
  let currentSetNumber: number | null = null

  for (let index = 0; index < sheet.sets.length; index += 1) {
    const state = computeSetState(sheet, index)
    setResults.push({ set: state.setNumber, A: state.score.A, B: state.score.B, winner: state.winner })
    if (state.winner) setsWon[state.winner] += 1
    else if (currentSetNumber === null) currentSetNumber = state.setNumber
  }

  const isComplete = setsWon.A >= sheet.rules.setsToWin || setsWon.B >= sheet.rules.setsToWin
  const winner = setsWon.A >= sheet.rules.setsToWin ? 'A' : setsWon.B >= sheet.rules.setsToWin ? 'B' : null

  if (isComplete) currentSetNumber = null
  else if (currentSetNumber === null) {
    const next = sheet.sets.length + 1
    currentSetNumber = next <= maxSets(sheet.rules) ? next : null
  }

  return { setsWon, setResults, isComplete, winner, currentSetNumber }
}

/**
 * FIVB substitution legality: a starter may leave and come back once, only for the
 * player who replaced them; a substitute enters once per set and may only be
 * replaced by the starter they came in for.
 */
export function validateSubstitution(
  sheet: Scoresheet,
  setIndex: number,
  side: TeamSide,
  slot: number,
  inPlayerId: string,
): string | null {
  const record = sheet.sets[setIndex]
  if (!record) return 'That set does not exist.'
  const state = computeSetState(sheet, setIndex)
  if (state.isComplete) return 'The set is already finished.'

  const outPlayerId = state.courtSlots[side][slot] ?? null
  if (!outPlayerId) return 'That position has no player on court yet.'
  if (outPlayerId === inPlayerId) return 'That player is already on court in this position.'

  const onCourt = state.courtSlots[side]
  if (onCourt.includes(inPlayerId)) return 'That player is already on court.'

  if (state.substitutionsUsed[side] >= sheet.rules.substitutionsPerSet) {
    return `Team ${side} has already used all ${sheet.rules.substitutionsPerSet} substitutions in this set.`
  }

  const incoming = sheet.teams[side].players.find((player) => player.id === inPlayerId)
  if (!incoming) return 'Unknown player.'
  if (incoming.isLibero) return 'Libero replacements are not substitutions and are not recorded here.'

  const history = record.substitutions[side]
  const starterIds = new Set(record.lineups[side].slots.filter((id): id is string => Boolean(id)))

  if (starterIds.has(inPlayerId)) {
    // A starter coming back: only into the pairing they left, and only once.
    const leftAs = history.find((entry) => entry.outPlayerId === inPlayerId)
    if (!leftAs) return 'That starter has not left the court, so there is nothing to re-enter.'
    const alreadyBack = history.some((entry) => entry.inPlayerId === inPlayerId)
    if (alreadyBack) return 'A starter may only re-enter once per set.'
    if (leftAs.inPlayerId !== outPlayerId) {
      return 'A starter may only re-enter for the player who replaced them.'
    }
    return null
  }

  const enteredBefore = history.some((entry) => entry.inPlayerId === inPlayerId)
  if (enteredBefore) return 'A substitute may only enter once per set.'
  return null
}

export function applySubstitution(
  sheet: Scoresheet,
  setIndex: number,
  side: TeamSide,
  slot: number,
  inPlayerId: string,
): Substitution | null {
  const record = sheet.sets[setIndex]
  if (!record) return null
  const state = computeSetState(sheet, setIndex)
  const outPlayerId = state.courtSlots[side][slot] ?? null
  if (!outPlayerId) return null
  return {
    slot,
    outPlayerId,
    inPlayerId,
    atRally: record.rallies.length - 1,
    scoreA: state.score.A,
    scoreB: state.score.B,
  }
}

/** Why rally entry is not possible yet, or null when it is. */
export function rallyEntryBlocker(sheet: Scoresheet, setIndex: number): string | null {
  const record = sheet.sets[setIndex]
  if (!record) return 'This set has not been started.'
  if (!record.firstServe) return 'Record which team serves first in this set.'
  for (const side of TEAM_SIDES) {
    const filled = record.lineups[side].slots.filter(Boolean).length
    if (filled < 6) return `Team ${side} needs all six starting positions before the first rally.`
  }
  const state = computeSetState(sheet, setIndex)
  if (state.isComplete) return 'This set is finished.'
  return null
}

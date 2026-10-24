import { otherSide, TEAM_SIDES, type Scoresheet, type TeamSide } from './model'
import type { SetState } from './engine'
import type { LocalizedMessage } from '../localizedMessage'

export function paperSide(sheet: Scoresheet, side: TeamSide): TeamSide {
  return sheet.toss.leftSide === 'B' ? otherSide(side) : side
}

export function paperParams(sheet: Scoresheet, params: LocalizedMessage['params']) {
  return params?.side === 'A' || params?.side === 'B'
    ? { ...params, side: paperSide(sheet, params.side) }
    : params
}

export function paperScoresheet(source: Scoresheet): Scoresheet {
  if (source.toss.leftSide !== 'B') return source
  const sheet = structuredClone(source)
  sheet.teams = { A: sheet.teams.B, B: sheet.teams.A }
  if (sheet.toss.leftSide) sheet.toss.leftSide = otherSide(sheet.toss.leftSide)
  if (sheet.toss.firstServe) sheet.toss.firstServe = otherSide(sheet.toss.firstServe)
  for (const set of sheet.sets) {
    set.lineups = { A: set.lineups.B, B: set.lineups.A }
    set.substitutions = { A: set.substitutions.B, B: set.substitutions.A }
    if (set.firstServe) set.firstServe = otherSide(set.firstServe)
    if (set.leftSide) set.leftSide = otherSide(set.leftSide)
    for (const rally of set.rallies) rally.winner = otherSide(rally.winner)
    for (const entry of [...set.timeouts, ...set.substitutions.A, ...set.substitutions.B]) {
      ;[entry.scoreA, entry.scoreB] = [entry.scoreB, entry.scoreA]
    }
    for (const timeout of set.timeouts) timeout.team = otherSide(timeout.team)
  }
  for (const sanction of sheet.sanctions) {
    sanction.team = otherSide(sanction.team)
    ;[sanction.scoreA, sanction.scoreB] = [sanction.scoreB, sanction.scoreA]
  }
  return sheet
}

export function localSetTime(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function paperLicence(value: string, isDate: boolean): string {
  const date = isDate && value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/)
  return date ? `${date[3]}.${date[2]}.${date[1]!.slice(-2)}` : value
}

export function serviceEntries(state: SetState, side: TeamSide, through = state.progression.length) {
  const allRounds = TEAM_SIDES.flatMap((team) => state.serviceRounds[team])
  const offset = state.serviceRounds[side][0]?.server.slot ?? 1
  const entries = state.serviceRounds[side].flatMap((round, index) => {
    const start = round.scoreAtStart.own + round.scoreAtStart.opponent
    if (start >= through) return []
    const next = Math.min(...allRounds
      .map((candidate) => candidate.scoreAtStart.own + candidate.scoreAtStart.opponent)
      .filter((at) => at > start))
    const end = Math.min(next, through)
    const closed = next <= through || state.isComplete && through === state.progression.length
    return [{
      slot: round.server.slot,
      row: Math.floor((index + offset) / 6),
      score: state.progression[end - 1]?.[side] ?? round.scoreAtStart.own,
      closed,
    }]
  })
  if (state.isComplete && through === state.progression.length && state.winner === side && state.progression.at(-2)?.winner === otherSide(side)) {
    const turn = state.serviceRounds[side].length + offset
    entries.push({ slot: turn % 6, row: Math.floor(turn / 6), score: state.score[side], closed: true })
  }
  return entries
}

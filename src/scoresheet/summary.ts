import { computeMatchState, computeSetState } from './engine'
import type { Scoresheet } from './model'

export type Label = (key: string, params?: Record<string, string | number>) => string

/**
 * The result in the shape a federation's result form asks for: identity of the
 * match, the set scores in order, and the totals. Plain text so it can be pasted
 * or read out over the phone.
 */
export function resultSummary(sheet: Scoresheet, t: Label): string {
  const match = computeMatchState(sheet)
  const teamA = sheet.teams.A.name || t('sheet.row.teamA')
  const teamB = sheet.teams.B.name || t('sheet.row.teamB')

  const setScores = sheet.sets
    .map((record, index) => {
      const state = computeSetState(sheet, index)
      const duration = record.durationMinutes === null ? '' : ` (${record.durationMinutes}')`
      return `${t('common.set')} ${record.number}: ${state.score.A}:${state.score.B}${duration}`
    })
    .join('\n')

  const totalA = match.setResults.reduce((sum, set) => sum + set.A, 0)
  const totalB = match.setResults.reduce((sum, set) => sum + set.B, 0)

  const lines = [
    `${t('sheet.row.matchNumber')}: ${sheet.header.matchNumber || t('common.blank')}`,
    `${t('sheet.row.date')}: ${sheet.header.date}${sheet.header.time ? ` ${sheet.header.time}` : ''}`,
    `${t('sheet.row.competition')}: ${sheet.header.competition || t('common.blank')}`,
    `${teamA} ${t('common.vs')} ${teamB}`,
    '',
    setScores,
    '',
    `${t('sheet.row.setsWon')}: ${match.setsWon.A}:${match.setsWon.B}`,
    `${t('sheet.row.totalPoints')}: ${totalA}:${totalB}`,
    `${t('sheet.row.matchWinner')}: ${
      match.winner ? (match.winner === 'A' ? teamA : teamB) : t('common.notDecided')
    }`,
  ]

  return lines.join('\n').trim()
}

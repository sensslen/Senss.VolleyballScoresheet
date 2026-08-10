import type { GameDetail, GameSummary, ImportedPlayer, Roster } from '../federation/types'
import {
  type RuleSet,
  type Scoresheet,
  type SetRecord,
  type SheetPlayer,
  type SheetTeam,
  type TeamSide,
} from './model'
import { DEFAULT_RULE_SET, ruleSetForSetsToWin } from './rules'

let counter = 0

export function localId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

export function emptyPlayer(): SheetPlayer {
  return {
    id: localId('p'),
    number: null,
    firstName: '',
    lastName: '',
    licence: '',
    isCaptain: false,
    isLibero: false,
    position: '',
  }
}

function emptyTeam(name = ''): SheetTeam {
  return {
    name,
    clubName: '',
    players: [],
    staff: { coach: '', assistantCoach: '', physiotherapist: '', doctor: '' },
  }
}

export function emptySet(setNumber: number): SetRecord {
  return {
    number: setNumber,
    lineups: {
      A: { slots: [null, null, null, null, null, null], liberoIds: [] },
      B: { slots: [null, null, null, null, null, null], liberoIds: [] },
    },
    firstServe: null,
    rallies: [],
    substitutions: { A: [], B: [] },
    timeouts: [],
    durationMinutes: null,
    startTime: '',
    endTime: '',
  }
}

export function createScoresheet(rules: RuleSet = DEFAULT_RULE_SET): Scoresheet {
  const now = new Date().toISOString()
  return {
    id: localId('sheet'),
    version: 1,
    createdAt: now,
    updatedAt: now,
    header: {
      competition: '',
      stage: '',
      pool: '',
      matchNumber: '',
      date: now.slice(0, 10),
      time: '',
      city: '',
      hall: '',
      category: '',
    },
    officials: { firstReferee: '', secondReferee: '', scorer: '', assistantScorer: '', lineJudges: '' },
    rules,
    teams: { A: emptyTeam(), B: emptyTeam() },
    toss: { firstServe: null, leftSide: null },
    sets: [emptySet(1)],
    sanctions: [],
    remarks: '',
  }
}

/** Splits "2026-08-10 20:30:00" into the sheet's date and time fields. */
function splitPlayDate(playDate: string | undefined): { date: string; time: string } {
  if (!playDate) return { date: '', time: '' }
  const normalised = playDate.replace('T', ' ')
  const [date = '', rest = ''] = normalised.split(' ')
  return { date, time: rest.slice(0, 5) }
}

export function toSheetPlayer(player: ImportedPlayer): SheetPlayer {
  return {
    id: localId('p'),
    number: player.number ?? null,
    firstName: player.firstName,
    lastName: player.lastName,
    licence: player.licence ?? '',
    isCaptain: player.isCaptain ?? false,
    isLibero: (player.position ?? '').toLowerCase().includes('libero'),
    position: player.position ?? '',
  }
}

/** Team A is the home team, matching how federations publish a fixture. */
export function scoresheetFromGame(game: GameSummary | GameDetail, providerId: string): Scoresheet {
  const detail = 'officials' in game ? (game as GameDetail) : undefined
  const rules = ruleSetForSetsToWin(detail?.setsToWin)
  const sheet = createScoresheet(rules)
  const { date, time } = splitPlayDate(game.playDate)

  sheet.header = {
    ...sheet.header,
    competition: game.competitionName ?? '',
    stage: game.stageName ?? '',
    pool: game.poolName ?? '',
    matchNumber: game.matchNumber ?? game.id,
    date: date || sheet.header.date,
    time,
    hall: detail?.venue?.name ?? game.venueName ?? '',
    city: detail?.venue?.city ?? '',
    category: game.gender === 'f' ? 'Women' : game.gender === 'm' ? 'Men' : '',
    sourceProviderId: providerId,
    sourceGameId: game.id,
  }

  sheet.teams.A = { ...emptyTeam(game.home.name), clubName: game.home.clubName ?? '', sourceTeamId: game.home.id }
  sheet.teams.B = { ...emptyTeam(game.away.name), clubName: game.away.clubName ?? '', sourceTeamId: game.away.id }

  const officials = detail?.officials ?? []
  const byRole = (needle: string) =>
    officials.find((official) => (official.role ?? '').toLowerCase().includes(needle))
  const fullName = (official: { firstName: string; lastName: string } | undefined) =>
    official ? [official.firstName, official.lastName].filter(Boolean).join(' ') : ''

  sheet.officials = {
    ...sheet.officials,
    firstReferee: fullName(byRole('1st')),
    secondReferee: fullName(byRole('2nd')),
    lineJudges: officials
      .filter((official) => (official.role ?? '').toLowerCase().includes('line'))
      .map((official) => fullName(official))
      .join(', '),
  }

  return sheet
}

export function applyRoster(sheet: Scoresheet, side: TeamSide, roster: Roster): Scoresheet {
  const team = sheet.teams[side]
  const coach = roster.staff.find((member) => (member.role ?? '').toLowerCase().includes('trainer'))
  return {
    ...sheet,
    teams: {
      ...sheet.teams,
      [side]: {
        ...team,
        name: team.name || roster.team.name,
        clubName: team.clubName || (roster.team.clubName ?? ''),
        sourceTeamId: roster.team.id,
        players: roster.players.map(toSheetPlayer),
        staff: {
          ...team.staff,
          coach: team.staff.coach || (coach ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') : ''),
        },
      },
    } as Scoresheet['teams'],
  }
}

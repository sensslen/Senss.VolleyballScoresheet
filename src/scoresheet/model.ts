/**
 * The scoresheet as data. Field names follow the international (FIVB-style) sheet
 * so that a section of this model maps one-to-one onto a box you hand-copy.
 */

export type TeamSide = 'A' | 'B'

/** Court positions I..VI. Index 0 is position I, the server. */
export type Position = 1 | 2 | 3 | 4 | 5 | 6

export interface SheetPlayer {
  /** Stable local id; the sheet itself identifies players by number. */
  id: string
  number: number | null
  firstName: string
  lastName: string
  licence: string
  isCaptain: boolean
  isLibero: boolean
  position: string
}

export interface SheetStaff {
  coach: string
  assistantCoach: string
  physiotherapist: string
  doctor: string
}

export interface SheetTeam {
  /** Team name as printed in the header. */
  name: string
  clubName: string
  /** Federation team id, kept so a roster can be re-pulled. */
  sourceTeamId?: string
  players: SheetPlayer[]
  staff: SheetStaff
}

export interface MatchHeader {
  competition: string
  stage: string
  pool: string
  matchNumber: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  city: string
  hall: string
  category: string
  /** Which federation the data came from, for provenance. */
  sourceProviderId?: string
  sourceGameId?: string
}

export interface Officials {
  firstReferee: string
  secondReferee: string
  scorer: string
  assistantScorer: string
  lineJudges: string
}

/** The toss decides first service and which team starts on which side. */
export interface Toss {
  /** Team that serves the first rally of set 1. */
  firstServe: TeamSide | null
  /** Team on the left half of the sheet / left side of the court in set 1. */
  leftSide: TeamSide | null
}

export interface Substitution {
  /** Rotation slot (index 0..5 = positions I..VI) the change happens in. */
  slot: number
  /** Player leaving the court. */
  outPlayerId: string
  /** Player entering. */
  inPlayerId: string
  /** Rally index (0-based) after which the change was made. */
  atRally: number
  /** Score when the change was made, as printed in the substitution box. */
  scoreA: number
  scoreB: number
}

export interface TimeoutRecord {
  team: TeamSide
  atRally: number
  scoreA: number
  scoreB: number
}

export type SanctionKind = 'warning' | 'penalty' | 'expulsion' | 'disqualification'

export interface Sanction {
  kind: SanctionKind
  team: TeamSide
  /** Player number, or a role such as "coach". */
  member: string
  set: number
  scoreA: number
  scoreB: number
  remark: string
}

export interface RallyEvent {
  /** Team that won the rally, i.e. the point. */
  winner: TeamSide
}

export interface SetLineup {
  /** Player ids in positions I..VI. Null while the lineup is incomplete. */
  slots: Array<string | null>
  /** Libero ids on the sheet for this set; liberos are outside the rotation. */
  liberoIds: string[]
}

export interface SetRecord {
  /** 1-based set number. */
  number: number
  lineups: Record<TeamSide, SetLineup>
  /** Team serving the first rally of this set. */
  firstServe: TeamSide | null
  rallies: RallyEvent[]
  substitutions: Record<TeamSide, Substitution[]>
  timeouts: TimeoutRecord[]
  /** Set duration in minutes, written in the results box. */
  durationMinutes: number | null
  startTime: string
  endTime: string
}

export interface RuleSet {
  id: string
  nameKey: string
  /** Sets a team must win to take the match. */
  setsToWin: number
  pointsPerSet: number
  pointsDecidingSet: number
  minLead: number
  substitutionsPerSet: number
  timeoutsPerSet: number
  maxPlayers: number
  liberoMayServe: boolean
}

export interface Scoresheet {
  /** Local id, also the storage key. */
  id: string
  /** Schema version, so stored sheets can be migrated. */
  version: 1
  createdAt: string
  updatedAt: string
  header: MatchHeader
  officials: Officials
  rules: RuleSet
  teams: Record<TeamSide, SheetTeam>
  toss: Toss
  sets: SetRecord[]
  sanctions: Sanction[]
  remarks: string
  /** Section ids already copied onto the paper sheet. */
  copiedSections: string[]
}

export const TEAM_SIDES: TeamSide[] = ['A', 'B']

export const POSITION_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

export function otherSide(side: TeamSide): TeamSide {
  return side === 'A' ? 'B' : 'A'
}

export function playerLabel(player: SheetPlayer): string {
  const name = [player.lastName, player.firstName].filter(Boolean).join(' ').trim()
  const number = player.number === null ? '--' : String(player.number)
  return name ? `${number} ${name}` : number
}

export function findPlayer(team: SheetTeam, playerId: string | null): SheetPlayer | undefined {
  if (!playerId) return undefined
  return team.players.find((player) => player.id === playerId)
}

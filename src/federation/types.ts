/**
 * Country-neutral vocabulary every federation adapter maps onto.
 *
 * Federations name their hierarchy differently (Swiss Volley: region / league /
 * phase / group). The app only ever sees Region -> Competition -> Stage -> Pool,
 * so adding a country means writing one adapter, not touching the UI.
 */

export type Gender = 'm' | 'f' | 'mixed'

export interface Country {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string
  name: string
  /** Emoji flag, shown in the federation picker. */
  flag: string
}

export interface Region {
  id: string
  name: string
}

export interface Competition {
  id: string
  name: string
  gender?: Gender
  /** Free-form federation label, e.g. "NLA" or "3. Liga". */
  shortName?: string
  /** How many sets a team must win. Feeds the rule set when known. */
  setsToWin?: number
}

export interface Stage {
  id: string
  name: string
  shortName?: string
}

export interface Pool {
  id: string
  name: string
  shortName?: string
}

export interface TeamRef {
  id: string
  name: string
  clubId?: string
  clubName?: string
}

export interface Venue {
  id?: string
  name: string
  street?: string
  city?: string
  postalCode?: string
}

export interface Official {
  id?: string
  firstName: string
  lastName: string
  /** first / second referee, line judges, scorer... as labelled by the federation. */
  role?: string
}

export interface ImportedPlayer {
  id?: string
  firstName: string
  lastName: string
  /** Shirt number when the federation publishes one. */
  number?: number
  position?: string
  isCaptain?: boolean
  birthDate?: string
  /** Licence / association number, printed on the sheet in most countries. */
  licence?: string
}

export interface Roster {
  team: TeamRef
  players: ImportedPlayer[]
  staff: Official[]
}

export interface GameSummary {
  id: string
  /** ISO 8601 local date-time as published by the federation. */
  playDate?: string
  home: TeamRef
  away: TeamRef
  competitionName?: string
  stageName?: string
  poolName?: string
  gender?: Gender
  venueName?: string
  /** Federation-facing match number printed on the sheet. */
  matchNumber?: string
}

export interface GameDetail extends GameSummary {
  venue?: Venue
  officials: Official[]
  setsToWin?: number
  /** Already-played results, useful when transcribing an archived match. */
  setResults?: Array<{ home: number; away: number }>
}

export interface GameQuery {
  regionId?: string
  competitionId?: string
  stageId?: string
  poolId?: string
  teamId?: string
  clubId?: string
  gender?: Gender
  /** YYYY-MM-DD */
  dateFrom?: string
  dateTo?: string
  /** Federation season key as returned by listSeasons. */
  season?: string
}

export interface Season {
  id: string
  name: string
  isCurrent?: boolean
}

export interface ProviderCapabilities {
  browseCompetitions: boolean
  browseGames: boolean
  gameDetail: boolean
  rosters: boolean
  officials: boolean
  regions: boolean
  seasons: boolean
}

export interface AuthDescriptor {
  /** Shown next to the token field. */
  label: string
  /** Where a club obtains the credential. */
  helpText: string
  helpUrl?: string
  /** True when every call fails without a credential. */
  required: boolean
}

/**
 * One national federation's data source.
 *
 * Every method is optional except the identity block: a provider advertises what
 * it can do through `capabilities`, and the UI hides what is missing rather than
 * assuming a shape. Implementations must not throw for unsupported features -
 * they simply leave the method undefined.
 */
export interface FederationProvider {
  readonly id: string
  readonly name: string
  readonly country: Country
  readonly capabilities: ProviderCapabilities
  /** Undefined when the source needs no credential. */
  readonly auth?: AuthDescriptor
  /** Homepage or API docs, linked from settings. */
  readonly infoUrl?: string

  /** False when a required credential is missing. */
  isReady(): boolean

  listSeasons?(): Promise<Season[]>
  listRegions?(): Promise<Region[]>
  listCompetitions?(query: { regionId?: string; gender?: Gender; season?: string }): Promise<Competition[]>
  listStages?(competitionId: string): Promise<Stage[]>
  listPools?(stageId: string): Promise<Pool[]>
  listGames?(query: GameQuery): Promise<GameSummary[]>
  listUpcomingGames?(query: GameQuery): Promise<GameSummary[]>
  getGame?(gameId: string): Promise<GameDetail>
  getRoster?(teamId: string): Promise<Roster>
  listTeams?(query: { regionId?: string; competitionId?: string; poolId?: string; clubId?: string }): Promise<TeamRef[]>
}

export class FederationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'FederationError'
  }
}

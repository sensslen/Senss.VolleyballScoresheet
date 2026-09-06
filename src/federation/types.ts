/**
 * Country-neutral vocabulary every federation adapter maps onto.
 *
 * Federations name their hierarchy differently (Swiss Volley: league / phase /
 * group). The app only ever sees Competition -> Stage -> Pool, so adding a country
 * means writing one adapter, not touching the UI.
 */

import type { LocalizedMessage } from '../localizedMessage'

export type Gender = 'm' | 'f' | 'mixed'

export interface Country {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string
  /** Translation key for the country name; proper nouns still need localising. */
  nameKey: string
  /** Emoji flag, shown in the federation picker. */
  flag: string
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
  competitionId?: string
  competitionName?: string
  stageId?: string
  stageName?: string
  poolId?: string
  poolName?: string
  gender?: Gender
  venue?: Venue
  /** Federation-facing match number printed on the sheet. */
  matchNumber?: string
}

export interface GameDetail extends GameSummary {
  officials: Official[]
  setsToWin?: number
  /** Already-played results, useful when transcribing an archived match. */
  setResults?: Array<{ home: number; away: number }>
}

export interface GameQuery {
  /** YYYY-MM-DD */
  dateFrom?: string
  dateTo?: string
}

export interface ProviderCapabilities {
  browseGames: boolean
  gameDetail: boolean
  rosters: boolean
  officials: boolean
  /**
   * Whether the federation accepts a finished scoresheet over its API. No known
   * federation does, so the transfer wizard ends by helping a human file it instead.
   */
  submitResult: boolean
}

export interface AuthDescriptor {
  /** Translation key for the label shown next to the token field. */
  labelKey: string
  /** Translation key for where a club obtains the credential. */
  helpTextKey: string
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
  /** Proper noun as the federation writes it, used when there is no nameKey. */
  readonly name: string
  /** Translation key, for sources whose name is descriptive rather than a brand. */
  readonly nameKey?: string
  readonly country: Country
  readonly capabilities: ProviderCapabilities
  /** Undefined when the source needs no credential. */
  readonly auth?: AuthDescriptor
  /** Homepage or API docs, linked from settings. */
  readonly infoUrl?: string
  /** Where a human files the result when the API will not take it. */
  readonly resultPortalUrl?: string

  /** False when a required credential is missing. */
  isReady(): boolean

  listGames?(query: GameQuery): Promise<GameSummary[]>
  getGame?(gameId: string): Promise<GameDetail>
  getRoster?(teamId: string): Promise<Roster>
  listTeams?(query: { regionId?: string; competitionId?: string; poolId?: string; clubId?: string }): Promise<TeamRef[]>
}

/**
 * Carries a translation key when the app authored the message, and falls back to
 * `message` for text the federation's own API produced, which cannot be translated.
 */
export class FederationError extends Error {
  constructor(
    message: string,
    readonly localizedMessage?: LocalizedMessage,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'FederationError'
  }
}

export type Translate = (key: string, params?: Record<string, string | number>) => string

export function describeError(cause: unknown, t: Translate): string {
  if (cause instanceof FederationError && cause.localizedMessage) {
    return t(cause.localizedMessage.key, cause.localizedMessage.params)
  }
  return (cause as Error).message
}

export function providerName(provider: FederationProvider, t: Translate): string {
  return provider.nameKey ? t(provider.nameKey) : provider.name
}

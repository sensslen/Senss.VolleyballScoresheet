import type { LocalizedMessage } from '../../localizedMessage'
import { FederationError } from '../types'

export const SWISS_API_BASE = 'https://api.volleyball.ch'

export const SWISS_VOLLEY_NAME = 'Swiss Volley'

/** Shapes are trimmed to the fields the scoresheet needs. */
export interface SwissTranslations {
  d?: string
  shortD?: string
  f?: string
  shortF?: string
  i?: string
  shortI?: string
  D?: string
  F?: string
  I?: string
}

export interface SwissTeamInGameDto {
  teamId: number
  caption: string
  clubId?: number
  clubCaption?: string
}

export interface SwissGameDto {
  gameId: number
  playDate?: string
  playDateUtc?: string
  gender?: string
  status?: number
  teams: { home: SwissTeamInGameDto; away: SwissTeamInGameDto }
  league?: { leagueId: number; caption?: string; numberOfWinSets?: string; translations?: SwissTranslations }
  phase?: { phaseId: number; caption?: string; translations?: SwissTranslations }
  group?: { groupId: number; caption?: string; translations?: SwissTranslations }
  hall?: {
    hallId?: number
    caption?: string
    street?: string
    number?: string
    zip?: number | string
    city?: string
  }
  referees?: Record<string, { refereeId?: number; firstName?: string; lastName?: string }>
  setResults?: Record<string, { home: number; away: number }>
}

export interface SwissPlayerDto {
  firstName?: string
  lastName?: string
  number?: number | null
  position?: string | null
  isCaptain?: boolean
  birthday?: string | null
}

export interface SwissStaffDto {
  firstName?: string
  lastName?: string
  function?: { id?: number; translations?: Record<string, { title?: string }> }
}

export interface SwissTeamDto {
  teamId: number
  caption: string
  gender?: string
  club?: { clubId?: number; clubCaption?: string }
  players?: SwissPlayerDto[]
  staff?: SwissStaffDto[]
}

export interface SwissTeamListEntryDto {
  teamId: number
  caption: string
  gender?: string
  club?: { clubId?: number; clubCaption?: string }
}

type QueryValue = string | number | boolean | undefined

export class SwissVolleyApi {
  constructor(private readonly getToken: () => string) {}

  hasToken(): boolean {
    return this.getToken().trim().length > 0
  }

  private async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const token = this.getToken().trim()
    if (!token) {
      throw new FederationError('No Swiss Volley API token configured.', {
        key: 'federation.noToken',
        params: { name: SWISS_VOLLEY_NAME },
      })
    }

    const url = new URL(SWISS_API_BASE + path)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }

    let response: Response
    try {
      // The API sends Access-Control-Allow-Origin: *, so the browser may call it directly.
      response = await fetch(url, { headers: { Authorization: token }, redirect: 'follow', cache: 'no-store' })
    } catch (cause) {
      const reason = (cause as Error).message
      throw new FederationError(`Could not reach ${SWISS_API_BASE}: ${reason}`, {
        key: 'federation.unreachable',
        params: { url: SWISS_API_BASE, reason },
      })
    }

    if (!response.ok) {
      const failure = await describeFailure(response)
      throw new FederationError(failure.text, failure.localized, response.status)
    }

    const body = (await response.json()) as unknown
    // An invalid token is answered with a 302 to the login page carrying an errors array.
    if (body && typeof body === 'object' && 'errors' in body) {
      const errors = (body as { errors: Array<{ message?: string }> }).errors
      throw new FederationError(
        errors.map((e) => e.message ?? 'Unknown error').join('; '),
        undefined,
        response.status,
      )
    }
    return body as T
  }

  listGames(query: {
    region?: string
    gender?: string
    leagueId?: string
    phaseId?: string
    groupId?: string
    teamId?: string
    clubId?: string
    dateStart?: string
    dateEnd?: string
    includeCup?: boolean
  }): Promise<SwissGameDto[]> {
    return this.get('/indoor/games', {
      region: query.region,
      gender: query.gender,
      leagueId: query.leagueId,
      phaseId: query.phaseId,
      groupId: query.groupId,
      teamId: query.teamId,
      clubId: query.clubId,
      dateStart: query.dateStart,
      dateEnd: query.dateEnd,
      includeCup: query.includeCup === false ? 0 : 1,
    })
  }

  listUpcomingGames(query: {
    region?: string
    gender?: string
    leagueId?: string
    phaseId?: string
    groupId?: string
    teamId?: string
    clubId?: string
  }): Promise<SwissGameDto[]> {
    return this.get('/indoor/upcomingGames', { ...query })
  }

  getGame(gameId: string): Promise<SwissGameDto> {
    return this.get(`/indoor/game/${encodeURIComponent(gameId)}`)
  }

  getTeam(teamId: string): Promise<SwissTeamDto> {
    return this.get(`/indoor/teams/${encodeURIComponent(teamId)}`)
  }

  listTeams(query: {
    region?: string
    clubId?: string
    gender?: string
    leagueId?: string
    phaseId?: string
    groupId?: string
    season?: string
  }): Promise<SwissTeamListEntryDto[]> {
    return this.get('/indoor/teams', { ...query })
  }
}

interface Failure {
  text: string
  /** Absent when the text came from the API and so cannot be translated. */
  localized?: LocalizedMessage
}

async function describeFailure(response: Response): Promise<Failure> {
  const fallback: Failure = {
    text: `${SWISS_VOLLEY_NAME} returned ${response.status} ${response.statusText}`,
    localized: {
      key: 'federation.httpError',
      params: { name: SWISS_VOLLEY_NAME, status: response.status, statusText: response.statusText },
    },
  }
  try {
    const body = (await response.json()) as { errors?: Array<{ message?: string }> }
    const message = body.errors?.map((e) => e.message).filter(Boolean).join('; ')
    return message ? { text: `${message} (HTTP ${response.status})` } : fallback
  } catch {
    return fallback
  }
}

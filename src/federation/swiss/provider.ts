import { credentials } from '../credentials'
import type {
  Competition,
  FederationProvider,
  GameDetail,
  GameQuery,
  GameSummary,
  Gender,
  Official,
  Pool,
  Region,
  Roster,
  Season,
  Stage,
  TeamRef,
} from '../types'
import {
  SwissVolleyApi,
  type SwissGameDto,
  type SwissTeamInGameDto,
  type SwissTranslations,
} from './api'

export const SWISS_PROVIDER_ID = 'swiss-volley'

/** Swiss Volley region codes are opaque strings; these are the published labels. */
const REGION_NAMES: Record<string, string> = {
  SV: 'Swiss Volley (national)',
  SVRA: 'Region Aargau',
  SVRBA: 'Region Basel',
  SVRBE: 'Region Bern',
  SVRF: 'Region Fribourg',
  SVRG: 'Region Genève',
  SVRGSGL: 'Region Graubünden / Sarganserland / Glarus',
  SVRI: 'Region Innerschweiz',
  SVRJS: 'Region Jura / Seeland',
  SVRN: 'Region Neuchâtel',
  SVRNO: 'Region Nordostschweiz',
  SVRS: 'Region Solothurn',
  SVRT: 'Region Ticino',
  SVRV: 'Region Valais',
  SVRW: 'Region Waadt',
  SVRZ: 'Region Zürich',
}

function label(translations: SwissTranslations | undefined, fallback: string): string {
  return translations?.d ?? translations?.D ?? fallback
}

function shortLabel(translations: SwissTranslations | undefined): string | undefined {
  return translations?.shortD ?? translations?.shortF ?? undefined
}

function toGender(value: string | undefined): Gender | undefined {
  if (value === 'm' || value === 'f') return value
  return undefined
}

/** "three_win_sets" -> 3. Drives whether set 3 or set 5 is the short deciding set. */
function toSetsToWin(value: string | undefined): number | undefined {
  switch (value) {
    case 'one_win_set':
      return 1
    case 'two_win_sets':
      return 2
    case 'three_win_sets':
      return 3
    case 'four_win_sets':
      return 4
    default:
      return undefined
  }
}

function toTeamRef(dto: SwissTeamInGameDto): TeamRef {
  return {
    id: String(dto.teamId),
    name: dto.caption.trim(),
    clubId: dto.clubId === undefined ? undefined : String(dto.clubId),
    clubName: dto.clubCaption?.trim(),
  }
}

function toGameSummary(dto: SwissGameDto): GameSummary {
  return {
    id: String(dto.gameId),
    playDate: dto.playDate,
    home: toTeamRef(dto.teams.home),
    away: toTeamRef(dto.teams.away),
    competitionName: dto.league ? label(dto.league.translations, dto.league.caption ?? '') : undefined,
    stageName: dto.phase ? label(dto.phase.translations, dto.phase.caption ?? '') : undefined,
    poolName: dto.group ? label(dto.group.translations, dto.group.caption ?? '') : undefined,
    gender: toGender(dto.gender),
    venueName: dto.hall?.caption,
    matchNumber: String(dto.gameId),
  }
}

/** Referee slots are keyed "1".."4"; 1 and 2 are the match referees. */
const REFEREE_ROLES: Record<string, string> = {
  '1': '1st referee',
  '2': '2nd referee',
  '3': 'Line judge / reserve',
  '4': 'Line judge / reserve',
}

function toOfficials(dto: SwissGameDto): Official[] {
  const referees = dto.referees ?? {}
  return Object.entries(referees)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, referee]) => ({
      id: referee.refereeId === undefined ? undefined : String(referee.refereeId),
      firstName: referee.firstName?.trim() ?? '',
      lastName: referee.lastName?.trim() ?? '',
      role: REFEREE_ROLES[slot] ?? `Official ${slot}`,
    }))
    .filter((official) => official.firstName !== '' || official.lastName !== '')
}

export function createSwissVolleyProvider(): FederationProvider {
  const api = new SwissVolleyApi(() => credentials.get(SWISS_PROVIDER_ID))

  return {
    id: SWISS_PROVIDER_ID,
    name: 'Swiss Volley (Volley Manager)',
    country: { code: 'CH', nameKey: 'provider.swiss.country', flag: '🇨🇭' },
    infoUrl: 'https://swissvolley.docs.apiary.io/',
    // Swiss Volley publishes fixtures, teams and squads but accepts no scoresheet,
    // so the result is reported by hand in Volley Manager.
    resultPortalUrl: 'https://volleymanager.volleyball.ch/',
    capabilities: {
      browseCompetitions: true,
      browseGames: true,
      gameDetail: true,
      rosters: true,
      officials: true,
      regions: true,
      seasons: true,
      submitResult: false,
    },
    auth: {
      labelKey: 'provider.swiss.tokenLabel',
      required: true,
      helpTextKey: 'provider.swiss.tokenHelp',
      helpUrl: 'https://volleymanager.volleyball.ch/sportmanager.indoorvolleyball/clubdata/index',
    },

    isReady() {
      return api.hasToken()
    },

    async listSeasons(): Promise<Season[]> {
      const seasons = await api.listSeasons()
      return seasons.map((season) => ({
        id: season.year,
        name: season.displayname,
        isCurrent: season.defaultForPublicAPI || season.active,
      }))
    },

    async listRegions(): Promise<Region[]> {
      const codes = await api.listRegions()
      return codes.map((code) => ({ id: code, name: REGION_NAMES[code] ?? code }))
    },

    async listCompetitions({ regionId, gender }): Promise<Competition[]> {
      const leagues = await api.listLeagues(regionId ?? 'SV', gender)
      return leagues.map((league) => ({
        id: String(league.leagueId),
        name: label(league.translations, league.caption),
        shortName: shortLabel(league.translations) ?? league.leagueCategory,
        gender: toGender(league.gender),
      }))
    },

    async listStages(competitionId: string): Promise<Stage[]> {
      const phases = await api.listPhases(competitionId)
      return phases.map((phase) => ({
        id: String(phase.phaseId),
        name: label(phase.translations, phase.caption),
        shortName: shortLabel(phase.translations),
      }))
    },

    async listPools(stageId: string): Promise<Pool[]> {
      const groups = await api.listGroups(stageId)
      return groups.map((group) => ({
        id: String(group.groupId),
        name: label(group.translations, group.caption),
        shortName: shortLabel(group.translations),
      }))
    },

    async listGames(query: GameQuery): Promise<GameSummary[]> {
      const games = await api.listGames({
        region: query.regionId,
        gender: query.gender === 'mixed' ? undefined : query.gender,
        leagueId: query.competitionId,
        phaseId: query.stageId,
        groupId: query.poolId,
        teamId: query.teamId,
        clubId: query.clubId,
        dateStart: query.dateFrom,
        dateEnd: query.dateTo,
      })
      return games.map(toGameSummary)
    },

    async listUpcomingGames(query: GameQuery): Promise<GameSummary[]> {
      const games = await api.listUpcomingGames({
        region: query.regionId,
        gender: query.gender === 'mixed' ? undefined : query.gender,
        leagueId: query.competitionId,
        phaseId: query.stageId,
        groupId: query.poolId,
        teamId: query.teamId,
        clubId: query.clubId,
      })
      return games.map(toGameSummary)
    },

    async getGame(gameId: string): Promise<GameDetail> {
      const dto = await api.getGame(gameId)
      const summary = toGameSummary(dto)
      const setResults = dto.setResults
        ? Object.entries(dto.setResults)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, result]) => result)
        : undefined

      return {
        ...summary,
        officials: toOfficials(dto),
        setsToWin: toSetsToWin(dto.league?.numberOfWinSets),
        setResults,
        venue: dto.hall
          ? {
              id: dto.hall.hallId === undefined ? undefined : String(dto.hall.hallId),
              name: dto.hall.caption ?? '',
              street: [dto.hall.street, dto.hall.number].filter(Boolean).join(' ').trim() || undefined,
              postalCode: dto.hall.zip === undefined ? undefined : String(dto.hall.zip),
              city: dto.hall.city,
            }
          : undefined,
      }
    },

    async getRoster(teamId: string): Promise<Roster> {
      const dto = await api.getTeam(teamId)
      return {
        team: {
          id: String(dto.teamId),
          name: dto.caption.trim(),
          clubId: dto.club?.clubId === undefined ? undefined : String(dto.club.clubId),
          clubName: dto.club?.clubCaption?.trim(),
        },
        players: (dto.players ?? []).map((player) => ({
          firstName: player.firstName?.trim() ?? '',
          lastName: player.lastName?.trim() ?? '',
          number: player.number ?? undefined,
          position: player.position ?? undefined,
          isCaptain: player.isCaptain ?? false,
          birthDate: player.birthday ?? undefined,
        })),
        staff: (dto.staff ?? []).map((member) => ({
          firstName: member.firstName?.trim() ?? '',
          lastName: member.lastName?.trim() ?? '',
          role: member.function?.translations?.d?.title ?? 'Staff',
        })),
      }
    },

    async listTeams(query): Promise<TeamRef[]> {
      const teams = await api.listTeams({
        region: query.regionId,
        leagueId: query.competitionId,
        groupId: query.poolId,
        clubId: query.clubId,
      })
      return teams.map((team) => ({
        id: String(team.teamId),
        name: team.caption.trim(),
        clubId: team.club?.clubId === undefined ? undefined : String(team.club.clubId),
        clubName: team.club?.clubCaption?.trim(),
      }))
    },
  }
}

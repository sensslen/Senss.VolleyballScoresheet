import type { FederationProvider } from './types'

/**
 * The always-available fallback: no network, nothing prefilled, every field typed
 * by hand. Selecting a country only changes how much of the sheet arrives filled in.
 */
export const manualProvider: FederationProvider = {
  id: 'manual',
  name: 'Manual entry',
  nameKey: 'provider.manual.name',
  country: { code: 'ZZ', nameKey: 'provider.manual.country', flag: '🌐' },
  capabilities: {
    browseCompetitions: false,
    browseGames: false,
    gameDetail: false,
    rosters: false,
    officials: false,
    regions: false,
    seasons: false,
    submitResult: false,
  },
  isReady() {
    return true
  },
}

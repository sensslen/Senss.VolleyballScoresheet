import { manualProvider } from './manualProvider'
import { createSwissVolleyProvider, SWISS_PROVIDER_ID } from './swiss/provider'
import type { FederationProvider } from './types'

/**
 * Adding a country: implement FederationProvider against that federation's API
 * and append it here. Nothing else in the app knows about individual countries.
 *
 * Every provider must talk to an https:// endpoint - the app is served over
 * HTTPS and browsers block plain-HTTP requests from it.
 */
const providers: FederationProvider[] = [manualProvider, createSwissVolleyProvider()]

export function allProviders(): FederationProvider[] {
  return providers
}

export function providerById(id: string): FederationProvider {
  return providers.find((provider) => provider.id === id) ?? manualProvider
}

/** First run lands on Swiss Volley; it explains what a token unlocks and works without one. */
export function defaultProviderId(): string {
  return SWISS_PROVIDER_ID
}

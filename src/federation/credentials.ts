import { readJson, writeJson } from '../browserStorage'

const KEY = 'vbs.credentials.v1'

/**
 * Federation credentials never leave the browser: this app is a static page with
 * no backend to proxy through, so the token lives in localStorage only.
 */
export const credentials = {
  get(providerId: string): string {
    return readJson<Record<string, string>>(KEY, {})[providerId] ?? ''
  },
  set(providerId: string, token: string): void {
    const store = readJson<Record<string, string>>(KEY, {})
    if (token) store[providerId] = token
    else delete store[providerId]
    writeJson(KEY, store)
  },
  clear(providerId: string): void {
    credentials.set(providerId, '')
  },
}

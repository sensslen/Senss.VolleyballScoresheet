import { browserStorage } from '../browserStorage'

const KEY = 'vbs.credentials.v1'

type Store = Record<string, string>

function read(): Store {
  const storage = browserStorage()
  if (!storage) return {}
  try {
    const raw = storage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store): void {
  browserStorage()?.setItem(KEY, JSON.stringify(store))
}

/**
 * Federation credentials never leave the browser: this app is a static page with
 * no backend to proxy through, so the token lives in localStorage only.
 */
export const credentials = {
  get(providerId: string): string {
    return read()[providerId] ?? ''
  },
  set(providerId: string, token: string): void {
    const store = read()
    if (token) store[providerId] = token
    else delete store[providerId]
    write(store)
  },
  clear(providerId: string): void {
    credentials.set(providerId, '')
  },
}

import { browserStorage } from '../browserStorage'
import type { Scoresheet } from './model'

const SHEETS_KEY = 'vbs.sheets.v1'
const SETTINGS_KEY = 'vbs.settings.v1'

export interface Settings {
  /** Empty until the user picks one; callers resolve it through the provider registry. */
  providerId: string
  /** Last used browsing filters, so the game list opens where you left it. */
  competitionId?: string
  stageId?: string
  poolId?: string
  teamId?: string
}

function readJson<T>(key: string, fallback: T): T {
  const storage = browserStorage()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  browserStorage()?.setItem(key, JSON.stringify(value))
}

export const sheetStore = {
  all(): Scoresheet[] {
    return readJson<Scoresheet[]>(SHEETS_KEY, []).filter((sheet) => sheet.version === 1)
  },
  save(sheet: Scoresheet): void {
    const sheets = sheetStore.all()
    const stamped = { ...sheet, updatedAt: new Date().toISOString() }
    const index = sheets.findIndex((candidate) => candidate.id === sheet.id)
    if (index >= 0) sheets[index] = stamped
    else sheets.unshift(stamped)
    writeJson(SHEETS_KEY, sheets)
  },
  remove(id: string): void {
    writeJson(
      SHEETS_KEY,
      sheetStore.all().filter((sheet) => sheet.id !== id),
    )
  },
}

export const settingsStore = {
  read(): Settings {
    return readJson<Settings>(SETTINGS_KEY, { providerId: '' })
  },
  write(settings: Settings): void {
    writeJson(SETTINGS_KEY, settings)
  },
}

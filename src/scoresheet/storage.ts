import { browserStorage, readJson, writeJson } from '../browserStorage'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStoredScoresheet(value: unknown): value is Scoresheet {
  return isRecord(value)
    && value.version === 2
    && typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && isRecord(value.header)
    && isRecord(value.officials)
    && isRecord(value.rules)
    && isRecord(value.teams)
    && Array.isArray(value.sets)
    && Array.isArray(value.sanctions)
    && typeof value.remarks === 'string'
}

export const sheetStore = {
  clear(): void {
    browserStorage()?.removeItem(SHEETS_KEY)
  },
  all(): Scoresheet[] {
    const raw = browserStorage()?.getItem(SHEETS_KEY)
    if (!raw) return []
    let stored: unknown
    try {
      stored = JSON.parse(raw)
    } catch {
      throw new Error('Saved scoresheets contain invalid data. They were not loaded or changed.')
    }
    if (!Array.isArray(stored)) {
      throw new Error('Saved scoresheets have an invalid format. They were not loaded or changed.')
    }
    const unsupportedIndex = stored.findIndex((sheet) => !isRecord(sheet) || sheet.version !== 2)
    if (unsupportedIndex !== -1) {
      const invalidSheet = stored[unsupportedIndex]
      const version = isRecord(invalidSheet) ? invalidSheet.version : undefined
      throw new Error(`A saved scoresheet uses unsupported format${version === undefined ? '' : ` v${String(version)}`}. It was not loaded or changed.`)
    }
    if (stored.some((sheet) => !isStoredScoresheet(sheet))) {
      throw new Error('A saved scoresheet is incomplete or corrupted. It was not loaded or changed.')
    }
    return stored as Scoresheet[]
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

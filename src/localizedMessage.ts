/**
 * A translatable string produced outside React, so the scoresheet engine and the
 * federation adapters can report a problem without knowing which language the app
 * is showing. Render it with `t(message.key, message.params)`.
 */
export interface LocalizedMessage {
  key: string
  params?: Record<string, string | number>
}

export function localized(key: string, params?: Record<string, string | number>): LocalizedMessage {
  return params ? { key, params } : { key }
}

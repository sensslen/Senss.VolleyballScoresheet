import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { defaultProviderId, providerById } from './federation/registry'
import { providerName, type GameSummary } from './federation/types'
import { computeMatchState } from './scoresheet/engine'
import { createScoresheet, scoresheetFromGame } from './scoresheet/factory'
import type { Scoresheet } from './scoresheet/model'
import { sheetStore, settingsStore, type Settings } from './scoresheet/storage'
import { Banner, Card, EmptyState } from './ui/components'
import { GameBrowser } from './ui/GameBrowser'
import { MatchStep } from './ui/MatchStep'
import { PlayStep } from './ui/PlayStep'
import { SettingsPanel } from './ui/SettingsPanel'
import { TeamsStep } from './ui/TeamsStep'
import { TransferWizard } from './ui/TransferWizard'
import type { SheetUpdater } from './ui/updater'
import { APP_VERSION } from './utils/version'

type Tab = 'start' | 'match' | 'teams' | 'play' | 'sheet' | 'settings'

const STEPS: Tab[] = ['start', 'match', 'teams', 'play', 'sheet']

export default function App() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Settings>(() => settingsStore.read())
  const [sheet, setSheet] = useState<Scoresheet | null>(null)
  const [tab, setTab] = useState<Tab>('start')
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [savedSheets, setSavedSheets] = useState<Scoresheet[]>(() => sheetStore.all())

  const provider = useMemo(() => providerById(settings.providerId || defaultProviderId()), [settings.providerId])

  useEffect(() => settingsStore.write(settings), [settings])

  // Every edit persists as it happens, so the saved list only has to be re-read
  // when the start tab is about to show it.
  const update = useCallback<SheetUpdater>((mutate) => {
    setSheet((previous) => {
      if (!previous) return previous
      const draft = structuredClone(previous)
      mutate(draft)
      sheetStore.save(draft)
      return draft
    })
  }, [])

  const openSheet = (next: Scoresheet, target: Tab) => {
    sheetStore.save(next)
    setSheet(next)
    setActiveSetIndex(0)
    setTab(target)
  }

  const showTab = (next: Tab) => {
    if (next === 'start') setSavedSheets(sheetStore.all())
    setTab(next)
  }

  const startFromGame = async (game: GameSummary) => {
    let created = scoresheetFromGame(game, provider.id)
    if (provider.getGame && provider.isReady()) {
      try {
        created = scoresheetFromGame(await provider.getGame(game.id), provider.id)
      } catch {
        // The summary already carries teams, date and competition; detail is a bonus.
      }
    }
    openSheet(created, 'teams')
  }

  const startBlank = () => openSheet(createScoresheet(), 'match')

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 pb-12">
      <header className="no-print mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent dark:from-indigo-300 dark:to-sky-300">
            {t('app.title')}
          </h1>
          <p className="muted mt-1 max-w-2xl">{t('app.tagline')}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="pill">
            <span aria-hidden>{provider.country.flag}</span> {providerName(provider, t)}
          </span>
          {sheet && (
            <span className="pill">
              {sheet.teams.A.name || t('sheet.row.teamA')} {t('common.vs')}{' '}
              {sheet.teams.B.name || t('sheet.row.teamB')}
            </span>
          )}
        </div>
      </header>

      <nav className="no-print mb-5 flex flex-wrap gap-2" aria-label={t('app.title')}>
        {STEPS.map((id, index) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab tab-active' : 'tab'}
            disabled={!sheet && id !== 'start'}
            onClick={() => showTab(id)}
            title={t(`tabs.${id}.hint`)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <span aria-hidden className="mono opacity-60">
              {index + 1}
            </span>
            {t(`tabs.${id}.label`)}
          </button>
        ))}
        <button
          type="button"
          className={`${tab === 'settings' ? 'tab tab-active' : 'tab'} ml-auto`}
          onClick={() => showTab('settings')}
          title={t('tabs.settings.hint')}
          aria-current={tab === 'settings' ? 'page' : undefined}
        >
          {t('tabs.settings.label')}
        </button>
      </nav>

      <main>
        {tab === 'start' && (
          <>
            <Card
              title={t('start.title')}
              subtitle={t('start.subtitle')}
              actions={
                <button type="button" className="primary" onClick={startBlank}>
                  {t('start.blank')}
                </button>
              }
            >
              <p className="muted">{t('start.body')}</p>
            </Card>

            <GameBrowser
              provider={provider}
              settings={settings}
              onSettingsChange={setSettings}
              onOpenSettings={() => showTab('settings')}
              onPick={(game) => void startFromGame(game)}
            />

            <Card title={t('start.saved.title')} subtitle={t('start.saved.subtitle')}>
              {savedSheets.length === 0 ? (
                <EmptyState>{t('start.saved.empty')}</EmptyState>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('common.date')}</th>
                        <th>{t('common.match')}</th>
                        <th>{t('common.score')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {savedSheets.map((candidate) => {
                        const match = computeMatchState(candidate)
                        return (
                          <tr key={candidate.id}>
                            <td className="mono whitespace-nowrap">{candidate.header.date}</td>
                            <td>
                              {candidate.teams.A.name || t('sheet.row.teamA')} {t('common.vs')}{' '}
                              {candidate.teams.B.name || t('sheet.row.teamB')}
                            </td>
                            <td className="mono">
                              {match.setsWon.A}:{match.setsWon.B}
                            </td>
                            <td className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openSheet(candidate, 'play')}
                              >
                                {t('common.open')}
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => {
                                  sheetStore.remove(candidate.id)
                                  setSavedSheets(sheetStore.all())
                                  if (sheet?.id === candidate.id) setSheet(null)
                                }}
                              >
                                {t('common.delete')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'settings' && (
          <SettingsPanel
            provider={provider}
            onProviderChange={(id) => setSettings({ ...settings, providerId: id })}
          />
        )}

        {sheet && tab === 'match' && <MatchStep sheet={sheet} update={update} />}
        {sheet && tab === 'teams' && (
          <TeamsStep sheet={sheet} update={update} provider={provider} onReplaceSheet={setSheet} />
        )}
        {sheet && tab === 'play' && (
          <PlayStep
            sheet={sheet}
            update={update}
            activeSetIndex={activeSetIndex}
            onActiveSetChange={setActiveSetIndex}
          />
        )}
        {sheet && tab === 'sheet' && <TransferWizard sheet={sheet} update={update} provider={provider} />}

        {!sheet && tab !== 'start' && tab !== 'settings' && <Banner kind="info">{t('app.needSheet')}</Banner>}
      </main>

      <footer className="no-print mt-8 flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="muted max-w-3xl">{t('app.footer')}</p>
        <p className="mono text-xs text-slate-400 dark:text-slate-600">{t('app.version', { version: APP_VERSION })}</p>
      </footer>
    </div>
  )
}

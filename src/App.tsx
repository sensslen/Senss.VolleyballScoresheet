import { useCallback, useEffect, useMemo, useState } from 'react'

import { defaultProviderId, providerById } from './federation/registry'
import type { GameSummary } from './federation/types'
import { computeMatchState } from './scoresheet/engine'
import { createScoresheet, scoresheetFromGame } from './scoresheet/factory'
import type { Scoresheet } from './scoresheet/model'
import { sheetStore, settingsStore, type Settings } from './scoresheet/storage'
import { Banner, Card, EmptyState } from './ui/components'
import { GameBrowser } from './ui/GameBrowser'
import { MatchStep } from './ui/MatchStep'
import { PlayStep } from './ui/PlayStep'
import { SettingsPanel } from './ui/SettingsPanel'
import { SheetView } from './ui/SheetView'
import { TeamsStep } from './ui/TeamsStep'
import type { SheetUpdater } from './ui/updater'

type Tab = 'start' | 'match' | 'teams' | 'play' | 'sheet' | 'settings'

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'start', label: '1. Match', hint: 'Pick a fixture or start blank' },
  { id: 'match', label: '2. Header', hint: 'Competition, venue, officials' },
  { id: 'teams', label: '3. Teams', hint: 'Rosters, captain, liberos' },
  { id: 'play', label: '4. Score', hint: 'Toss, lineups, rallies' },
  { id: 'sheet', label: '5. Copy', hint: 'Any box, ready to write' },
  { id: 'settings', label: 'Settings', hint: 'Federation and token' },
]

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => settingsStore.read())
  const [sheet, setSheet] = useState<Scoresheet | null>(null)
  const [tab, setTab] = useState<Tab>('start')
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [savedSheets, setSavedSheets] = useState<Scoresheet[]>(() => sheetStore.all())

  const provider = useMemo(() => providerById(settings.providerId || defaultProviderId()), [settings.providerId])

  useEffect(() => settingsStore.write(settings), [settings])

  useEffect(() => {
    if (!sheet) return
    sheetStore.save(sheet)
    setSavedSheets(sheetStore.all())
  }, [sheet])

  const update = useCallback<SheetUpdater>((mutate) => {
    setSheet((previous) => {
      if (!previous) return previous
      const draft = structuredClone(previous)
      mutate(draft)
      return draft
    })
  }, [])

  const startFromGame = async (game: GameSummary) => {
    let created = scoresheetFromGame(game, provider.id)
    if (provider.getGame && provider.isReady()) {
      try {
        created = scoresheetFromGame(await provider.getGame(game.id), provider.id)
      } catch {
        // The summary already carries teams, date and competition; detail is a bonus.
      }
    }
    setSheet(created)
    setActiveSetIndex(0)
    setTab('teams')
  }

  const startBlank = () => {
    setSheet(createScoresheet())
    setActiveSetIndex(0)
    setTab('match')
  }

  return (
    <div className="app">
      <header className="app-head no-print">
        <div>
          <h1>Volleyball Scoresheet Assistant</h1>
          <p className="muted">
            Guides you through an international scoresheet, then shows each box so you can copy it onto the paper sheet.
          </p>
        </div>
        <div className="head-meta">
          <span className="pill">
            {provider.country.flag} {provider.name}
          </span>
          {sheet && (
            <span className="pill">
              {sheet.teams.A.name || 'Team A'} vs {sheet.teams.B.name || 'Team B'}
            </span>
          )}
        </div>
      </header>

      <nav className="tabs no-print">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={tab === entry.id ? 'tab tab-active' : 'tab'}
            disabled={!sheet && entry.id !== 'start' && entry.id !== 'settings'}
            onClick={() => setTab(entry.id)}
            title={entry.hint}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'start' && (
          <>
            <Card
              title="Start a sheet"
              subtitle="Import a fixture to prefill the header, teams and officials, or start from a blank sheet."
              actions={
                <button type="button" className="primary" onClick={startBlank}>
                  Blank sheet
                </button>
              }
            >
              <p className="muted">
                With a federation token the header, both squads and the referees arrive filled in. Without one, the same
                sheet works, you just type the details yourself.
              </p>
            </Card>

            <GameBrowser
              provider={provider}
              settings={settings}
              onSettingsChange={setSettings}
              onPick={(game) => void startFromGame(game)}
            />

            <Card title="Saved sheets" subtitle="Kept in this browser.">
              {savedSheets.length === 0 ? (
                <EmptyState>Nothing saved yet.</EmptyState>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Match</th>
                      <th>Score</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {savedSheets.map((candidate) => {
                      const match = computeMatchState(candidate)
                      return (
                        <tr key={candidate.id}>
                          <td className="nowrap mono">{candidate.header.date}</td>
                          <td>
                            {candidate.teams.A.name || 'Team A'} vs {candidate.teams.B.name || 'Team B'}
                          </td>
                          <td className="mono">
                            {match.setsWon.A}:{match.setsWon.B}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setSheet(candidate)
                                setActiveSetIndex(0)
                                setTab('play')
                              }}
                            >
                              Open
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
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}

        {tab === 'settings' && <SettingsPanel provider={provider} onProviderChange={(id) => setSettings({ ...settings, providerId: id })} />}

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
        {sheet && tab === 'sheet' && <SheetView sheet={sheet} />}

        {!sheet && tab !== 'start' && tab !== 'settings' && (
          <Banner kind="info">Start or open a sheet first.</Banner>
        )}
      </main>

      <footer className="app-foot no-print">
        <p className="muted">
          Everything stays in this browser. The paper sheet remains the official record; this only helps you fill it in
          without arithmetic mistakes.
        </p>
      </footer>
    </div>
  )
}

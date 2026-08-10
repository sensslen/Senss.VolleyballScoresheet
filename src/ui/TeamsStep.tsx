import { useState } from 'react'

import type { FederationProvider } from '../federation/types'
import { applyRoster, emptyPlayer } from '../scoresheet/factory'
import { TEAM_SIDES, type Scoresheet, type TeamSide } from '../scoresheet/model'
import { Banner, Card, TextField } from './components'
import type { SheetUpdater } from './updater'

export function TeamsStep({
  sheet,
  update,
  provider,
  onReplaceSheet,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  provider: FederationProvider
  onReplaceSheet: (sheet: Scoresheet) => void
}) {
  return (
    <>
      {TEAM_SIDES.map((side) => (
        <TeamCard
          key={side}
          side={side}
          sheet={sheet}
          update={update}
          provider={provider}
          onReplaceSheet={onReplaceSheet}
        />
      ))}
    </>
  )
}

function TeamCard({
  side,
  sheet,
  update,
  provider,
  onReplaceSheet,
}: {
  side: TeamSide
  sheet: Scoresheet
  update: SheetUpdater
  provider: FederationProvider
  onReplaceSheet: (sheet: Scoresheet) => void
}) {
  const team = sheet.teams[side]
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canImport = Boolean(provider.getRoster && provider.isReady() && team.sourceTeamId)

  const importRoster = async () => {
    if (!provider.getRoster || !team.sourceTeamId) return
    setStatus('Loading roster...')
    setError(null)
    try {
      const roster = await provider.getRoster(team.sourceTeamId)
      onReplaceSheet(applyRoster(sheet, side, roster))
      setStatus(`Imported ${roster.players.length} players.`)
    } catch (cause) {
      setStatus(null)
      setError((cause as Error).message)
    }
  }

  const liberoCount = team.players.filter((player) => player.isLibero).length
  const captainCount = team.players.filter((player) => player.isCaptain).length

  return (
    <Card
      title={`Team ${side} - ${team.name || '(unnamed)'}`}
      subtitle={side === 'A' ? 'Home team on the fixture list.' : 'Visiting team on the fixture list.'}
      actions={
        <>
          {canImport && (
            <button type="button" onClick={() => void importRoster()}>
              Import roster
            </button>
          )}
          <button type="button" onClick={() => update((draft) => draft.teams[side].players.push(emptyPlayer()))}>
            Add player
          </button>
        </>
      }
    >
      <div className="grid grid-3">
        <TextField
          label="Team name"
          value={team.name}
          onChange={(value) => update((draft) => void (draft.teams[side].name = value))}
        />
        <TextField
          label="Club"
          value={team.clubName}
          onChange={(value) => update((draft) => void (draft.teams[side].clubName = value))}
        />
        <TextField
          label="Coach"
          value={team.staff.coach}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.coach = value))}
        />
        <TextField
          label="Assistant coach"
          value={team.staff.assistantCoach}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.assistantCoach = value))}
        />
        <TextField
          label="Physiotherapist"
          value={team.staff.physiotherapist}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.physiotherapist = value))}
        />
        <TextField
          label="Doctor"
          value={team.staff.doctor}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.doctor = value))}
        />
      </div>

      {status && <Banner kind="ok">{status}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!canImport && provider.capabilities.rosters && !team.sourceTeamId && (
        <Banner kind="info">
          This team was not imported from {provider.name}, so there is no roster to pull. Type the players in.
        </Banner>
      )}
      {captainCount === 0 && team.players.length > 0 && (
        <Banner kind="warn">No captain marked. The sheet needs the captain circled.</Banner>
      )}
      {captainCount > 1 && <Banner kind="warn">More than one captain marked.</Banner>}
      {liberoCount > 2 && <Banner kind="warn">More than two liberos marked.</Banner>}
      {team.players.length > sheet.rules.maxPlayers && (
        <Banner kind="warn">
          {team.players.length} players listed; the rules allow {sheet.rules.maxPlayers}.
        </Banner>
      )}

      <table className="table roster">
        <thead>
          <tr>
            <th>No.</th>
            <th>Last name</th>
            <th>First name</th>
            <th>Licence</th>
            <th>Position</th>
            <th>C</th>
            <th>L</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {team.players.map((player, index) => (
            <tr key={player.id}>
              <td>
                <input
                  className="num"
                  inputMode="numeric"
                  value={player.number ?? ''}
                  onChange={(event) =>
                    update((draft) => {
                      const raw = event.target.value.trim()
                      const target = draft.teams[side].players[index]
                      if (target) target.number = raw === '' ? null : Number(raw)
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={player.lastName}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.teams[side].players[index]
                      if (target) target.lastName = event.target.value
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={player.firstName}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.teams[side].players[index]
                      if (target) target.firstName = event.target.value
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={player.licence}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.teams[side].players[index]
                      if (target) target.licence = event.target.value
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={player.position}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.teams[side].players[index]
                      if (target) target.position = event.target.value
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={player.isCaptain}
                  onChange={(event) =>
                    update((draft) => {
                      for (const candidate of draft.teams[side].players) candidate.isCaptain = false
                      const target = draft.teams[side].players[index]
                      if (target) target.isCaptain = event.target.checked
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={player.isLibero}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.teams[side].players[index]
                      if (target) target.isLibero = event.target.checked
                    })
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => update((draft) => void draft.teams[side].players.splice(index, 1))}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

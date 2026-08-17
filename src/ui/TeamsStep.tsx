import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { describeError, providerName, type FederationProvider } from '../federation/types'
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
  const { t } = useTranslation()
  const team = sheet.teams[side]
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canImport = Boolean(provider.getRoster && provider.isReady() && team.sourceTeamId)

  const importRoster = async () => {
    if (!provider.getRoster || !team.sourceTeamId) return
    setStatus(t('teams.loadingRoster'))
    setError(null)
    try {
      const roster = await provider.getRoster(team.sourceTeamId)
      onReplaceSheet(applyRoster(sheet, side, roster))
      setStatus(t('teams.imported', { count: roster.players.length }))
    } catch (cause) {
      setStatus(null)
      setError(describeError(cause, t))
    }
  }

  const liberoCount = team.players.filter((player) => player.isLibero).length
  const captainCount = team.players.filter((player) => player.isCaptain).length

  return (
    <Card
      title={t('teams.cardTitle', { side, name: team.name || t('common.unnamed') })}
      subtitle={side === 'A' ? t('teams.home') : t('teams.away')}
      actions={
        <>
          {canImport && (
            <button type="button" onClick={() => void importRoster()}>
              {t('teams.import')}
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => update((draft) => draft.teams[side].players.push(emptyPlayer()))}
          >
            {t('teams.addPlayer')}
          </button>
        </>
      }
    >
      <div className="grid-3">
        <TextField
          label={t('teams.field.name')}
          value={team.name}
          onChange={(value) => update((draft) => void (draft.teams[side].name = value))}
        />
        <TextField
          label={t('teams.field.club')}
          value={team.clubName}
          onChange={(value) => update((draft) => void (draft.teams[side].clubName = value))}
        />
        <TextField
          label={t('teams.field.coach')}
          value={team.staff.coach}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.coach = value))}
        />
        <TextField
          label={t('teams.field.assistantCoach')}
          value={team.staff.assistantCoach}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.assistantCoach = value))}
        />
        <TextField
          label={t('teams.field.physiotherapist')}
          value={team.staff.physiotherapist}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.physiotherapist = value))}
        />
        <TextField
          label={t('teams.field.doctor')}
          value={team.staff.doctor}
          onChange={(value) => update((draft) => void (draft.teams[side].staff.doctor = value))}
        />
      </div>

      {status && <Banner kind="ok">{status}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!canImport && provider.capabilities.rosters && !team.sourceTeamId && (
        <Banner kind="info">{t('teams.notImported', { name: providerName(provider, t) })}</Banner>
      )}
      {captainCount === 0 && team.players.length > 0 && <Banner kind="warn">{t('teams.noCaptain')}</Banner>}
      {captainCount > 1 && <Banner kind="warn">{t('teams.tooManyCaptains')}</Banner>}
      {liberoCount > 2 && <Banner kind="warn">{t('teams.tooManyLiberos')}</Banner>}
      {team.players.length > sheet.rules.maxPlayers && (
        <Banner kind="warn">
          {t('teams.tooManyPlayers', { count: team.players.length, allowed: sheet.rules.maxPlayers })}
        </Banner>
      )}

      <div className="table-scroll">
        <table className="table roster">
          <thead>
            <tr>
              <th>{t('common.number')}</th>
              <th>{t('teams.col.lastName')}</th>
              <th>{t('teams.col.firstName')}</th>
              <th>{t('teams.col.licence')}</th>
              <th>{t('common.position')}</th>
              <th>{t('teams.col.captainShort')}</th>
              <th>{t('teams.col.liberoShort')}</th>
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
                    aria-label={t('common.number')}
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
                    aria-label={t('teams.col.lastName')}
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
                    aria-label={t('teams.col.firstName')}
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
                    aria-label={t('teams.col.licence')}
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
                    aria-label={t('common.position')}
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
                    aria-label={t('teams.col.captainShort')}
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
                    aria-label={t('teams.col.liberoShort')}
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
                    {t('common.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

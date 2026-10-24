import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { describeError, providerName, type FederationProvider } from '../federation/types'
import { applyRoster, emptyPlayer } from '../scoresheet/factory'
import { hasPlayerData, isEnteredPlayer, STAFF_ROLES, TEAM_SIDES, type Scoresheet, type SheetPlayer, type TeamSide } from '../scoresheet/model'
import { paperSide } from '../scoresheet/paper'
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
  const licenceLabel = t(provider.licence?.labelKey ?? 'teams.col.licence')
  const licenceType = provider.licence?.inputType ?? 'text'
  const staffLabel = (role: typeof STAFF_ROLES[number]) =>
    role === 'assistantCoach2' ? `${t('teams.field.assistantCoach')} 2` : t(`teams.field.${role}`)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [spareRows, setSpareRows] = useState(() => Array.from({ length: 7 }, emptyPlayer))

  const canImport = Boolean(provider.getRoster && provider.isReady() && team.sourceTeamId)

  const importRoster = async () => {
    if (!provider.getRoster || !team.sourceTeamId) return
    setStatus(t('teams.loadingRoster'))
    setError(null)
    try {
      const roster = await provider.getRoster(team.sourceTeamId)
      const next = applyRoster(sheet, side, roster)
      onReplaceSheet(next)
      setStatus(t('teams.imported', { count: next.teams[side].players.filter(isEnteredPlayer).length }))
    } catch (cause) {
      setStatus(null)
      setError(describeError(cause, t))
    }
  }

  const entered = team.players.filter(isEnteredPlayer)
  const drafts = team.players.filter((player) => hasPlayerData(player) && !isEnteredPlayer(player))
  const liberoCount = entered.filter((player) => player.isLibero).length
  const captainCount = entered.filter((player) => player.isCaptain).length
  const filledRows = [...entered, ...drafts]
  const rows = [...filledRows, ...spareRows.filter((row) => !filledRows.some((player) => player.id === row.id)).slice(0, Math.max(0, Math.max(7, entered.length + 1) - filledRows.length))]
  const editPlayer = (player: SheetPlayer, changes: Partial<SheetPlayer>) => {
    const next = { ...player, ...changes }
    update((draft) => {
      const players = draft.teams[side].players.filter(hasPlayerData)
      const index = players.findIndex((candidate) => candidate.id === player.id)
      if (index >= 0) players.splice(index, 1, next)
      else players.push(next)
      if (changes.isCaptain) for (const candidate of players) candidate.isCaptain = candidate.id === player.id
      draft.teams[side].players = players.filter(hasPlayerData)
    })
    if (!hasPlayerData(next)) setSpareRows((previous) => [next, ...previous.filter((row) => row.id !== player.id)].slice(0, 7))
    else if (spareRows.some((row) => row.id === player.id)) setSpareRows((previous) => [...previous.filter((row) => row.id !== player.id), emptyPlayer()])
  }

  return (
    <Card
      title={t('teams.cardTitle', { side: paperSide(sheet, side), name: team.name || t('common.unnamed') })}
      subtitle={side === 'A' ? t('teams.home') : t('teams.away')}
      actions={
        <>
          {canImport && (
            <button type="button" onClick={() => void importRoster()}>
              {t('teams.import')}
            </button>
          )}
        </>
      }
    >
      <div className="grid-2">
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
      </div>

      {status && <Banner kind="ok">{status}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!canImport && provider.capabilities.rosters && !team.sourceTeamId && (
        <Banner kind="info">{t('teams.notImported', { name: providerName(provider, t) })}</Banner>
      )}
      {captainCount === 0 && entered.length > 0 && <Banner kind="warn">{t('teams.noCaptain')}</Banner>}
      {captainCount > 1 && <Banner kind="warn">{t('teams.tooManyCaptains')}</Banner>}
      {liberoCount > 2 && <Banner kind="warn">{t('teams.tooManyLiberos')}</Banner>}
      {entered.length > sheet.rules.maxPlayers && (
        <Banner kind="warn">
          {t('teams.tooManyPlayers', { count: entered.length, allowed: sheet.rules.maxPlayers })}
        </Banner>
      )}

      <div className="table-scroll">
        <table className="table roster">
          <thead>
            <tr>
              <th>{licenceLabel}</th>
              <th>{t('common.number')}</th>
              <th>{t('common.name')}</th>
              <th>{t('teams.col.captainShort')}</th>
              <th>{t('teams.col.liberoShort')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => (
              <tr key={player.id}>
                <td>
                  <input
                    aria-label={licenceLabel}
                    type={licenceType}
                    value={player.licence}
                    onChange={(event) =>
                      editPlayer(player, { licence: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className="num"
                    type="number"
                    min="0"
                    step="1"
                    required={hasPlayerData(player)}
                    aria-invalid={hasPlayerData(player) && !isEnteredPlayer(player) || undefined}
                    inputMode="numeric"
                    aria-label={t('common.number')}
                    value={player.number ?? ''}
                    onChange={(event) =>
                      editPlayer(player, { number: event.target.value.trim() === '' ? null : Number(event.target.value) })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={t('common.name')}
                    value={player.name}
                    onChange={(event) =>
                      editPlayer(player, { name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={t('teams.col.captainShort')}
                    checked={player.isCaptain}
                    onChange={(event) =>
                      editPlayer(player, { isCaptain: event.target.checked })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={t('teams.col.liberoShort')}
                    checked={player.isLibero}
                    onChange={(event) =>
                      editPlayer(player, { isLibero: event.target.checked })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <h3>{t('teams.staff')}</h3>
        <div className="table-scroll">
          <table className="table roster">
            <thead><tr><th>{licenceLabel}</th><th>{t('common.position')}</th><th>{t('common.name')}</th></tr></thead>
            <tbody>{STAFF_ROLES.map((role) => (
              <tr key={role}>
                <td>
                  <input
                    aria-label={`${staffLabel(role)}: ${licenceLabel}`}
                    type={licenceType}
                    value={team.staff.licences?.[role] ?? ''}
                    required={Boolean(team.staff[role].trim())}
                    aria-invalid={Boolean(team.staff[role].trim()) && !team.staff.licences?.[role]?.trim() || undefined}
                    onChange={(event) => update((draft) => {
                      const staff = draft.teams[side].staff
                      staff.licences ??= {}
                      staff.licences[role] = event.target.value
                    })}
                  />
                </td>
                <th scope="row">{role === 'coach' ? 'C' : role === 'assistantCoach' ? 'AC1' : role === 'assistantCoach2' ? 'AC2' : role === 'physiotherapist' ? 'P' : 'M'}</th>
                <td>
                  <input
                    aria-label={staffLabel(role)}
                    value={team.staff[role]}
                    onChange={(event) => update((draft) => void (draft.teams[side].staff[role] = event.target.value))}
                  />
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}

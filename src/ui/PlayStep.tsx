import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applySubstitution,
  computeMatchState,
  computeSetState,
  rallyEntryBlocker,
  validateSubstitution,
} from '../scoresheet/engine'
import { emptySet } from '../scoresheet/factory'
import {
  findPlayer,
  otherSide,
  playerLabel,
  POSITION_LABELS,
  TEAM_SIDES,
  type SanctionKind,
  type Scoresheet,
  type TeamSide,
} from '../scoresheet/model'
import { maxSets } from '../scoresheet/rules'
import { Banner, Card, EmptyState, SelectField } from './components'
import type { SheetUpdater } from './updater'

const SANCTION_KINDS: SanctionKind[] = ['warning', 'penalty', 'expulsion', 'disqualification']

export function PlayStep({
  sheet,
  update,
  activeSetIndex,
  onActiveSetChange,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  activeSetIndex: number
  onActiveSetChange: (index: number) => void
}) {
  const { t } = useTranslation()
  const match = computeMatchState(sheet)
  const total = maxSets(sheet.rules)
  const index = Math.min(activeSetIndex, sheet.sets.length - 1)
  const setNumber = index + 1
  const canStartNextSet = !match.isComplete && sheet.sets.length < total && isSetFinished(sheet, sheet.sets.length - 1)

  return (
    <>
      <TossCard sheet={sheet} update={update} />

      <Card
        title={t('play.sets.title')}
        subtitle={
          match.isComplete && match.winner
            ? t('play.sets.wins', { a: match.setsWon.A, b: match.setsWon.B, side: match.winner })
            : t('play.sets.subtitle', { a: match.setsWon.A, b: match.setsWon.B })
        }
        actions={
          canStartNextSet ? (
            <button
              type="button"
              className="primary"
              onClick={() =>
                update((draft) => {
                  const next = emptySet(draft.sets.length + 1)
                  const previous = draft.sets[draft.sets.length - 1]
                  // Service alternates each set; the deciding set gets a fresh toss.
                  next.firstServe = previous?.firstServe ? otherSide(previous.firstServe) : null
                  draft.sets.push(next)
                })
              }
            >
              {t('play.sets.start', { number: sheet.sets.length + 1 })}
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          {sheet.sets.map((record, position) => {
            const state = computeSetState(sheet, position)
            return (
              <button
                key={record.number}
                type="button"
                className={position === index ? 'tab tab-active' : 'tab'}
                onClick={() => onActiveSetChange(position)}
              >
                {t('play.sets.tab', { number: record.number })}
                <span className="mono opacity-80">
                  {state.score.A}:{state.score.B}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <SetPanel key={setNumber} sheet={sheet} update={update} setIndex={index} />
    </>
  )
}

function isSetFinished(sheet: Scoresheet, index: number): boolean {
  if (index < 0) return false
  return computeSetState(sheet, index).isComplete
}

function useSideOptions(sheet: Scoresheet) {
  const { t } = useTranslation()
  return TEAM_SIDES.map((side) => ({
    value: side,
    label: `${t('common.teamSide', { side })} - ${sheet.teams[side].name || t('common.unnamed')}`,
  }))
}

function TossCard({ sheet, update }: { sheet: Scoresheet; update: SheetUpdater }) {
  const { t } = useTranslation()
  const sideOptions = useSideOptions(sheet)

  return (
    <Card title={t('play.toss.title')} subtitle={t('play.toss.subtitle')}>
      <div className="grid-2">
        <SelectField
          label={t('play.toss.firstServe')}
          value={sheet.toss.firstServe ?? ''}
          options={sideOptions}
          onChange={(value) =>
            update((draft) => {
              draft.toss.firstServe = (value || null) as TeamSide | null
              const first = draft.sets[0]
              if (first && first.rallies.length === 0) first.firstServe = draft.toss.firstServe
            })
          }
        />
        <SelectField
          label={t('play.toss.leftSide')}
          value={sheet.toss.leftSide ?? ''}
          options={sideOptions}
          onChange={(value) => update((draft) => void (draft.toss.leftSide = (value || null) as TeamSide | null))}
        />
      </div>
    </Card>
  )
}

function SetPanel({ sheet, update, setIndex }: { sheet: Scoresheet; update: SheetUpdater; setIndex: number }) {
  const { t } = useTranslation()
  const sideOptions = useSideOptions(sheet)
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>{t('play.setNotStarted')}</EmptyState>

  const state = computeSetState(sheet, setIndex)
  const blocker = rallyEntryBlocker(sheet, setIndex)

  return (
    <>
      <Card title={t('play.lineups.title', { number: record.number })} subtitle={t('play.lineups.subtitle')}>
        <div className="grid-2">
          <SelectField
            label={t('play.lineups.firstServe')}
            value={record.firstServe ?? ''}
            options={sideOptions}
            onChange={(value) =>
              update((draft) => {
                const target = draft.sets[setIndex]
                if (target) target.firstServe = (value || null) as TeamSide | null
              })
            }
            hint={state.isDeciding ? t('play.lineups.decidingHint') : undefined}
          />
        </div>
        <div className="grid-2">
          {TEAM_SIDES.map((side) => (
            <LineupEditor key={side} sheet={sheet} update={update} setIndex={setIndex} side={side} />
          ))}
        </div>
      </Card>

      <Card title={t('play.scoring.title', { number: record.number })}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {TEAM_SIDES.map((side) => (
            <div key={side} className={state.servingSide === side ? 'score-box serving' : 'score-box'}>
              <span className="score-team">
                {t('common.teamSide', { side })}
                {state.servingSide === side ? ` (${t('play.scoring.serving')})` : ''}
              </span>
              <span className="score-value">{state.score[side]}</span>
              <span className="muted">
                {sheet.teams[side].name || t('common.unnamed')}
                {state.nextServer[side]
                  ? ` - ${t('play.scoring.nextServer', {
                      number: state.nextServer[side]?.number ?? t('common.blank'),
                    })}`
                  : ''}
              </span>
            </div>
          ))}
        </div>

        {blocker && <Banner kind="info">{t(blocker.key, blocker.params)}</Banner>}
        {state.issues.map((issue, position) => (
          <Banner key={`${issue.key}-${position}`} kind="warn">
            {t(issue.key, issue.params)}
          </Banner>
        ))}

        <div className="my-4 flex flex-wrap gap-3">
          {TEAM_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              className="primary flex-1 basis-56 px-4 py-6 text-lg font-semibold"
              disabled={Boolean(blocker)}
              onClick={() =>
                update((draft) => {
                  draft.sets[setIndex]?.rallies.push({ winner: side })
                })
              }
            >
              {t('play.scoring.point', { side })}
            </button>
          ))}
          <button
            type="button"
            disabled={record.rallies.length === 0}
            onClick={() => update((draft) => void draft.sets[setIndex]?.rallies.pop())}
          >
            {t('play.scoring.undoRally')}
          </button>
        </div>

        <div className="button-row">
          {TEAM_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              disabled={state.isComplete || state.timeoutsUsed[side] >= sheet.rules.timeoutsPerSet}
              onClick={() =>
                update((draft) => {
                  draft.sets[setIndex]?.timeouts.push({
                    team: side,
                    atRally: record.rallies.length - 1,
                    scoreA: state.score.A,
                    scoreB: state.score.B,
                  })
                })
              }
            >
              {t('play.scoring.timeout', {
                side,
                used: state.timeoutsUsed[side],
                max: sheet.rules.timeoutsPerSet,
              })}
            </button>
          ))}
          {record.timeouts.length > 0 && (
            <button
              type="button"
              className="ghost"
              onClick={() => update((draft) => void draft.sets[setIndex]?.timeouts.pop())}
            >
              {t('play.scoring.undoTimeout')}
            </button>
          )}
        </div>

        {state.isComplete && state.winner && (
          <Banner kind="ok">
            {t('play.scoring.setFinished', {
              number: record.number,
              a: state.score.A,
              b: state.score.B,
              side: state.winner,
            })}
          </Banner>
        )}
      </Card>

      <Card title={t('play.subs.title')}>
        <div className="grid-2">
          {TEAM_SIDES.map((side) => (
            <SubstitutionForm key={side} sheet={sheet} update={update} setIndex={setIndex} side={side} />
          ))}
        </div>
      </Card>

      <SanctionCard
        sheet={sheet}
        update={update}
        setNumber={record.number}
        scoreA={state.score.A}
        scoreB={state.score.B}
      />
    </>
  )
}

function LineupEditor({
  sheet,
  update,
  setIndex,
  side,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  setIndex: number
  side: TeamSide
}) {
  const { t } = useTranslation()
  const record = sheet.sets[setIndex]
  const team = sheet.teams[side]
  if (!record) return null

  const slots = record.lineups[side].slots
  const locked = record.rallies.length > 0
  const options = team.players
    .filter((player) => !player.isLibero)
    .map((player) => ({ value: player.id, label: playerLabel(player) }))

  return (
    <div className="lineup">
      <h3>
        {t('common.teamSide', { side })} - {team.name || t('common.unnamed')}
      </h3>
      {locked && <p className="muted">{t('play.lineups.locked')}</p>}
      <div className="grid-3">
        {POSITION_LABELS.map((label, slot) => (
          <SelectField
            key={label}
            label={t('play.lineups.position', { label })}
            value={slots[slot] ?? ''}
            options={options}
            onChange={(value) =>
              update((draft) => {
                const target = draft.sets[setIndex]
                if (target) target.lineups[side].slots[slot] = value || null
              })
            }
          />
        ))}
      </div>
      <SelectField
        label={t('play.lineups.libero')}
        value=""
        placeholder={t('play.lineups.addLibero')}
        options={team.players
          .filter((player) => player.isLibero && !record.lineups[side].liberoIds.includes(player.id))
          .map((player) => ({ value: player.id, label: playerLabel(player) }))}
        onChange={(value) =>
          update((draft) => {
            const target = draft.sets[setIndex]
            if (target && value) target.lineups[side].liberoIds.push(value)
          })
        }
      />
      {record.lineups[side].liberoIds.length > 0 && (
        <p className="flex flex-wrap gap-2">
          {record.lineups[side].liberoIds.map((liberoId) => {
            const player = findPlayer(team, liberoId)
            return (
              <button
                key={liberoId}
                type="button"
                className="chip"
                onClick={() =>
                  update((draft) => {
                    const target = draft.sets[setIndex]
                    if (!target) return
                    target.lineups[side].liberoIds = target.lineups[side].liberoIds.filter((id) => id !== liberoId)
                  })
                }
              >
                {t('teams.col.liberoShort')} {player ? playerLabel(player) : liberoId} ✕
              </button>
            )
          })}
        </p>
      )}
    </div>
  )
}

function SubstitutionForm({
  sheet,
  update,
  setIndex,
  side,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  setIndex: number
  side: TeamSide
}) {
  const { t } = useTranslation()
  const [slot, setSlot] = useState<string>('')
  const [incoming, setIncoming] = useState<string>('')
  const record = sheet.sets[setIndex]
  const state = computeSetState(sheet, setIndex)
  const team = sheet.teams[side]
  if (!record) return null

  const slotIndex = slot === '' ? -1 : Number(slot)
  const problem = slotIndex >= 0 && incoming ? validateSubstitution(sheet, setIndex, side, slotIndex, incoming) : null

  const recordSubstitution = () => {
    if (slotIndex < 0 || !incoming || problem) return
    const substitution = applySubstitution(sheet, setIndex, side, slotIndex, incoming)
    if (!substitution) return
    update((draft) => void draft.sets[setIndex]?.substitutions[side].push(substitution))
    setSlot('')
    setIncoming('')
  }

  const history = record.substitutions[side]

  return (
    <div className="lineup">
      <h3>
        {t('play.subs.heading', {
          side,
          used: state.substitutionsUsed[side],
          max: sheet.rules.substitutionsPerSet,
        })}
      </h3>
      <div className="grid-2">
        <SelectField
          label={t('play.subs.leaving')}
          value={slot}
          options={POSITION_LABELS.map((label, index) => {
            const playerId = state.courtSlots[side][index] ?? null
            const player = findPlayer(team, playerId)
            return { value: String(index), label: `${label} - ${player ? playerLabel(player) : t('common.empty')}` }
          })}
          onChange={(value) => setSlot(value)}
        />
        <SelectField
          label={t('play.subs.entering')}
          value={incoming}
          options={team.players
            .filter((player) => !player.isLibero && !state.courtSlots[side].includes(player.id))
            .map((player) => ({ value: player.id, label: playerLabel(player) }))}
          onChange={(value) => setIncoming(value)}
        />
      </div>
      {problem && <Banner kind="warn">{t(problem.key, problem.params)}</Banner>}
      <div className="button-row">
        <button
          type="button"
          className="primary"
          disabled={slotIndex < 0 || !incoming || Boolean(problem)}
          onClick={recordSubstitution}
        >
          {t('play.subs.record')}
        </button>
        {history.length > 0 && (
          <button
            type="button"
            className="ghost"
            onClick={() => update((draft) => void draft.sets[setIndex]?.substitutions[side].pop())}
          >
            {t('play.subs.undo')}
          </button>
        )}
      </div>
      {history.length > 0 && (
        <ul className="list">
          {history.map((entry, position) => {
            const out = findPlayer(team, entry.outPlayerId)
            const inbound = findPlayer(team, entry.inPlayerId)
            return (
              <li key={position}>
                {t('play.subs.entry', {
                  position: POSITION_LABELS[entry.slot] ?? '',
                  in: inbound?.number ?? t('common.blank'),
                  out: out?.number ?? t('common.blank'),
                  a: entry.scoreA,
                  b: entry.scoreB,
                })}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SanctionCard({
  sheet,
  update,
  setNumber,
  scoreA,
  scoreB,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  setNumber: number
  scoreA: number
  scoreB: number
}) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<SanctionKind | ''>('')
  const [side, setSide] = useState<TeamSide | ''>('')
  const [member, setMember] = useState('')

  const add = () => {
    if (!kind || !side) return
    update((draft) =>
      draft.sanctions.push({ kind, team: side, member, set: setNumber, scoreA, scoreB, remark: '' }),
    )
    setKind('')
    setSide('')
    setMember('')
  }

  return (
    <Card title={t('play.sanctions.title')} subtitle={t('play.sanctions.subtitle')}>
      <div className="grid-4">
        <SelectField
          label={t('play.sanctions.kind')}
          value={kind}
          options={SANCTION_KINDS.map((value) => ({ value, label: t(`sanction.${value}`) }))}
          onChange={(value) => setKind(value)}
        />
        <SelectField
          label={t('common.team')}
          value={side}
          options={TEAM_SIDES.map((option) => ({ value: option, label: t('common.teamSide', { side: option }) }))}
          onChange={(value) => setSide(value)}
        />
        <label className="field">
          <span className="field-label">{t('play.sanctions.member')}</span>
          <input
            value={member}
            placeholder={t('play.sanctions.memberPlaceholder')}
            onChange={(event) => setMember(event.target.value)}
          />
        </label>
        <div className="field">
          <span className="field-label">{t('play.sanctions.atScore')}</span>
          <p className="mono">{t('play.sanctions.atScoreValue', { a: scoreA, b: scoreB, number: setNumber })}</p>
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="primary" disabled={!kind || !side} onClick={add}>
          {t('play.sanctions.add')}
        </button>
      </div>
      {sheet.sanctions.length > 0 && (
        <ul className="list">
          {sheet.sanctions.map((sanction, index) => (
            <li key={index}>
              {t(`sanction.${sanction.kind}`)} - {t('common.teamSide', { side: sanction.team })} {sanction.member} -{' '}
              {t('common.set')} {sanction.set} {sanction.scoreA}:{sanction.scoreB}
              <button
                type="button"
                className="ghost"
                onClick={() => update((draft) => void draft.sanctions.splice(index, 1))}
              >
                {t('common.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

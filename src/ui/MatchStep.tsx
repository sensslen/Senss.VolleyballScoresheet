import { useTranslation } from 'react-i18next'

import type { FederationProvider } from '../federation/types'
import { MATCH_OFFICIAL_ROLES, type MatchOfficialRole } from '../scoresheet/model'
import type { Scoresheet } from '../scoresheet/model'
import { RULE_SETS, ruleSetById, ruleSetName } from '../scoresheet/rules'
import { Card, SelectField, TextField } from './components'
import type { SheetUpdater } from './updater'

const HEADER_FIELDS = ['competition', 'stage', 'pool', 'matchNumber', 'category', 'date', 'time', 'hall', 'city'] as const

export function MatchStep({ sheet, update, provider }: { sheet: Scoresheet; update: SheetUpdater; provider: FederationProvider }) {
  const { t } = useTranslation()
  const header = sheet.header
  const officials = sheet.officials
  const known = RULE_SETS.map((rules) => ({ value: rules.id, label: ruleSetName(rules, t) }))
  const isKnown = RULE_SETS.some((rules) => rules.id === sheet.rules.id)
  const officialLabels: Record<MatchOfficialRole, string> = {
    firstReferee: t('match.officials.first'),
    secondReferee: t('match.officials.second'),
    scorer: t('match.officials.scorer'),
    assistantScorer: t('match.officials.assistantScorer'),
  }
  const licenceLabel = t(provider.licence?.labelKey ?? 'teams.col.licence')
  const licenceType = provider.licence?.inputType ?? 'text'

  return (
    <>
      <Card title={t('match.header.title')} subtitle={t('match.header.subtitle')}>
        <div className="grid-3">
          {HEADER_FIELDS.map((field) => (
            <TextField
              key={field}
              label={t(`match.field.${field}`)}
              type={field === 'date' || field === 'time' ? field : 'text'}
              value={header[field]}
              onChange={(value) => update((draft) => void (draft.header[field] = value))}
              placeholder={field === 'category' ? t('match.field.categoryPlaceholder') : undefined}
            />
          ))}
        </div>
      </Card>

      <Card title={t('match.rules.title')} subtitle={t('match.rules.subtitle')}>
        <div className="grid-2">
          <SelectField
            label={t('match.rules.ruleSet')}
            value={sheet.rules.id}
            options={
              isKnown
                ? known
                : [
                    {
                      value: sheet.rules.id,
                      label: t('match.rules.fromFederation', { name: ruleSetName(sheet.rules, t) }),
                    },
                    ...known,
                  ]
            }
            required
            onChange={(value) =>
              update((draft) => {
                if (value) draft.rules = ruleSetById(value)
              })
            }
            hint={t('match.rules.summary', {
              best: sheet.rules.setsToWin * 2 - 1,
              points: sheet.rules.pointsPerSet,
              deciding: sheet.rules.pointsDecidingSet,
              substitutions: sheet.rules.substitutionsPerSet,
              timeouts: sheet.rules.timeoutsPerSet,
            })}
          />
        </div>
      </Card>

      <Card title={t('match.officials.title')}>
        <div className="table-scroll">
          <table className="table roster">
            <thead><tr><th>{t('common.position')}</th><th>{t('common.name')}</th><th>{t('settings.country')}</th><th>{licenceLabel}</th></tr></thead>
            <tbody>{MATCH_OFFICIAL_ROLES.map((role) => (
              <tr key={role}>
                <th scope="row">{officialLabels[role]}</th>
                <td><input aria-label={`${officialLabels[role]}: ${t('common.name')}`} value={officials[role].name} onChange={(event) => update((draft) => void (draft.officials[role].name = event.target.value))} /></td>
                <td><input aria-label={`${officialLabels[role]}: ${t('settings.country')}`} value={officials[role].country} onChange={(event) => update((draft) => void (draft.officials[role].country = event.target.value))} /></td>
                <td><input aria-label={`${officialLabels[role]}: ${licenceLabel}`} type={licenceType} value={officials[role].licence} onChange={(event) => update((draft) => void (draft.officials[role].licence = event.target.value))} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <h3>{t('match.officials.lineJudges')}</h3>
        <div className="table-scroll">
          <table className="table roster">
            <thead><tr><th>{t('common.number')}</th><th>{t('common.name')}</th></tr></thead>
            <tbody>{officials.lineJudges.map((name, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                <td><input aria-label={`${t('match.officials.lineJudges')} ${index + 1}: ${t('common.name')}`} value={name} onChange={(event) => update((draft) => void (draft.officials.lineJudges[index] = event.target.value))} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

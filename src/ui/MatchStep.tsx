import { useTranslation } from 'react-i18next'

import type { Scoresheet } from '../scoresheet/model'
import { RULE_SETS, ruleSetById, ruleSetName } from '../scoresheet/rules'
import { Card, SelectField, TextField } from './components'
import type { SheetUpdater } from './updater'

export function MatchStep({ sheet, update }: { sheet: Scoresheet; update: SheetUpdater }) {
  const { t } = useTranslation()
  const header = sheet.header
  const officials = sheet.officials
  const known = RULE_SETS.map((rules) => ({ value: rules.id, label: ruleSetName(rules, t) }))
  const isKnown = RULE_SETS.some((rules) => rules.id === sheet.rules.id)

  return (
    <>
      <Card title={t('match.header.title')} subtitle={t('match.header.subtitle')}>
        <div className="grid-3">
          <TextField
            label={t('match.field.competition')}
            value={header.competition}
            onChange={(value) => update((draft) => void (draft.header.competition = value))}
          />
          <TextField
            label={t('match.field.stage')}
            value={header.stage}
            onChange={(value) => update((draft) => void (draft.header.stage = value))}
          />
          <TextField
            label={t('match.field.pool')}
            value={header.pool}
            onChange={(value) => update((draft) => void (draft.header.pool = value))}
          />
          <TextField
            label={t('match.field.matchNumber')}
            value={header.matchNumber}
            onChange={(value) => update((draft) => void (draft.header.matchNumber = value))}
          />
          <TextField
            label={t('match.field.category')}
            value={header.category}
            onChange={(value) => update((draft) => void (draft.header.category = value))}
            placeholder={t('match.field.categoryPlaceholder')}
          />
          <TextField
            label={t('match.field.date')}
            type="date"
            value={header.date}
            onChange={(value) => update((draft) => void (draft.header.date = value))}
          />
          <TextField
            label={t('match.field.time')}
            type="time"
            value={header.time}
            onChange={(value) => update((draft) => void (draft.header.time = value))}
          />
          <TextField
            label={t('match.field.hall')}
            value={header.hall}
            onChange={(value) => update((draft) => void (draft.header.hall = value))}
          />
          <TextField
            label={t('match.field.city')}
            value={header.city}
            onChange={(value) => update((draft) => void (draft.header.city = value))}
          />
        </div>
      </Card>

      <Card title={t('match.rules.title')} subtitle={t('match.rules.subtitle')}>
        <div className="grid-2 items-start">
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
            onChange={(value) =>
              update((draft) => {
                if (value) draft.rules = ruleSetById(value)
              })
            }
            placeholder={ruleSetName(sheet.rules, t)}
          />
          <p className="muted">
            {t('match.rules.summary', {
              best: sheet.rules.setsToWin * 2 - 1,
              points: sheet.rules.pointsPerSet,
              deciding: sheet.rules.pointsDecidingSet,
              substitutions: sheet.rules.substitutionsPerSet,
              timeouts: sheet.rules.timeoutsPerSet,
            })}
          </p>
        </div>
      </Card>

      <Card title={t('match.officials.title')}>
        <div className="grid-3">
          <TextField
            label={t('match.officials.first')}
            value={officials.firstReferee}
            onChange={(value) => update((draft) => void (draft.officials.firstReferee = value))}
          />
          <TextField
            label={t('match.officials.second')}
            value={officials.secondReferee}
            onChange={(value) => update((draft) => void (draft.officials.secondReferee = value))}
          />
          <TextField
            label={t('match.officials.scorer')}
            value={officials.scorer}
            onChange={(value) => update((draft) => void (draft.officials.scorer = value))}
          />
          <TextField
            label={t('match.officials.assistantScorer')}
            value={officials.assistantScorer}
            onChange={(value) => update((draft) => void (draft.officials.assistantScorer = value))}
          />
          <TextField
            label={t('match.officials.lineJudges')}
            value={officials.lineJudges}
            onChange={(value) => update((draft) => void (draft.officials.lineJudges = value))}
          />
        </div>
      </Card>
    </>
  )
}

import { todayHK } from '../../lib/constants'
import AssigneePicker from './AssigneePicker'
import RecurrenceFields from './RecurrenceFields'
import BulkApplyBar from './BulkApplyBar'

export default function ConfigureStep({
  drafts,
  onChangeDraft,
  onBack,
  onContinue,
  helpers = [],
}) {
  function applyBulk(patch) {
    drafts.forEach((_, idx) => onChangeDraft(idx, patch))
  }

  return (
    <div className="space-y-4">
      <p lang="zh-Hant" className="text-sm text-slate-600">
        為每個已選範本設定臨時或排程，建議值可改。
        <span lang="id" className="mt-1 block text-xs text-slate-500">
          Atur sekali atau jadwal untuk setiap templat.
        </span>
      </p>

      <BulkApplyBar
        draftsCount={drafts.length}
        helpers={helpers}
        onApply={applyBulk}
      />

      {drafts.map((d, idx) => (
        <fieldset
          key={d.preset.id}
          className="space-y-2 rounded-2xl border border-slate-200 p-3"
        >
          <legend lang="zh-Hant" className="px-1 text-sm font-bold">
            {d.preset.title_zh}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={d.mode === 'adhoc'}
              onClick={() =>
                onChangeDraft(idx, {
                  mode: 'adhoc',
                  recurrence_rule: 'none',
                })
              }
              className={`min-h-11 rounded-xl border text-sm font-semibold ${
                d.mode === 'adhoc'
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-slate-200'
              }`}
            >
              臨時任務
              <span lang="id" className="block text-[10px] font-normal">
                Tugas sekali
              </span>
            </button>
            <button
              type="button"
              aria-pressed={d.mode === 'scheduled'}
              onClick={() =>
                onChangeDraft(idx, {
                  mode: 'scheduled',
                  recurrence_rule:
                    d.recurrence_rule === 'none' ? 'daily' : d.recurrence_rule,
                  start_date: d.start_date || d.date || todayHK(),
                  neverEnds: d.neverEnds !== false,
                })
              }
              className={`min-h-11 rounded-xl border text-sm font-semibold ${
                d.mode === 'scheduled'
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-slate-200'
              }`}
            >
              排程任務
              <span lang="id" className="block text-[10px] font-normal">
                Jadwal tetap
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" htmlFor={`date-${idx}`}>
                {d.mode === 'scheduled' ? '任務日期（今日）' : '選擇日期'}
              </label>
              <input
                id={`date-${idx}`}
                type="date"
                value={d.date || todayHK()}
                onChange={(e) =>
                  onChangeDraft(idx, {
                    date: e.target.value,
                    start_date: d.start_date || e.target.value,
                  })
                }
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              />
            </div>
            <div>
              <label className="text-xs" htmlFor={`time-${idx}`}>
                選擇時間
              </label>
              <input
                id={`time-${idx}`}
                type="time"
                value={d.time || ''}
                onChange={(e) => onChangeDraft(idx, { time: e.target.value })}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              />
            </div>
          </div>

          {d.mode === 'scheduled' && (
            <RecurrenceFields
              idPrefix={`rec-${idx}`}
              recurrence_rule={d.recurrence_rule || 'daily'}
              recurrence_weekdays={d.recurrence_weekdays}
              recurrence_interval={d.recurrence_interval || 1}
              start_date={d.start_date || d.date || todayHK()}
              end_date={d.end_date}
              neverEnds={d.neverEnds !== false}
              onChange={(p) => onChangeDraft(idx, p)}
            />
          )}

          <div>
            <label className="text-xs" htmlFor={`pri-${idx}`}>
              優先
            </label>
            <select
              id={`pri-${idx}`}
              value={d.priority || 'normal'}
              onChange={(e) => onChangeDraft(idx, { priority: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
            >
              <option value="low">低</option>
              <option value="normal">普通</option>
              <option value="high">高</option>
              <option value="urgent">緊急</option>
            </select>
          </div>

          <AssigneePicker
            id={`assignee-${idx}`}
            helpers={helpers}
            value={d.assigned_to || ''}
            onChange={(v) => onChangeDraft(idx, { assigned_to: v })}
          />

          <div>
            <label className="text-xs" htmlFor={`add-zh-${idx}`} lang="zh-Hant">
              補充指示
            </label>
            <textarea
              id={`add-zh-${idx}`}
              lang="zh-Hant"
              rows={2}
              value={d.additional_instructions_zh || ''}
              onChange={(e) =>
                onChangeDraft(idx, {
                  additional_instructions_zh: e.target.value,
                })
              }
              placeholder="例如：今日要買菜心、唔好太鹹"
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2 py-2 text-sm"
            />
            <label
              className="mt-2 block text-xs"
              htmlFor={`add-id-${idx}`}
              lang="id"
            >
              Instruksi tambahan
            </label>
            <textarea
              id={`add-id-${idx}`}
              lang="id"
              rows={2}
              value={d.additional_instructions_id || ''}
              onChange={(e) =>
                onChangeDraft(idx, {
                  additional_instructions_id: e.target.value,
                })
              }
              placeholder="Contoh: Beli caisim hari ini"
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2 py-2 text-sm"
            />
          </div>
        </fieldset>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 flex-1 rounded-xl border border-slate-200"
        >
          返回
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white"
        >
          預覽及確認
        </button>
      </div>
    </div>
  )
}

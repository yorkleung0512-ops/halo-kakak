import { todayHK } from '../../lib/constants'

export default function ConfigureStep({ drafts, onChangeDraft, onBack, onContinue }) {
  return (
    <div className="space-y-4">
      <p lang="zh-Hant" className="text-sm text-slate-600">
        為每個已選範本設定臨時或排程，建議值可改。
      </p>
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
                  recurrence_rule: d.recurrence_rule === 'none' ? 'daily' : d.recurrence_rule,
                })
              }
              className={`min-h-11 rounded-xl border text-sm font-semibold ${
                d.mode === 'scheduled'
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-slate-200'
              }`}
            >
              排程任務
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" htmlFor={`date-${idx}`}>
                選擇日期
              </label>
              <input
                id={`date-${idx}`}
                type="date"
                value={d.date || todayHK()}
                onChange={(e) => onChangeDraft(idx, { date: e.target.value })}
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
            <div>
              <label className="text-xs" htmlFor={`rec-${idx}`}>
                重複安排
              </label>
              <select
                id={`rec-${idx}`}
                value={d.recurrence_rule || 'daily'}
                onChange={(e) =>
                  onChangeDraft(idx, { recurrence_rule: e.target.value })
                }
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              >
                <option value="daily">每日</option>
                <option value="weekdays">平日</option>
                <option value="weekly">每週</option>
                <option value="monthly">每月</option>
              </select>
            </div>
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

          <div>
            <label className="text-xs" htmlFor={`notes-${idx}`}>
              備註（可選）
            </label>
            <input
              id={`notes-${idx}`}
              value={d.notes || ''}
              onChange={(e) => onChangeDraft(idx, { notes: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
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

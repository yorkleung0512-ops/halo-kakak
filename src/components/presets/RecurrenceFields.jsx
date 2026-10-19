import {
  ISO_WEEKDAYS,
  WEEKDAY_LABELS,
  recurrenceLabel,
} from '../../lib/presetUtils'

/**
 * Full scheduling controls: rule, weekdays (ISO 1–7), interval, start/end.
 * Weekday convention: 1=Mon … 7=Sun (PostgreSQL isodow). Do NOT use 0–6.
 */
export default function RecurrenceFields({
  idPrefix = 'rec',
  recurrence_rule = 'daily',
  recurrence_weekdays = null,
  recurrence_interval = 1,
  start_date = '',
  end_date = '',
  neverEnds = true,
  onChange,
  disabled = false,
}) {
  const rule = recurrence_rule || 'daily'
  const interval = Math.max(1, Number(recurrence_interval) || 1)
  const selected = new Set(
    Array.isArray(recurrence_weekdays) ? recurrence_weekdays.map(Number) : [],
  )
  const needsWeekdays = rule === 'weekly' || rule === 'biweekly' || rule === 'custom'
  const needsInterval = rule === 'daily' || rule === 'custom' || rule === 'monthly' || rule === 'weekly'

  function patch(p) {
    onChange?.(p)
  }

  function toggleDay(d) {
    const next = new Set(selected)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    const arr = [...next].sort((a, b) => a - b)
    patch({ recurrence_weekdays: arr.length ? arr : null })
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs" htmlFor={`${idPrefix}-rule`} lang="zh-Hant">
          重複安排
          <span lang="id" className="ml-1 font-normal text-slate-400">
            / Pengulangan
          </span>
        </label>
        <select
          id={`${idPrefix}-rule`}
          disabled={disabled}
          value={rule}
          onChange={(e) => {
            const next = e.target.value
            const p = { recurrence_rule: next }
            if (next === 'biweekly') p.recurrence_interval = Math.max(interval, 2)
            if (next === 'weekdays') p.recurrence_weekdays = null
            if (next === 'daily' || next === 'monthly') {
              /* keep interval */
            }
            patch(p)
          }}
          className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
        >
          <option value="daily">每日 / Setiap hari</option>
          <option value="weekdays">平日 / Hari kerja</option>
          <option value="weekly">每週 / Mingguan</option>
          <option value="biweekly">每兩週 / Dua minggu sekali</option>
          <option value="monthly">每月 / Bulanan</option>
          <option value="custom">自訂間隔 / Interval kustom</option>
        </select>
        <p className="mt-1 text-[11px] text-slate-500">
          {recurrenceLabel(
            { rule, weekdays: [...selected], interval },
            'zh',
          )}{' '}
          ·{' '}
          {recurrenceLabel(
            { rule, weekdays: [...selected], interval },
            'id',
          )}
        </p>
      </div>

      {needsWeekdays && (
        <div>
          <p className="text-xs" lang="zh-Hant">
            選擇星期（一…日）
            <span lang="id" className="ml-1 text-slate-400">
              / Senin…Minggu
            </span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {ISO_WEEKDAYS.map((d) => {
              const on = selected.has(d)
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={`min-h-11 min-w-11 rounded-xl border px-2 text-sm font-semibold ${
                    on
                      ? 'border-teal-600 bg-teal-50 text-teal-900'
                      : 'border-slate-200'
                  }`}
                >
                  <span lang="zh-Hant">{WEEKDAY_LABELS.zh[d]}</span>
                  <span lang="id" className="block text-[9px] font-normal text-slate-500">
                    {WEEKDAY_LABELS.id[d].slice(0, 3)}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            ISO 1=Mon…7=Sun（唔用 0–6）
          </p>
        </div>
      )}

      {needsInterval && (
        <div>
          <label className="text-xs" htmlFor={`${idPrefix}-interval`} lang="zh-Hant">
            {rule === 'monthly'
              ? '每隔幾個月'
              : rule === 'weekly'
                ? '每隔幾週'
                : '每隔幾日'}
            <span lang="id" className="ml-1 text-slate-400">
              / Interval
            </span>
          </label>
          <input
            id={`${idPrefix}-interval`}
            type="number"
            min={1}
            max={365}
            disabled={disabled || rule === 'biweekly'}
            value={rule === 'biweekly' ? 2 : interval}
            onChange={(e) =>
              patch({
                recurrence_interval: Math.min(
                  365,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              })
            }
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs" htmlFor={`${idPrefix}-start`} lang="zh-Hant">
            開始日期
          </label>
          <input
            id={`${idPrefix}-start`}
            type="date"
            disabled={disabled}
            value={start_date || ''}
            onChange={(e) => patch({ start_date: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          />
        </div>
        <div>
          <label className="text-xs" htmlFor={`${idPrefix}-end`} lang="zh-Hant">
            結束日期
          </label>
          <input
            id={`${idPrefix}-end`}
            type="date"
            disabled={disabled || neverEnds}
            value={neverEnds ? '' : end_date || ''}
            onChange={(e) => patch({ end_date: e.target.value || null })}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2 disabled:bg-slate-50"
          />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={disabled}
          checked={neverEnds}
          onChange={(e) =>
            patch({
              neverEnds: e.target.checked,
              end_date: e.target.checked ? null : end_date || null,
            })
          }
        />
        <span lang="zh-Hant">永不結束</span>
        <span lang="id" className="text-slate-500">
          / Tidak pernah berakhir
        </span>
      </label>
    </div>
  )
}

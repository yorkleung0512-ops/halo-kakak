import { useState } from 'react'
import { todayHK } from '../../lib/constants'
import AssigneePicker from './AssigneePicker'
import RecurrenceFields from './RecurrenceFields'

/**
 * Bulk「套用到全部」for multi-select configure drafts.
 * Confirmation required, then per-item tweak still allowed.
 */
export default function BulkApplyBar({ draftsCount, helpers = [], onApply }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [fields, setFields] = useState({
    assigned_to: '',
    date: todayHK(),
    time: '',
    mode: '',
    priority: '',
    recurrence_rule: 'daily',
    recurrence_weekdays: null,
    recurrence_interval: 1,
    start_date: todayHK(),
    end_date: null,
    neverEnds: true,
  })

  if (draftsCount < 2) return null

  function apply() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    const patch = {}
    if (fields.assigned_to !== '') patch.assigned_to = fields.assigned_to || null
    if (fields.date) patch.date = fields.date
    if (fields.time !== '') patch.time = fields.time
    if (fields.mode === 'adhoc' || fields.mode === 'scheduled') {
      patch.mode = fields.mode
      if (fields.mode === 'adhoc') patch.recurrence_rule = 'none'
    }
    if (fields.priority) patch.priority = fields.priority
    if (fields.mode === 'scheduled' || fields.recurrence_rule) {
      patch.recurrence_rule = fields.recurrence_rule
      patch.recurrence_weekdays = fields.recurrence_weekdays
      patch.recurrence_interval = fields.recurrence_interval
      patch.start_date = fields.start_date || fields.date
      patch.end_date = fields.neverEnds ? null : fields.end_date
      patch.neverEnds = fields.neverEnds
    }
    onApply?.(patch)
    setConfirming(false)
    setOpen(false)
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setConfirming(false)
        }}
        className="min-h-11 w-full rounded-xl border border-teal-300 bg-white text-sm font-bold text-teal-900"
      >
        套用到全部（{draftsCount}）
        <span lang="id" className="ml-1 font-normal text-teal-700">
          / Terapkan ke semua
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs">類型</label>
              <select
                value={fields.mode}
                onChange={(e) => setFields((f) => ({ ...f, mode: e.target.value }))}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              >
                <option value="">（唔改）</option>
                <option value="adhoc">臨時</option>
                <option value="scheduled">排程</option>
              </select>
            </div>
            <div>
              <label className="text-xs">優先</label>
              <select
                value={fields.priority}
                onChange={(e) =>
                  setFields((f) => ({ ...f, priority: e.target.value }))
                }
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              >
                <option value="">（唔改）</option>
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs">開始 / 日期</label>
              <input
                type="date"
                value={fields.date}
                onChange={(e) =>
                  setFields((f) => ({
                    ...f,
                    date: e.target.value,
                    start_date: e.target.value,
                  }))
                }
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              />
            </div>
            <div>
              <label className="text-xs">建議時間</label>
              <input
                type="time"
                value={fields.time}
                onChange={(e) => setFields((f) => ({ ...f, time: e.target.value }))}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
              />
            </div>
          </div>
          <AssigneePicker
            id="bulk-assignee"
            helpers={helpers}
            value={fields.assigned_to}
            onChange={(v) => setFields((f) => ({ ...f, assigned_to: v || '' }))}
          />
          {(fields.mode === 'scheduled' || !fields.mode) && (
            <RecurrenceFields
              idPrefix="bulk-rec"
              recurrence_rule={fields.recurrence_rule}
              recurrence_weekdays={fields.recurrence_weekdays}
              recurrence_interval={fields.recurrence_interval}
              start_date={fields.start_date}
              end_date={fields.end_date}
              neverEnds={fields.neverEnds}
              onChange={(p) => setFields((f) => ({ ...f, ...p }))}
            />
          )}
          {confirming && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"
              lang="zh-Hant"
            >
              確認將以上設定套用到全部 {draftsCount} 項？之後仍可逐項修改。
              <span lang="id" className="mt-1 block text-xs">
                Konfirmasi terapkan ke semua {draftsCount} item? Masih bisa diubah per item.
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={apply}
            className="min-h-11 w-full rounded-xl bg-teal-700 font-bold text-white"
          >
            {confirming ? '確認套用' : '套用到全部'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, formatTimeHK } from '../lib/constants'

export default function History() {
  const { household, effectiveIsHelper } = useHousehold()
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!household?.id) return
    supabase
      .from('task_occurrences')
      .select('id, title_zh, title_id, status, task_date, completed_at, updated_at')
      .eq('household_id', household.id)
      .is('deleted_at', null)
      .in('status', ['completed', 'cancelled', 'cannot_complete'])
      .order('task_date', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows(data || []))
  }, [household?.id])

  return (
    <div className="space-y-4">
      <h1
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-lg font-bold"
      >
        {effectiveIsHelper ? 'Riwayat' : '記錄'}
      </h1>
      <ul className="space-y-2">
        {rows.map((t) => {
          const meta = STATUS_LABELS[t.status] || STATUS_LABELS.pending
          return (
            <li
              key={t.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-xs text-slate-400">{t.task_date}</p>
              <p lang="zh-Hant" className="font-medium">
                {t.title_zh}
              </p>
              {t.title_id && (
                <p lang="id" className="text-sm text-slate-600">
                  {t.title_id}
                </p>
              )}
              <p className="mt-1 text-xs">
                {meta.icon} {effectiveIsHelper ? meta.id : meta.zh}
                {t.completed_at && ` · ${formatTimeHK(t.completed_at)}`}
              </p>
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="text-center text-slate-500">
            {effectiveIsHelper ? 'Belum ada riwayat' : '暫無記錄'}
          </li>
        )}
      </ul>
    </div>
  )
}

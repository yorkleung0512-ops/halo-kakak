import { useEffect, useState } from 'react'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { todayHK, STATUS_LABELS } from '../lib/constants'

export default function Calendar() {
  const { household, effectiveIsHelper } = useHousehold()
  const [date, setDate] = useState(todayHK())
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!household?.id) return
    supabase
      .from('task_occurrences')
      .select('id, title_zh, title_id, status, due_at')
      .eq('household_id', household.id)
      .eq('task_date', date)
      .is('deleted_at', null)
      .then(({ data }) => setTasks(data || []))
  }, [household?.id, date])

  return (
    <div className="space-y-4">
      <h1
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-lg font-bold text-slate-900"
      >
        {effectiveIsHelper ? 'Kalender' : '日曆'}
      </h1>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-200 px-3"
        aria-label={effectiveIsHelper ? 'Pilih tanggal' : '選擇日期'}
      />
      <ul className="space-y-2">
        {tasks.map((t) => {
          const meta = STATUS_LABELS[t.status] || STATUS_LABELS.pending
          return (
            <li
              key={t.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <p lang="zh-Hant" className="font-medium">
                {t.title_zh}
              </p>
              {t.title_id && (
                <p lang="id" className="text-sm text-slate-600">
                  {t.title_id}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                <span aria-hidden>{meta.icon}</span>{' '}
                {effectiveIsHelper ? meta.id : meta.zh}
              </p>
            </li>
          )
        })}
        {tasks.length === 0 && (
          <li className="text-center text-slate-500">
            {effectiveIsHelper ? 'Tidak ada tugas' : '呢日冇任務'}
          </li>
        )}
      </ul>
    </div>
  )
}

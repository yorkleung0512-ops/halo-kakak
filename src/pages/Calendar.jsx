import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { todayHK, STATUS_LABELS } from '../lib/constants'

export default function Calendar() {
  const { household, effectiveIsHelper } = useHousehold()
  const [date, setDate] = useState(todayHK())
  const [tasks, setTasks] = useState([])
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')
  const [templateInfo, setTemplateInfo] = useState(null)

  useEffect(() => {
    if (!household?.id) return
    supabase
      .from('task_occurrences')
      .select('id, title_zh, title_id, status, due_at, template_id')
      .eq('household_id', household.id)
      .eq('task_date', date)
      .is('deleted_at', null)
      .then(({ data }) => setTasks(data || []))
  }, [household?.id, date])

  useEffect(() => {
    if (!templateId) {
      setTemplateInfo(null)
      return
    }
    supabase
      .from('task_templates')
      .select('id, title_zh, title_id, recurrence_rule, is_active')
      .eq('id', templateId)
      .is('deleted_at', null)
      .maybeSingle()
      .then(({ data }) => setTemplateInfo(data || null))
  }, [templateId])

  return (
    <div className="space-y-4">
      <h1
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-lg font-bold text-slate-900"
      >
        {effectiveIsHelper ? 'Kalender' : '日曆'}
      </h1>
      {templateId && (
        <div
          role="status"
          lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
          className={`rounded-2xl border px-4 py-3 text-sm ${
            templateInfo
              ? 'border-teal-300 bg-teal-50 text-teal-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          {templateInfo ? (
            <>
              <p className="font-bold">
                {effectiveIsHelper ? 'Jadwal' : '排程'}：
                {effectiveIsHelper
                  ? templateInfo.title_id || templateInfo.title_zh
                  : templateInfo.title_zh}
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                {templateInfo.recurrence_rule}
                {templateInfo.is_active ? '' : effectiveIsHelper ? ' (nonaktif)' : '（已暫停）'}
              </p>
            </>
          ) : (
            <p>{effectiveIsHelper ? 'Jadwal tidak ditemukan' : '搵唔到呢個排程'}</p>
          )}
        </div>
      )}
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
          const hi = templateId && t.template_id === templateId
          return (
            <li
              key={t.id}
              id={`task-${t.id}`}
              className={`rounded-xl border bg-white px-4 py-3 ${
                hi ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200'
              }`}
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

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { todayHK, STATUS_LABELS } from '../lib/constants'
import TaskDetailSheet from '../components/today/TaskDetailSheet'
import { useTaskOccurrenceDetail } from '../hooks/useTaskOccurrenceDetail'

export default function Calendar() {
  const { user } = useAuth()
  const {
    household,
    effectiveIsHelper,
    canEditTasks,
    previewHelper,
  } = useHousehold()
  const [date, setDate] = useState(todayHK())
  const [tasks, setTasks] = useState([])
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')
  const deepTaskId = searchParams.get('task')
  const [templateInfo, setTemplateInfo] = useState(null)
  const {
    detailTask,
    detailTemplate,
    detailError,
    detailLoading,
    openTaskById,
    openTaskRow,
    closeDetail,
  } = useTaskOccurrenceDetail({ householdId: household?.id })

  useEffect(() => {
    if (!household?.id) return
    supabase
      .from('task_occurrences')
      .select(
        'id, title_zh, title_id, status, due_at, template_id, household_id, task_date, instructions_zh, instructions_id, additional_instructions_zh, additional_instructions_id, assigned_to, created_by, priority, version',
      )
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

  // Support /calendar?task= for shared open logic (notifications still use /?task=)
  useEffect(() => {
    if (!deepTaskId || !household?.id) return
    openTaskById(deepTaskId)
  }, [deepTaskId, household?.id, openTaskById])

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
                {templateInfo.is_active
                  ? ''
                  : effectiveIsHelper
                    ? ' (nonaktif)'
                    : '（已暫停）'}
              </p>
              <p className="mt-1 text-xs opacity-70">
                {effectiveIsHelper
                  ? 'Pratinjau jadwal (bukan occurrence). Ketuk tugas nyata di bawah untuk detail.'
                  : '排程預覽（唔係實例）。有真實任務先可以打開詳情。'}
              </p>
            </>
          ) : (
            <p>
              {effectiveIsHelper
                ? 'Jadwal tidak ditemukan'
                : '搵唔到呢個排程'}
            </p>
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
      {detailError && (
        <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {effectiveIsHelper ? 'Tugas tidak tersedia' : '搵唔到呢個任務'}
        </p>
      )}
      {detailLoading && !detailTask && (
        <p className="text-sm text-slate-500">
          {effectiveIsHelper ? 'Memuat…' : '載入中…'}
        </p>
      )}
      <ul className="space-y-2">
        {tasks.map((t) => {
          const meta = STATUS_LABELS[t.status] || STATUS_LABELS.pending
          const hi = templateId && t.template_id === templateId
          return (
            <li key={t.id}>
              <button
                type="button"
                id={`task-${t.id}`}
                onClick={() => openTaskRow(t)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-left ${
                  hi
                    ? 'border-teal-400 ring-2 ring-teal-100'
                    : 'border-slate-200'
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
              </button>
            </li>
          )
        })}
        {tasks.length === 0 && (
          <li className="text-center text-slate-500">
            {effectiveIsHelper ? 'Tidak ada tugas' : '呢日冇任務'}
          </li>
        )}
      </ul>

      <TaskDetailSheet
        open={!!detailTask}
        task={detailTask}
        onClose={closeDetail}
        isHelper={effectiveIsHelper}
        canEdit={canEditTasks && !previewHelper && !effectiveIsHelper}
        assigneeName={undefined}
        template={detailTemplate || undefined}
        currentUserId={user?.id}
        householdId={household?.id}
        queueScope={{
          userId: user?.id || null,
          householdId: household?.id || null,
        }}
      />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, formatTimeHK } from '../lib/constants'
import TaskDetailSheet from '../components/today/TaskDetailSheet'
import { useTaskOccurrenceDetail } from '../hooks/useTaskOccurrenceDetail'
import { getSessionEpoch, subscribeSessionEpoch } from '../lib/sessionEpoch'

export default function History() {
  const { user } = useAuth()
  const {
    household,
    effectiveIsHelper,
    canEditTasks,
    previewHelper,
  } = useHousehold()
  const [rows, setRows] = useState([])
  const [searchParams] = useSearchParams()
  const deepTaskId = searchParams.get('task')
  const loadGenRef = useRef(0)
  const hhIdRef = useRef(household?.id || null)
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
    hhIdRef.current = household?.id || null
  }, [household?.id])

  const clearLists = () => {
    loadGenRef.current += 1
    setRows([])
  }

  useEffect(() => {
    return subscribeSessionEpoch(() => {
      clearLists()
    })
  }, [])

  useEffect(() => {
    if (!user || !household?.id) {
      clearLists()
      return
    }
    loadGenRef.current += 1
    setRows([])
  }, [user?.id, household?.id])

  useEffect(() => {
    if (!user || !household?.id) return
    const gen = ++loadGenRef.current
    const expectedHh = household.id
    const epoch = getSessionEpoch()
    supabase
      .from('task_occurrences')
      .select(
        'id, title_zh, title_id, status, task_date, completed_at, updated_at, household_id, instructions_zh, instructions_id, additional_instructions_zh, additional_instructions_id, due_at, template_id, assigned_to, created_by, priority, version',
      )
      .eq('household_id', expectedHh)
      .is('deleted_at', null)
      .in('status', ['completed', 'cancelled', 'cannot_complete'])
      .order('task_date', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (gen !== loadGenRef.current) return
        if (hhIdRef.current !== expectedHh) return
        if (getSessionEpoch() !== epoch) return
        setRows(data || [])
      })
  }, [user?.id, household?.id])

  useEffect(() => {
    if (!deepTaskId || !household?.id) return
    openTaskById(deepTaskId)
  }, [deepTaskId, household?.id, openTaskById])

  return (
    <div className="space-y-4">
      <h1
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-lg font-bold"
      >
        {effectiveIsHelper ? 'Riwayat' : '記錄'}
      </h1>
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
        {rows.map((t) => {
          const meta = STATUS_LABELS[t.status] || STATUS_LABELS.pending
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openTaskRow(t)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left"
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
              </button>
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="text-center text-slate-500">
            {effectiveIsHelper ? 'Belum ada riwayat' : '暫無記錄'}
          </li>
        )}
      </ul>

      <TaskDetailSheet
        open={!!detailTask}
        task={detailTask}
        onClose={closeDetail}
        isHelper={effectiveIsHelper}
        canEdit={canEditTasks && !previewHelper && !effectiveIsHelper}
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

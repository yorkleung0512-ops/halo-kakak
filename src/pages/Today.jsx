import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { useNotifications } from '../lib/notificationsContext'
import { supabase } from '../lib/supabase'
import { OFFLINE_MSG, todayHK } from '../lib/constants'
import {
  enqueueMutation,
  flushQueue,
  peekQueue,
  pendingTaskIds,
} from '../lib/offlineQueue'
import {
  partitionTodayTasks,
  summarizeCounts,
  pickNextTask,
  helperHeroEmptyKind,
  unreadAssignedTaskIds,
  aggregateCommentCounts,
} from '../lib/todayClassify'
import {
  isLikelyOfflineError,
  isVersionConflictError,
} from '../lib/statusUpdateErrors'
import {
  fetchUnreadCommentSummary,
  unreadCommentTaskIdsFromSummary,
  markTaskCommentsRead,
} from '../lib/commentReads'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import AddTaskFlow from '../components/presets/AddTaskFlow'
import CustomTaskForm from '../components/presets/CustomTaskForm'
import QuickAddSection from '../components/presets/QuickAddSection'
import EditTaskModal from '../components/EditTaskModal'
import TodaySummaryStrip from '../components/today/TodaySummaryStrip'
import NeedsAttentionSection from '../components/today/NeedsAttentionSection'
import NewTasksSection from '../components/today/NewTasksSection'
import NextTaskHero from '../components/today/NextTaskHero'
import TodayTimeline from '../components/today/TodayTimeline'
import CompletedSection from '../components/today/CompletedSection'
import OverdueSection from '../components/today/OverdueSection'
import TaskDetailSheet from '../components/today/TaskDetailSheet'

const TASK_CHANNEL_PREFIX = 'halo-kakak-today-tasks-'

export default function Today() {
  const { user } = useAuth()
  const {
    household,
    glossary,
    ensureToday,
    effectiveIsHelper,
    canEditTasks,
    previewHelper,
  } = useHousehold()
  const { items: notifItems } = useNotifications()

  const [tasks, setTasks] = useState([])
  const [templatesById, setTemplatesById] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [unreadCommentTaskIds, setUnreadCommentTaskIds] = useState(() => new Set())
  const [assigneeNames, setAssigneeNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [toastOffline, setToastOffline] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [commentOpen, setCommentOpen] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [editTask, setEditTask] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [searchParams] = useSearchParams()
  const deepTaskId = searchParams.get('task')
  const deepCommentId = searchParams.get('comment')
  const channelRef = useRef(null)
  const tasksRef = useRef(tasks)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const queueScope = useMemo(
    () => ({
      userId: user?.id || null,
      householdId: household?.id || null,
    }),
    [user?.id, household?.id],
  )

  const refreshPending = useCallback(() => {
    setPendingCount(peekQueue(queueScope).length)
    setPendingIds(pendingTaskIds(queueScope))
  }, [queueScope])

  const showToast = useCallback((msg, offline = false) => {
    setToast(msg)
    setToastOffline(offline)
    setTimeout(() => setToast(''), 3200)
  }, [])

  const refreshUnreadComments = useCallback(async (hhId) => {
    if (!hhId) {
      setUnreadCommentTaskIds(new Set())
      return
    }
    const { rows, error } = await fetchUnreadCommentSummary(hhId, todayHK())
    if (error) return
    setUnreadCommentTaskIds(unreadCommentTaskIdsFromSummary(rows))
  }, [])

  const mergeTemplatesAndComments = useCallback(async (rows, hhId) => {
    const list = rows || []
    const templateIds = [
      ...new Set(list.map((t) => t.template_id).filter(Boolean)),
    ]
    const occurrenceIds = list.map((t) => t.id).filter(Boolean)

    const assigneeIds = [
      ...new Set(
        [
          ...list.map((t) => t.assigned_to).filter(Boolean),
          ...list.map((t) => t.created_by).filter(Boolean),
        ],
      ),
    ]

    const [tplRes, commentRes, profileRes, helperRes, unreadRes] =
      await Promise.all([
        templateIds.length
          ? supabase
              .from('task_templates')
              .select(
                'id, recurrence_rule, recurrence_weekdays, recurrence_interval, default_time, start_date, end_date, paused_at, is_active, title_zh, title_id',
              )
              .in('id', templateIds)
          : Promise.resolve({ data: [] }),
        occurrenceIds.length
          ? supabase
              .from('task_comments')
              .select('task_occurrence_id')
              .in('task_occurrence_id', occurrenceIds)
          : Promise.resolve({ data: [] }),
        assigneeIds.length
          ? supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', assigneeIds)
          : Promise.resolve({ data: [] }),
        hhId ? fetchActiveHelpers(hhId) : Promise.resolve([]),
        hhId
          ? fetchUnreadCommentSummary(hhId, todayHK())
          : Promise.resolve({ rows: [], error: null }),
      ])

    const tplMap = {}
    for (const t of tplRes.data || []) tplMap[t.id] = t
    setTemplatesById(tplMap)

    setCommentCounts(aggregateCommentCounts(commentRes.data || []))
    if (!unreadRes.error) {
      setUnreadCommentTaskIds(
        unreadCommentTaskIdsFromSummary(unreadRes.rows),
      )
    }

    const names = {}
    for (const p of profileRes.data || []) {
      names[p.id] = p.display_name || p.id.slice(0, 8)
    }
    for (const h of helperRes || []) {
      if (h.user_id && !names[h.user_id]) {
        names[h.user_id] = h.display_name
      }
    }
    setAssigneeNames(names)
  }, [])

  const loadTasks = useCallback(async () => {
    if (!household?.id) return
    setLoading(true)
    try {
      await ensureToday()
      const date = todayHK()
      const { data, error } = await supabase
        .from('task_occurrences')
        .select('*')
        .eq('household_id', household.id)
        .eq('task_date', date)
        .is('deleted_at', null)
        .order('due_at', { ascending: true, nullsFirst: false })

      if (error) {
        showToast(effectiveIsHelper ? 'Gagal memuat' : '載入失敗')
      } else {
        const rows = data || []
        setTasks(rows)
        await mergeTemplatesAndComments(rows, household.id)
      }
    } finally {
      setLoading(false)
      refreshPending()
    }
  }, [
    household?.id,
    ensureToday,
    showToast,
    effectiveIsHelper,
    mergeTemplatesAndComments,
    refreshPending,
  ])

  // Clear tasks when household changes
  useEffect(() => {
    setTasks([])
    setTemplatesById({})
    setCommentCounts({})
    setUnreadCommentTaskIds(new Set())
    setAssigneeNames({})
    setDetailTask(null)
    setEditTask(null)
  }, [household?.id])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    if (!deepTaskId || loading) return
    const el = document.getElementById(`task-${deepTaskId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const found = tasks.find((t) => t.id === deepTaskId)
    if (found) setDetailTask(found)
  }, [deepTaskId, loading, tasks])

  // Offline flush + visibility refetch
  useEffect(() => {
    refreshPending()
    async function onOnline() {
      const result = await flushQueue(async (m) => {
        if (m.type === 'update_task') {
          const { error } = await supabase.rpc('update_task_occurrence', {
            p_id: m.payload.id,
            p_expected_version: m.payload.version,
            p_patch: m.payload.patch,
          })
          if (error) throw error
          if (m.payload.comment) {
            await supabase.from('task_comments').insert({
              household_id: m.payload.household_id,
              task_occurrence_id: m.payload.id,
              user_id: user.id,
              message: m.payload.comment,
            })
          }
        } else if (m.type === 'mark_comments_read') {
          const { error } = await markTaskCommentsRead(
            m.payload.task_occurrence_id,
            m.payload.comment_ids,
          )
          if (error) throw error
        }
      }, queueScope)
      refreshPending()
      if (result.flushed) {
        showToast(effectiveIsHelper ? 'Tersinkron' : '已同步')
        loadTasks()
        if (household?.id) refreshUnreadComments(household.id)
      }
    }
    function onVis() {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadTasks()
        if (household?.id) refreshUnreadComments(household.id)
      }
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [
    user,
    showToast,
    effectiveIsHelper,
    loadTasks,
    queueScope,
    refreshPending,
    household?.id,
    refreshUnreadComments,
  ])

  // Realtime: task_occurrences (+ comments) for this household
  useEffect(() => {
    let cancelled = false
    async function setup() {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (!household?.id || cancelled) return

      const name = `${TASK_CHANNEL_PREFIX}${household.id}`
      const channel = supabase
        .channel(name)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'task_occurrences',
            filter: `household_id=eq.${household.id}`,
          },
          (payload) => {
            const date = todayHK()
            const row = payload.new || payload.old
            if (!row) return

            if (payload.eventType === 'DELETE' || row.deleted_at) {
              setTasks((prev) => prev.filter((t) => t.id !== row.id))
              return
            }

            // Only keep today's tasks in the list
            if (row.task_date && row.task_date !== date) {
              setTasks((prev) => prev.filter((t) => t.id !== row.id))
              return
            }

            setTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === row.id)
              if (idx === -1) {
                // Prefer higher version / newer
                return [...prev, row]
              }
              const cur = prev[idx]
              if (
                typeof row.version === 'number' &&
                typeof cur.version === 'number' &&
                row.version < cur.version
              ) {
                return prev
              }
              const next = [...prev]
              next[idx] = { ...cur, ...row }
              return next
            })
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'task_comments',
            filter: `household_id=eq.${household.id}`,
          },
          () => {
            const ids = tasksRef.current.map((t) => t.id)
            if (ids.length) {
              supabase
                .from('task_comments')
                .select('task_occurrence_id')
                .in('task_occurrence_id', ids)
                .then(({ data }) => {
                  setCommentCounts(aggregateCommentCounts(data || []))
                })
            }
            // Real unread state from receipts — not inference
            refreshUnreadComments(household.id)
          },
        )
        .on(
          'postgres_changes',
          user?.id
            ? {
                event: 'INSERT',
                schema: 'public',
                table: 'task_comment_reads',
                filter: `user_id=eq.${user.id}`,
              }
            : {
                event: 'INSERT',
                schema: 'public',
                table: 'task_comment_reads',
              },
          () => {
            refreshUnreadComments(household.id)
          },
        )
        .subscribe()

      channelRef.current = channel
    }
    setup()
    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [household?.id, user?.id, refreshUnreadComments])

  // When templates missing for newly inserted realtime rows, fetch them
  useEffect(() => {
    const missing = [
      ...new Set(
        tasks
          .map((t) => t.template_id)
          .filter((id) => id && !templatesById[id]),
      ),
    ]
    if (!missing.length) return
    let cancelled = false
    supabase
      .from('task_templates')
      .select(
        'id, recurrence_rule, recurrence_weekdays, recurrence_interval, default_time, start_date, end_date, paused_at, is_active, title_zh, title_id',
      )
      .in('id', missing)
      .then(({ data }) => {
        if (cancelled || !data?.length) return
        setTemplatesById((prev) => {
          const next = { ...prev }
          for (const t of data) next[t.id] = t
          return next
        })
      })
    return () => {
      cancelled = true
    }
  }, [tasks, templatesById])

  const unreadTaskIds = useMemo(
    () => unreadAssignedTaskIds(notifItems),
    [notifItems],
  )

  const classifyCtx = useMemo(
    () => ({
      isHelper: effectiveIsHelper,
      currentUserId: user?.id,
      unreadTaskIds,
      unreadCommentTaskIds,
      now: new Date(nowTick),
    }),
    [
      effectiveIsHelper,
      user?.id,
      unreadTaskIds,
      unreadCommentTaskIds,
      nowTick,
    ],
  )

  const sections = useMemo(
    () => partitionTodayTasks(tasks, classifyCtx),
    [tasks, classifyCtx],
  )

  const counts = useMemo(
    () => summarizeCounts(tasks, classifyCtx),
    [tasks, classifyCtx],
  )

  // Helper hero: pick from incomplete assigned tasks not in needs_attention / new_task
  const heroTask = useMemo(() => {
    if (!effectiveIsHelper) return null
    const exclude = new Set([
      ...sections.needs_attention.map((t) => t.id),
      ...sections.new_task.map((t) => t.id),
    ])
    const pool = tasks.filter(
      (t) =>
        !exclude.has(t.id) &&
        t.status !== 'completed' &&
        t.status !== 'cancelled',
    )
    return pickNextTask(pool, classifyCtx)
  }, [effectiveIsHelper, sections, tasks, classifyCtx])

  const heroEmptyKind = useMemo(
    () =>
      helperHeroEmptyKind({
        heroTask,
        tasks,
        sections,
      }),
    [heroTask, tasks, sections],
  )

  const timelineExcludeIds = useMemo(() => {
    const ids = new Set()
    for (const t of sections.needs_attention) ids.add(t.id)
    for (const t of sections.new_task) ids.add(t.id)
    if (!effectiveIsHelper) {
      for (const t of sections.overdue) ids.add(t.id)
    }
    if (heroTask?.id) ids.add(heroTask.id)
    return ids
  }, [sections, effectiveIsHelper, heroTask])

  const timelineTasks = useMemo(() => {
    // Employer: upcoming + later (overdue shown separately)
    // Helper: overdue + upcoming + later (hero excluded)
    if (effectiveIsHelper) {
      return [
        ...sections.overdue,
        ...sections.upcoming,
        ...sections.later,
      ]
    }
    return [...sections.upcoming, ...sections.later]
  }, [sections, effectiveIsHelper])

  async function applyStatus(task, action, comment) {
    const patch = { status: action.status }
    const run = async () => {
      const { data, error } = await supabase.rpc('update_task_occurrence', {
        p_id: task.id,
        p_expected_version: task.version,
        p_patch: patch,
      })
      if (error) throw error
      if (comment) {
        await supabase.from('task_comments').insert({
          household_id: household.id,
          task_occurrence_id: task.id,
          user_id: user.id,
          message: comment,
        })
      }
      return data
    }

    try {
      if (!navigator.onLine) throw new Error('offline')
      const updated = await run()
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      showToast(effectiveIsHelper ? 'Diperbarui' : '已更新')
    } catch (err) {
      if (isVersionConflictError(err)) {
        try {
          const { data: fresh } = await supabase
            .from('task_occurrences')
            .select('*')
            .eq('id', task.id)
            .maybeSingle()
          if (fresh) {
            setTasks((prev) =>
              prev.map((t) => (t.id === fresh.id ? fresh : t)),
            )
          }
        } catch {
          /* ignore refetch failure */
        }
        showToast(
          effectiveIsHelper
            ? 'Status berubah, coba lagi'
            : '狀態已變更，請重試',
          true,
        )
        return
      }

      if (isLikelyOfflineError(err)) {
        enqueueMutation(
          {
            type: 'update_task',
            payload: {
              id: task.id,
              version: task.version,
              patch,
              comment: comment || null,
              household_id: household.id,
            },
          },
          queueScope,
        )
        refreshPending()
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: action.status, version: t.version }
              : t,
          ),
        )
        showToast(
          effectiveIsHelper ? OFFLINE_MSG.id : OFFLINE_MSG.zh,
          true,
        )
        return
      }

      showToast(
        effectiveIsHelper
          ? 'Gagal memperbarui status'
          : '無法更新狀態，請稍後再試',
        true,
      )
    }
  }

  function onStatusAction(task, action) {
    if (previewHelper) {
      showToast('預覽模式：唔會儲存 / Pratinjau: tidak disimpan')
      return
    }
    if (action.needsComment) {
      setPendingAction({ task, action })
      setCommentText('')
      setCommentOpen(true)
      return
    }
    applyStatus(task, action, null)
  }

  async function confirmComment() {
    if (!pendingAction) return
    if (!commentText.trim()) return
    await applyStatus(pendingAction.task, pendingAction.action, commentText.trim())
    setCommentOpen(false)
    setPendingAction(null)
  }

  const cardShared = {
    assigneeNames,
    templatesById,
    commentCounts,
    pendingIds,
  }

  return (
    <div className="space-y-5 pb-4">
      {pendingCount > 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {effectiveIsHelper
            ? `Perubahan belum disinkronkan (${pendingCount})`
            : `變更尚未同步 (${pendingCount})`}
        </div>
      )}

      {!loading && (
        <TodaySummaryStrip
          counts={counts}
          isHelper={effectiveIsHelper}
        />
      )}

      {loading ? (
        <p className="text-center text-slate-500">…</p>
      ) : effectiveIsHelper ? (
        <>
          <NewTasksSection
            tasks={sections.new_task}
            deepTaskId={deepTaskId}
            canAct={!previewHelper}
            readOnly={previewHelper}
            onOpen={setDetailTask}
            onStatusAction={onStatusAction}
            unreadTaskIds={unreadTaskIds}
            {...cardShared}
          />

          <NeedsAttentionSection
            tasks={sections.needs_attention}
            isHelper
            deepTaskId={deepTaskId}
            canAct={!previewHelper}
            canEdit={false}
            readOnly={previewHelper}
            onOpen={setDetailTask}
            onStatusAction={onStatusAction}
            emptyHint={
              sections.needs_attention.length === 0
                ? 'Tidak ada masalah yang perlu ditangani hari ini'
                : null
            }
            {...cardShared}
          />

          <NextTaskHero
            task={heroTask}
            emptyKind={heroEmptyKind || 'all_done'}
            deepTaskId={deepTaskId}
            canAct={!previewHelper}
            readOnly={previewHelper}
            onOpen={setDetailTask}
            onStatusAction={onStatusAction}
            assigneeName={
              heroTask ? assigneeNames[heroTask.assigned_to] : undefined
            }
            template={
              heroTask?.template_id
                ? templatesById[heroTask.template_id]
                : undefined
            }
            commentCount={heroTask ? commentCounts[heroTask.id] || 0 : 0}
            unsynced={heroTask ? pendingIds.has(heroTask.id) : false}
            showNewBadge={false}
            hasUnreadNotif={
              heroTask ? unreadTaskIds.has(heroTask.id) : false
            }
          />

          <TodayTimeline
            tasks={timelineTasks}
            isHelper
            deepTaskId={deepTaskId}
            canAct={!previewHelper}
            canEdit={false}
            readOnly={previewHelper}
            onOpen={setDetailTask}
            onStatusAction={onStatusAction}
            excludeIds={timelineExcludeIds}
            unreadTaskIds={unreadTaskIds}
            {...cardShared}
          />

          <CompletedSection
            tasks={sections.completed}
            isHelper
            deepTaskId={deepTaskId}
            onOpen={setDetailTask}
            {...cardShared}
          />
        </>
      ) : (
        <>
          <NeedsAttentionSection
            tasks={sections.needs_attention}
            isHelper={false}
            deepTaskId={deepTaskId}
            canAct={false}
            canEdit={canEditTasks && !previewHelper}
            readOnly={previewHelper}
            onEdit={setEditTask}
            onOpen={setDetailTask}
            emptyHint={
              sections.needs_attention.length === 0
                ? '今日沒有需要處理的問題'
                : null
            }
            {...cardShared}
          />

          <OverdueSection
            tasks={sections.overdue}
            isHelper={false}
            deepTaskId={deepTaskId}
            canAct={false}
            canEdit={canEditTasks && !previewHelper}
            readOnly={previewHelper}
            onEdit={setEditTask}
            onOpen={setDetailTask}
            {...cardShared}
          />

          {canEditTasks && !previewHelper && household?.id && (
            <QuickAddSection
              householdId={household.id}
              userId={user.id}
              ensureToday={ensureToday}
              onCreated={loadTasks}
              onToast={showToast}
              onBrowseAll={() => setShowAdd(true)}
            />
          )}

          <div className="flex justify-end">
            {canEditTasks && !previewHelper && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                aria-label="新增任務"
                className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-teal-700 px-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <Plus className="h-4 w-4" aria-hidden />
                新增
              </button>
            )}
          </div>

          <TodayTimeline
            tasks={timelineTasks}
            isHelper={false}
            deepTaskId={deepTaskId}
            canAct={false}
            canEdit={canEditTasks && !previewHelper}
            readOnly={previewHelper}
            onEdit={setEditTask}
            onOpen={setDetailTask}
            excludeIds={timelineExcludeIds}
            {...cardShared}
          />

          <CompletedSection
            tasks={sections.completed}
            isHelper={false}
            deepTaskId={deepTaskId}
            onOpen={setDetailTask}
            {...cardShared}
          />

          {tasks.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
              今日未有任務 — 撳「新增」開始
            </p>
          )}
        </>
      )}

      <AddTaskFlow
        open={showAdd}
        onClose={() => setShowAdd(false)}
        householdId={household?.id}
        userId={user?.id}
        glossary={glossary}
        ensureToday={ensureToday}
        onCreated={loadTasks}
        onToast={showToast}
        customForm={
          <CustomTaskForm
            householdId={household?.id}
            userId={user?.id}
            glossary={glossary}
            ensureToday={ensureToday}
            previewHelper={previewHelper}
            onCancel={() => setShowAdd(false)}
            onToast={showToast}
            onCreated={() => {
              setShowAdd(false)
              loadTasks()
            }}
          />
        }
      />

      <Modal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        title={effectiveIsHelper ? 'Tambah catatan' : '留言'}
        labelledBy="comment-title"
      >
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2"
          placeholder={
            effectiveIsHelper
              ? 'Jelaskan masalahnya…'
              : '請說明情況…'
          }
        />
        <button
          type="button"
          onClick={confirmComment}
          className="w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white"
        >
          {effectiveIsHelper ? 'Kirim' : '送出'}
        </button>
      </Modal>

      <EditTaskModal
        open={!!editTask}
        task={editTask}
        onClose={() => setEditTask(null)}
        glossary={glossary}
        userId={user?.id}
        onToast={showToast}
        onSaved={(updated) => {
          if (updated?.id) {
            setTasks((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            )
          } else {
            loadTasks()
          }
        }}
      />

      <TaskDetailSheet
        open={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        isHelper={effectiveIsHelper}
        canEdit={canEditTasks && !previewHelper && !effectiveIsHelper}
        onEdit={setEditTask}
        assigneeName={
          detailTask ? assigneeNames[detailTask.assigned_to] : undefined
        }
        template={
          detailTask?.template_id
            ? templatesById[detailTask.template_id]
            : undefined
        }
        createdByName={
          detailTask?.created_by
            ? assigneeNames[detailTask.created_by]
            : undefined
        }
        currentUserId={user?.id}
        focusCommentId={
          detailTask && deepCommentId && detailTask.id === deepTaskId
            ? deepCommentId
            : null
        }
        householdId={household?.id}
        queueScope={queueScope}
        onCommentsRead={() => {
          if (household?.id) refreshUnreadComments(household.id)
        }}
      />

      <Toast message={toast} offline={toastOffline} />
    </div>
  )
}

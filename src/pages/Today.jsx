import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mic, MicOff, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { useNotifications } from '../lib/notificationsContext'
import { supabase } from '../lib/supabase'
import {
  OFFLINE_MSG,
  TRANSLATION_PRIVACY_NOTICE,
  POLICY_VERSION,
  todayHK,
  isHighRisk,
  HIGH_RISK_WARNING,
} from '../lib/constants'
import { translateViaEdge } from '../lib/translateClient'
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
  unreadAssignedTaskIds,
  aggregateCommentCounts,
} from '../lib/todayClassify'
import {
  fetchUnreadCommentSummary,
  unreadCommentTaskIdsFromSummary,
  markTaskCommentsRead,
} from '../lib/commentReads'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import AddTaskFlow from '../components/presets/AddTaskFlow'
import QuickAddSection from '../components/presets/QuickAddSection'
import EditTaskModal from '../components/EditTaskModal'
import AssigneePicker from '../components/presets/AssigneePicker'
import { fetchActiveHelpers } from '../lib/assignees'
import { createCustomTask, mapBatchError } from '../lib/presets'
import TodaySummaryStrip from '../components/today/TodaySummaryStrip'
import NeedsAttentionSection from '../components/today/NeedsAttentionSection'
import NewTasksSection from '../components/today/NewTasksSection'
import NextTaskHero from '../components/today/NextTaskHero'
import TodayTimeline from '../components/today/TodayTimeline'
import CompletedSection from '../components/today/CompletedSection'
import OverdueSection from '../components/today/OverdueSection'
import TaskDetailSheet from '../components/today/TaskDetailSheet'
import { useTaskOccurrenceDetail } from '../hooks/useTaskOccurrenceDetail'
import { getSessionEpoch, subscribeSessionEpoch } from '../lib/sessionEpoch'

const TASK_CHANNEL_PREFIX = 'hola-kakak-today-tasks-'

export default function Today() {
  const { user } = useAuth()
  const {
    household,
    glossary,
    ensureToday,
    effectiveIsHelper,
    canEditTasks,
    previewHelper,
    reload: reloadMemberships,
    verifyActiveMembership,
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
  const [formZh, setFormZh] = useState('')
  const [formId, setFormId] = useState('')
  const [formTime, setFormTime] = useState('09:00')
  const [formRecurrence, setFormRecurrence] = useState('none')
  const [formUrgent, setFormUrgent] = useState(false)
  const [formAddZh, setFormAddZh] = useState('')
  const [formAddId, setFormAddId] = useState('')
  const [formAssignedTo, setFormAssignedTo] = useState(null)
  const [helpers, setHelpers] = useState([])
  const [approveTranslation, setApproveTranslation] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [privacyOk, setPrivacyOk] = useState(false)
  const [listening, setListening] = useState(false)
  const [commentOpen, setCommentOpen] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [editTask, setEditTask] = useState(null)
  const [searchParams] = useSearchParams()
  const deepTaskId = searchParams.get('task')
  const deepCommentId = searchParams.get('comment')
  const {
    detailTask,
    setDetailTask,
    detailTemplate,
    detailError,
    detailLoading,
    openTaskById,
    closeDetail,
  } = useTaskOccurrenceDetail({ householdId: household?.id })
  const deepHandledRef = useRef(null)
  const loadGenRef = useRef(0)
  const channelRef = useRef(null)
  const tasksRef = useRef(tasks)
  const userIdRef = useRef(user?.id || null)
  const hhIdRef = useRef(household?.id || null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    userIdRef.current = user?.id || null
  }, [user?.id])
  useEffect(() => {
    hhIdRef.current = household?.id || null
  }, [household?.id])

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

  useEffect(() => {
    if (!showAdd || !household?.id) return
    fetchActiveHelpers(household.id).then((list) => {
      setHelpers(list)
      setFormAssignedTo((prev) =>
        prev || (list.length === 1 ? list[0].user_id : null),
      )
    })
  }, [showAdd, household?.id])

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
    const expectedHh = hhId
    const expectedUser = userIdRef.current
    const epoch = getSessionEpoch()
    const { rows, error } = await fetchUnreadCommentSummary(hhId, todayHK())
    if (error) return
    if (hhIdRef.current !== expectedHh) return
    if (userIdRef.current !== expectedUser) return
    if (getSessionEpoch() !== epoch) return
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

    // Stale-session guard: do not apply if user/household/epoch changed mid-flight
    if (hhIdRef.current !== hhId) return
    if (!userIdRef.current) return

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
    if (!household?.id || !user?.id) {
      setLoading(false)
      return
    }
    const gen = ++loadGenRef.current
    const expectedHh = household.id
    const expectedUser = user.id
    const epoch = getSessionEpoch()
    setLoading(true)
    try {
      await ensureToday()
      if (gen !== loadGenRef.current) return
      if (hhIdRef.current !== expectedHh || userIdRef.current !== expectedUser) return
      if (getSessionEpoch() !== epoch) return
      const date = todayHK()
      const { data, error } = await supabase
        .from('task_occurrences')
        .select('*')
        .eq('household_id', expectedHh)
        .eq('task_date', date)
        .is('deleted_at', null)
        .order('due_at', { ascending: true, nullsFirst: false })

      if (gen !== loadGenRef.current) return
      if (hhIdRef.current !== expectedHh || userIdRef.current !== expectedUser) return
      if (getSessionEpoch() !== epoch) return
      if (error) {
        showToast(effectiveIsHelper ? 'Gagal memuat' : '載入失敗')
      } else {
        const rows = data || []
        setTasks(rows)
        await mergeTemplatesAndComments(rows, expectedHh)
      }
    } finally {
      if (
        gen === loadGenRef.current &&
        hhIdRef.current === expectedHh &&
        userIdRef.current === expectedUser &&
        getSessionEpoch() === epoch
      ) {
        setLoading(false)
        refreshPending()
      }
    }
  }, [
    household?.id,
    user?.id,
    ensureToday,
    showToast,
    effectiveIsHelper,
    mergeTemplatesAndComments,
    refreshPending,
  ])

  const wipeTodayState = useCallback(() => {
    setTasks([])
    setTemplatesById({})
    setCommentCounts({})
    setUnreadCommentTaskIds(new Set())
    setAssigneeNames({})
    setDetailTask(null)
    setEditTask(null)
    setPendingCount(0)
    setPendingIds(new Set())
    deepHandledRef.current = null
    loadGenRef.current += 1
  }, [setDetailTask])

  // Clear tasks when household/user changes (do not switch HH via deep link)
  useEffect(() => {
    wipeTodayState()
  }, [household?.id, user?.id, wipeTodayState])

  useEffect(() => subscribeSessionEpoch(() => wipeTodayState()), [wipeTodayState])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Deep link: resolve occurrence by ID (not limited to today's list)
  useEffect(() => {
    if (!deepTaskId) {
      deepHandledRef.current = null
      return
    }
    if (loading) return
    if (deepHandledRef.current === deepTaskId && detailTask?.id === deepTaskId) {
      return
    }
    let cancelled = false
    ;(async () => {
      const found = tasks.find((t) => t.id === deepTaskId) || null
      const result = await openTaskById(deepTaskId, { fromList: found })
      if (cancelled) return
      deepHandledRef.current = deepTaskId
      if (found) {
        document
          .getElementById(`task-${deepTaskId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      if (!result.ok && result.reason !== 'stale') {
        showToast(
          effectiveIsHelper
            ? 'Tugas tidak tersedia'
            : '搵唔到呢個任務',
        )
        closeDetail()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    deepTaskId,
    loading,
    tasks,
    openTaskById,
    closeDetail,
    showToast,
    effectiveIsHelper,
    detailTask?.id,
  ])

  // Offline flush + visibility refetch
  useEffect(() => {
    refreshPending()
    async function onOnline() {
      const { data: authData } = await supabase.auth.getUser()
      const authed = authData?.user
      if (!authed || !user?.id || authed.id !== user.id) {
        refreshPending()
        return
      }
      // Revalidate active membership for this household before any replay.
      // Fail closed: leave items in queue (no false-success toast).
      let membershipOk = false
      try {
        const vr = await verifyActiveMembership(household?.id, user.id)
        membershipOk = !!vr?.ok
        if (membershipOk) {
          await reloadMemberships()
        }
      } catch {
        membershipOk = false
      }
      if (!membershipOk || !household?.id) {
        refreshPending()
        return
      }
      const result = await flushQueue(async (m) => {
        // Re-check auth inside each mutation so late/stale sessions fail closed
        const { data: again } = await supabase.auth.getUser()
        if (!again?.user || again.user.id !== user.id) {
          throw new Error('auth_mismatch')
        }
        // Queue ownership must match authenticated user (never infer).
        if (m.userId !== user.id) {
          throw new Error('queue_owner_mismatch')
        }
        if (m.householdId !== household.id) {
          throw new Error('queue_household_mismatch')
        }
        const mem = await verifyActiveMembership(m.householdId, user.id)
        if (!mem?.ok) {
          throw new Error(mem?.reason || 'membership_invalid')
        }
        if (m.type === 'update_task') {
          const { error } = await supabase.rpc('update_task_occurrence', {
            p_id: m.payload.id,
            p_expected_version: m.payload.version,
            p_patch: m.payload.patch,
          })
          if (error) throw error
          if (m.payload.comment) {
            await supabase.from('task_comments').insert({
              household_id: m.payload.household_id || m.householdId,
              task_occurrence_id: m.payload.id,
              user_id: again.user.id,
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
    reloadMemberships,
    verifyActiveMembership,
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
            if (hhIdRef.current !== household.id) return
            if (userIdRef.current !== user?.id) return
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
            if (hhIdRef.current !== household.id) return
            if (userIdRef.current !== user?.id) return
            const boundHh = household.id
            const boundUser = user?.id
            const ids = tasksRef.current.map((t) => t.id)
            if (ids.length) {
              supabase
                .from('task_comments')
                .select('task_occurrence_id')
                .in('task_occurrence_id', ids)
                .then(({ data }) => {
                  if (hhIdRef.current !== boundHh) return
                  if (userIdRef.current !== boundUser) return
                  setCommentCounts(aggregateCommentCounts(data || []))
                })
            }
            // Real unread state from receipts — not inference
            refreshUnreadComments(boundHh)
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
            if (hhIdRef.current !== household.id) return
            if (userIdRef.current !== user?.id) return
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
      if (err.message !== 'offline' && !String(err.message).includes('Failed')) {
        /* version conflict etc. */
      }
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

  async function doTranslate() {
    if (!privacyOk) {
      showToast('請先同意翻譯私隱提示')
      return
    }
    if (!formZh.trim()) return
    setTranslating(true)
    try {
      await supabase.from('privacy_consents').upsert(
        {
          user_id: user.id,
          policy_version: POLICY_VERSION,
          consent_type: 'translation',
        },
        { onConflict: 'user_id,policy_version,consent_type' },
      )
      const { translated } = await translateViaEdge(formZh, glossary)
      setFormId(translated)
      setApproveTranslation(false)
    } catch {
      showToast('翻譯失敗，請稍後再試')
    } finally {
      setTranslating(false)
    }
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      showToast('呢個瀏覽器唔支援語音輸入')
      return
    }
    const rec = new SR()
    rec.lang = 'zh-HK'
    rec.interimResults = false
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript
      setFormZh((prev) => (prev ? `${prev} ${text}` : text))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }

  async function onAddSubmit(e) {
    e.preventDefault()
    if (!formZh.trim() || !household?.id || previewHelper) return
    const { error } = await createCustomTask({
      householdId: household.id,
      draft: {
        title_zh: formZh.trim(),
        title_id: formId.trim(),
        additional_instructions_zh: formAddZh,
        additional_instructions_id: formAddId,
        time: formTime || null,
        date: todayHK(),
        recurrence_rule: formRecurrence,
        priority: formUrgent ? 'urgent' : 'normal',
        assigned_to: formAssignedTo || null,
        translation_approved: approveTranslation,
      },
    })
    if (error) {
      showToast(mapBatchError(error))
      return
    }
    if (formRecurrence !== 'none') {
      await ensureToday()
    }
    setShowAdd(false)
    setFormZh('')
    setFormId('')
    setFormAddZh('')
    setFormAddId('')
    setFormAssignedTo(null)
    setApproveTranslation(false)
    showToast('已新增')
    loadTasks()
  }

  const riskForm = isHighRisk(formZh)
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
        customForm={(
        <form onSubmit={onAddSubmit} className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p lang="zh-Hant">{TRANSLATION_PRIVACY_NOTICE.zh}</p>
            <p lang="id" className="mt-1">
              {TRANSLATION_PRIVACY_NOTICE.id}
            </p>
            <label className="mt-2 flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={privacyOk}
                onChange={(e) => setPrivacyOk(e.target.checked)}
              />
              <span>我明白 / Saya mengerti</span>
            </label>
          </div>

          <label className="block text-sm font-medium" htmlFor="task-zh">
            中文指示
          </label>
          <div className="flex gap-2">
            <textarea
              id="task-zh"
              value={formZh}
              onChange={(e) => setFormZh(e.target.value)}
              rows={2}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <button
              type="button"
              onClick={startVoice}
              aria-label={listening ? '停止語音輸入' : '廣東話語音輸入'}
              className={`min-h-11 min-w-11 shrink-0 rounded-xl border ${listening ? 'bg-rose-100 border-rose-300' : 'bg-white border-slate-200'}`}
            >
              {listening ? <MicOff className="mx-auto h-5 w-5" /> : <Mic className="mx-auto h-5 w-5" />}
            </button>
          </div>

          {riskForm && (
            <div role="alert" className="rounded-xl bg-amber-50 p-2 text-xs text-amber-950">
              <p lang="zh-Hant">{HIGH_RISK_WARNING.zh}</p>
              <p lang="id">{HIGH_RISK_WARNING.id}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={doTranslate}
              disabled={translating || !privacyOk}
              className="min-h-11 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 disabled:opacity-50"
            >
              {translating ? '…' : '翻譯成印尼文'}
            </button>
          </div>

          <label className="block text-sm font-medium" htmlFor="task-id">
            印尼文（可改）
          </label>
          <textarea
            id="task-id"
            lang="id"
            value={formId}
            onChange={(e) => {
              setFormId(e.target.value)
              setApproveTranslation(false)
            }}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={approveTranslation}
              onChange={(e) => setApproveTranslation(e.target.checked)}
            />
            我已核對印尼文（標記為已核准）
          </label>
          <p className="text-xs text-slate-500">
            機器翻譯唔保證正確 / Terjemahan mesin tidak dijamin akurat.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm" htmlFor="task-time">
                時間
              </label>
              <input
                id="task-time"
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3"
              />
            </div>
            <div>
              <label className="text-sm" htmlFor="task-rec">
                重複
              </label>
              <select
                id="task-rec"
                value={formRecurrence}
                onChange={(e) => setFormRecurrence(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3"
              >
                <option value="none">單次</option>
                <option value="daily">每日</option>
                <option value="weekdays">平日</option>
                <option value="weekly">每週</option>
                <option value="monthly">每月</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm" htmlFor="task-add-zh" lang="zh-Hant">
              補充指示
            </label>
            <textarea
              id="task-add-zh"
              lang="zh-Hant"
              rows={2}
              value={formAddZh}
              onChange={(e) => setFormAddZh(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-2 block text-sm" htmlFor="task-add-id" lang="id">
              Instruksi tambahan
            </label>
            <textarea
              id="task-add-id"
              lang="id"
              rows={2}
              value={formAddId}
              onChange={(e) => setFormAddId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <AssigneePicker
            id="task-assignee"
            helpers={helpers}
            value={formAssignedTo || ''}
            onChange={setFormAssignedTo}
          />

          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formUrgent}
              onChange={(e) => setFormUrgent(e.target.checked)}
            />
            緊急
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="min-h-11 flex-1 rounded-xl border border-slate-200"
            >
              取消
            </button>
            <button
              type="submit"
              className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white"
            >
              送出
            </button>
          </div>
        </form>
        )}
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

      {detailError && !detailTask && (
        <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {effectiveIsHelper ? 'Tugas tidak tersedia' : '搵唔到呢個任務'}
        </p>
      )}
      {detailLoading && !detailTask && deepTaskId && (
        <p role="status" className="text-sm text-slate-500">
          {effectiveIsHelper ? 'Memuat tugas…' : '載入任務中…'}
        </p>
      )}
      <TaskDetailSheet
        open={!!detailTask}
        task={detailTask}
        onClose={closeDetail}
        isHelper={effectiveIsHelper}
        canEdit={canEditTasks && !previewHelper && !effectiveIsHelper}
        onEdit={setEditTask}
        assigneeName={
          detailTask ? assigneeNames[detailTask.assigned_to] : undefined
        }
        template={
          detailTask?.template_id
            ? detailTemplate || templatesById[detailTask.template_id]
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

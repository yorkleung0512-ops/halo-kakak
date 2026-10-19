import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../Modal'
import { supabase } from '../../lib/supabase'
import {
  STATUS_LABELS,
  formatTimeHK,
  isHighRisk,
  HIGH_RISK_WARNING,
} from '../../lib/constants'
import { formatRecurrence } from '../../lib/recurrenceFormat'
import { isAdHoc, taskTypeBadge } from '../../lib/todayClassify'
import {
  markTaskCommentsRead,
  otherUsersCommentIds,
  buildMarkCommentsReadMutation,
} from '../../lib/commentReads'
import { enqueueMutation } from '../../lib/offlineQueue'

/**
 * Task detail sheet. Marks others' comments as read only after they are
 * loaded and rendered (or via explicit “mark all”). Realtime comments do
 * not auto-mark and do not steal focus.
 */
export default function TaskDetailSheet({
  open,
  task,
  onClose,
  isHelper,
  canEdit,
  onEdit,
  assigneeName,
  template,
  createdByName,
  currentUserId,
  focusCommentId = null,
  householdId = null,
  queueScope = null,
  onCommentsRead = null,
}) {
  const [comments, setComments] = useState([])
  const [events, setEvents] = useState([])
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [unreadLocal, setUnreadLocal] = useState(() => new Set())
  const [liveStatus, setLiveStatus] = useState('')
  const [marking, setMarking] = useState(false)
  const markedIdsRef = useRef(new Set())
  const focusDoneRef = useRef(null)
  const listRef = useRef(null)

  const lang = isHelper ? 'id' : 'zh'
  const newLabel = isHelper ? 'Komentar baru' : '新留言'
  const markAllLabel = isHelper
    ? 'Tandai semua sudah dibaca'
    : '全部標為已讀'

  const applyMarkResult = useCallback(
    (ids, remaining) => {
      if (ids?.length) {
        setUnreadLocal((prev) => {
          const next = new Set(prev)
          for (const id of ids) {
            next.delete(id)
            markedIdsRef.current.add(id)
          }
          return next
        })
      }
      onCommentsRead?.({
        taskId: task?.id,
        markedIds: ids || [],
        remainingUnread: remaining,
      })
    },
    [onCommentsRead, task?.id],
  )

  const markVisible = useCallback(
    async (ids) => {
      if (!task?.id || !ids?.length) return
      const toMark = ids.filter((id) => !markedIdsRef.current.has(id))
      if (!toMark.length) return
      setMarking(true)
      try {
        if (!navigator.onLine) {
          enqueueMutation(
            buildMarkCommentsReadMutation(task.id, toMark, householdId),
            queueScope || {},
          )
          // Optimistic local clear; server confirms later
          applyMarkResult(toMark, null)
          return
        }
        const result = await markTaskCommentsRead(task.id, toMark)
        if (result.error) throw result.error
        applyMarkResult(toMark, result.remaining_unread_count)
      } catch {
        enqueueMutation(
          buildMarkCommentsReadMutation(task.id, toMark, householdId),
          queueScope || {},
        )
        applyMarkResult(toMark, null)
      } finally {
        setMarking(false)
      }
    },
    [task?.id, householdId, queueScope, applyMarkResult],
  )

  const markAll = useCallback(async () => {
    if (!task?.id) return
    const ids = otherUsersCommentIds(comments, currentUserId)
    if (!ids.length) {
      // Still call RPC with null to sync remaining
      setMarking(true)
      try {
        if (navigator.onLine) {
          const result = await markTaskCommentsRead(task.id, null)
          if (!result.error) {
            applyMarkResult(ids, result.remaining_unread_count)
          }
        }
      } finally {
        setMarking(false)
      }
      return
    }
    await markVisible(ids)
  }, [task?.id, comments, currentUserId, markVisible, applyMarkResult])

  // Load comments + events when opened
  useEffect(() => {
    if (!open || !task?.id) {
      setComments([])
      setEvents([])
      setUnreadLocal(new Set())
      markedIdsRef.current = new Set()
      focusDoneRef.current = null
      setLiveStatus('')
      return
    }
    let cancelled = false
    async function load() {
      setLoadingExtra(true)
      const [cRes, eRes] = await Promise.all([
        supabase
          .from('task_comments')
          .select('id, user_id, message, created_at')
          .eq('task_occurrence_id', task.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('task_events')
          .select(
            'id, event_type, actor_id, previous_value, new_value, created_at',
          )
          .eq('task_occurrence_id', task.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      if (cancelled) return
      const list = cRes.data || []
      setComments(list)
      setEvents(eRes.data || [])
      const others = new Set(otherUsersCommentIds(list, currentUserId))
      setUnreadLocal(others)
      setLoadingExtra(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, task?.id, currentUserId])

  // After comments render: mark others' comments as read (once per open)
  useEffect(() => {
    if (!open || !task?.id || loadingExtra) return
    if (!comments.length || !currentUserId) return
    const ids = otherUsersCommentIds(comments, currentUserId).filter(
      (id) => !markedIdsRef.current.has(id),
    )
    if (!ids.length) return
    // Defer until after paint so “visible” is meaningful
    const t = requestAnimationFrame(() => {
      markVisible(ids)
    })
    return () => cancelAnimationFrame(t)
  }, [open, task?.id, loadingExtra, comments, currentUserId, markVisible])

  // Deep-link focus: scroll + highlight; do not steal focus on realtime
  useEffect(() => {
    if (!open || !focusCommentId || loadingExtra) return
    if (focusDoneRef.current === focusCommentId) return
    const el = document.getElementById(`comment-${focusCommentId}`)
    if (!el) return
    focusDoneRef.current = focusCommentId
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // User-initiated deep link may move focus to the target comment
    if (typeof el.focus === 'function') {
      try {
        el.focus({ preventScroll: true })
      } catch {
        el.focus()
      }
    }
  }, [open, focusCommentId, loadingExtra, comments])

  // Realtime: new comments on this task — append, announce politely, do NOT mark or steal focus
  useEffect(() => {
    if (!open || !task?.id) return
    const channel = supabase
      .channel(`task-detail-comments-${task.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: `task_occurrence_id=eq.${task.id}`,
        },
        (payload) => {
          const row = payload.new
          if (!row?.id) return
          setComments((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev
            return [...prev, row]
          })
          if (row.user_id && currentUserId && row.user_id !== currentUserId) {
            setUnreadLocal((prev) => new Set(prev).add(row.id))
            setLiveStatus(
              isHelper
                ? 'Ada komentar baru'
                : '有新留言',
            )
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, task?.id, currentUserId, isHelper])

  if (!task) return null

  const meta = STATUS_LABELS[task.status] || STATUS_LABELS.pending
  const typeLabel = taskTypeBadge(task, lang === 'id' ? 'id' : 'zh')
  const recurrence =
    template && !isAdHoc(task)
      ? formatRecurrence(template, lang === 'id' ? 'id' : 'zh')
      : ''
  const risk = isHighRisk(
    `${task.title_zh} ${task.instructions_zh || ''} ${task.additional_instructions_zh || ''}`,
  )
  const hasUnreadOthers = [...unreadLocal].some((id) =>
    comments.some((c) => c.id === id && c.user_id !== currentUserId),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isHelper ? 'Detail tugas' : '任務詳情'}
      labelledBy="task-detail-title"
    >
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold text-teal-700">
            {formatTimeHK(task.due_at) ||
              (isHelper ? 'Tanpa waktu' : '未定時間')}
            {' · '}
            <span lang={isHelper ? 'id' : 'zh-Hant'}>{typeLabel}</span>
          </p>
          <h3
            lang="zh-Hant"
            className="mt-1 text-base font-bold text-slate-900"
          >
            {task.title_zh}
          </h3>
          {task.title_id && (
            <p lang="id" className="text-slate-600">
              {task.title_id}
            </p>
          )}
        </div>

        <p lang={isHelper ? 'id' : 'zh-Hant'}>
          {isHelper ? 'Status: ' : '狀態：'}
          {isHelper ? meta.id : meta.zh}
          {task.priority && task.priority !== 'normal'
            ? ` · ${task.priority}`
            : ''}
        </p>

        {assigneeName && (
          <p lang={isHelper ? 'id' : 'zh-Hant'}>
            {isHelper ? 'Ditugaskan: ' : '指派：'}
            {assigneeName}
          </p>
        )}

        {createdByName && (
          <p
            className="text-xs text-slate-500"
            lang={isHelper ? 'id' : 'zh-Hant'}
          >
            {isHelper ? 'Dibuat oleh: ' : '建立者：'}
            {createdByName}
          </p>
        )}

        {(task.instructions_zh || task.instructions_id) && (
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500">
              {isHelper ? 'Instruksi' : '指示'}
            </p>
            {task.instructions_zh && (
              <p lang="zh-Hant" className="mt-1 text-slate-800">
                {task.instructions_zh}
              </p>
            )}
            {task.instructions_id && (
              <p lang="id" className="mt-1 text-slate-700">
                {task.instructions_id}
              </p>
            )}
          </div>
        )}

        {(task.additional_instructions_zh ||
          task.additional_instructions_id) && (
          <div className="rounded-xl bg-teal-50 px-3 py-2">
            <p lang="zh-Hant" className="text-xs font-semibold text-teal-900">
              補充指示
            </p>
            {task.additional_instructions_zh && (
              <p lang="zh-Hant">{task.additional_instructions_zh}</p>
            )}
            {task.additional_instructions_id && (
              <p lang="id" className="mt-1">
                {task.additional_instructions_id}
              </p>
            )}
          </div>
        )}

        {recurrence && (
          <p lang={isHelper ? 'id' : 'zh-Hant'} className="text-slate-600">
            {recurrence}
          </p>
        )}

        {template && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {template.start_date && (
              <span>
                {isHelper ? 'Mulai: ' : '開始：'}
                {template.start_date}
              </span>
            )}
            {template.end_date && (
              <span>
                {isHelper ? 'Hingga: ' : '結束：'}
                {template.end_date}
              </span>
            )}
          </div>
        )}

        {task.template_id && (
          <Link
            to={`/calendar?template=${encodeURIComponent(task.template_id)}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <span lang={isHelper ? 'id' : 'zh-Hant'}>
              {isHelper ? 'Lihat jadwal' : '查看排程'}
            </span>
          </Link>
        )}

        {risk && (
          <div
            role="alert"
            className="rounded-xl bg-amber-50 p-2 text-xs text-amber-950"
          >
            <p lang="zh-Hant">{HIGH_RISK_WARNING.zh}</p>
            <p lang="id" className="mt-1">
              {HIGH_RISK_WARNING.id}
            </p>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h4
              lang={isHelper ? 'id' : 'zh-Hant'}
              className="text-xs font-bold text-slate-500"
            >
              {isHelper ? 'Komentar' : '留言'}
            </h4>
            {hasUnreadOthers && (
              <button
                type="button"
                onClick={markAll}
                disabled={marking}
                className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-teal-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                lang={isHelper ? 'id' : 'zh-Hant'}
              >
                {markAllLabel}
              </button>
            )}
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {liveStatus}
          </div>
          {loadingExtra && <p className="text-xs text-slate-400">…</p>}
          {!loadingExtra && comments.length === 0 && (
            <p className="text-xs text-slate-400">
              {isHelper ? 'Belum ada komentar' : '暫無留言'}
            </p>
          )}
          <ul ref={listRef} className="space-y-2">
            {comments.map((c) => {
              const isFocus = focusCommentId && c.id === focusCommentId
              const showNew =
                isFocus ||
                (unreadLocal.has(c.id) &&
                  c.user_id &&
                  c.user_id !== currentUserId)
              return (
                <li
                  key={c.id}
                  id={`comment-${c.id}`}
                  tabIndex={isFocus ? -1 : undefined}
                  className={`rounded-lg border px-2 py-1.5 text-xs ${
                    isFocus
                      ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-300'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  {showNew && (
                    <span
                      lang={isHelper ? 'id' : 'zh-Hant'}
                      className="mb-0.5 inline-block rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    >
                      {isHelper ? 'Baru' : '新'} · {newLabel}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap text-slate-800">
                    {c.message}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {c.created_at
                      ? new Date(c.created_at).toLocaleString('zh-HK', {
                          timeZone: 'Asia/Hong_Kong',
                        })
                      : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <h4
            lang={isHelper ? 'id' : 'zh-Hant'}
            className="mb-1 text-xs font-bold text-slate-500"
          >
            {isHelper ? 'Riwayat' : '事件紀錄'}
          </h4>
          {!loadingExtra && events.length === 0 && (
            <p className="text-xs text-slate-400">
              {isHelper ? 'Belum ada riwayat' : '暫無紀錄'}
            </p>
          )}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {events.map((ev) => (
              <li key={ev.id} className="text-[11px] text-slate-600">
                <span className="font-medium">{ev.event_type}</span>
                {' · '}
                {ev.created_at
                  ? new Date(ev.created_at).toLocaleString('zh-HK', {
                      timeZone: 'Asia/Hong_Kong',
                    })
                  : ''}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2 pt-2">
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose?.()
                onEdit(task)
              }}
              className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white"
            >
              編輯
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 font-semibold"
          >
            {isHelper ? 'Tutup' : '關閉'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

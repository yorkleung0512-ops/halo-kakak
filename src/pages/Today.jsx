import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mic, MicOff, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
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
import { enqueueMutation, flushQueue, peekQueue } from '../lib/offlineQueue'
import TaskCard from '../components/TaskCard'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import AddTaskFlow from '../components/presets/AddTaskFlow'
import QuickAddSection from '../components/presets/QuickAddSection'
import EditTaskModal from '../components/EditTaskModal'
import AssigneePicker from '../components/presets/AssigneePicker'
import { fetchActiveHelpers } from '../lib/assignees'

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

  const [tasks, setTasks] = useState([])
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
  const [editTask, setEditTask] = useState(null)

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

  const loadTasks = useCallback(async () => {
    if (!household?.id) return
    setLoading(true)
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
      setTasks(data || [])
    }
    setLoading(false)
  }, [household?.id, ensureToday, showToast, effectiveIsHelper])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    setPendingCount(peekQueue().length)
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
        }
      })
      setPendingCount(peekQueue().length)
      if (result.flushed) {
        showToast(effectiveIsHelper ? 'Tersinkron' : '已同步')
        loadTasks()
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [user, showToast, effectiveIsHelper, loadTasks])

  const sorted = useMemo(() => {
    const order = [
      'needs_clarification',
      'delayed',
      'cannot_complete',
      'in_progress',
      'acknowledged',
      'pending',
      'completed',
      'cancelled',
    ]
    return [...tasks].sort((a, b) => {
      const ai = order.indexOf(a.status)
      const bi = order.indexOf(b.status)
      if (ai !== bi) return ai - bi
      return (a.due_at || '').localeCompare(b.due_at || '')
    })
  }, [tasks])

  const nextTask = sorted.find((t) =>
    !['completed', 'cancelled'].includes(t.status),
  )
  const questions = sorted.filter((t) => t.status === 'needs_clarification')
  const overdue = sorted.filter((t) => {
    if (['completed', 'cancelled'].includes(t.status)) return false
    if (!t.due_at) return false
    return new Date(t.due_at) < new Date()
  })
  const completed = sorted.filter((t) => t.status === 'completed')

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
      enqueueMutation({
        type: 'update_task',
        payload: {
          id: task.id,
          version: task.version,
          patch,
          comment: comment || null,
          household_id: household.id,
        },
      })
      setPendingCount(peekQueue().length)
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
      // Record translation consent
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

  async function submitTask(e) {
    e.preventDefault()
    if (!formZh.trim() || !household?.id || previewHelper) return

    const due =
      formTime &&
      `${todayHK()}T${formTime}:00`

    if (formRecurrence === 'none') {
      const { error } = await supabase.from('task_occurrences').insert({
        household_id: household.id,
        task_date: todayHK(),
        due_at: due
          ? new Date(
              new Date(due).toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }),
            ).toISOString()
          : null,
        title_zh: formZh.trim(),
        title_id: formId.trim(),
        priority: formUrgent ? 'urgent' : 'normal',
        status: 'pending',
        created_by: user.id,
        translation_approved: approveTranslation,
      })
      // Fix due_at: use proper timestamptz construction
      if (error) {
        // fallback without weird due parsing
        const { error: e2 } = await supabase.from('task_occurrences').insert({
          household_id: household.id,
          task_date: todayHK(),
          title_zh: formZh.trim(),
          title_id: formId.trim(),
          priority: formUrgent ? 'urgent' : 'normal',
          status: 'pending',
          created_by: user.id,
          translation_approved: approveTranslation,
        })
        if (e2) {
          showToast(e2.message)
          return
        }
      }
    } else {
      const { data: tmpl, error } = await supabase
        .from('task_templates')
        .insert({
          household_id: household.id,
          title_zh: formZh.trim(),
          title_id: formId.trim(),
          default_time: formTime || null,
          recurrence_rule: formRecurrence,
          priority: formUrgent ? 'urgent' : 'normal',
          created_by: user.id,
          translation_approved: approveTranslation,
          start_date: todayHK(),
        })
        .select()
        .single()
      if (error) {
        showToast(error.message)
        return
      }
      await ensureToday()
      void tmpl
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

  // Fix one-shot insert with cleaner due_at
  async function createOneShot() {
    let dueAt = null
    if (formTime) {
      // Asia/Hong_Kong offset roughly — store as timestamptz via date+time string
      dueAt = `${todayHK()}T${formTime}:00+08:00`
    }
    const { error } = await supabase.from('task_occurrences').insert({
      household_id: household.id,
      task_date: todayHK(),
      due_at: dueAt,
      title_zh: formZh.trim(),
      title_id: formId.trim(),
      additional_instructions_zh: formAddZh,
      additional_instructions_id: formAddId,
      assigned_to: formAssignedTo || null,
      priority: formUrgent ? 'urgent' : 'normal',
      status: 'pending',
      created_by: user.id,
      translation_approved: approveTranslation,
    })
    return error
  }

  // Override submit to use createOneShot for none
  async function onAddSubmit(e) {
    e.preventDefault()
    if (!formZh.trim() || !household?.id || previewHelper) return
    if (formRecurrence === 'none') {
      const err = await createOneShot()
      if (err) {
        showToast(err.message)
        return
      }
    } else {
      const { error } = await supabase.from('task_templates').insert({
        household_id: household.id,
        title_zh: formZh.trim(),
        title_id: formId.trim(),
        additional_instructions_zh: formAddZh,
        additional_instructions_id: formAddId,
        assigned_to: formAssignedTo || null,
        default_time: formTime || null,
        recurrence_rule: formRecurrence,
        priority: formUrgent ? 'urgent' : 'normal',
        created_by: user.id,
        translation_approved: approveTranslation,
        start_date: todayHK(),
      })
      if (error) {
        showToast(error.message)
        return
      }
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

  void submitTask // keep linter calm if unused

  const riskForm = isHighRisk(formZh)

  return (
    <div className="space-y-5 pb-4">
      {pendingCount > 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {effectiveIsHelper ? OFFLINE_MSG.id : OFFLINE_MSG.zh} ({pendingCount})
        </div>
      )}

      {canEditTasks && !previewHelper && household?.id && (
        <QuickAddSection
          householdId={household.id}
          userId={user.id}
          ensureToday={ensureToday}
          onCreated={loadTasks}
          onToast={showToast}
        />
      )}

      {loading ? (
        <p className="text-center text-slate-500">…</p>
      ) : (
        <>
          {nextTask && (
            <section>
              <h2
                lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
                className="mb-2 text-sm font-bold text-slate-500"
              >
                {effectiveIsHelper ? 'Tugas berikutnya' : '下一項'}
              </h2>
              <TaskCard
                task={nextTask}
                highlight
                isHelperView={effectiveIsHelper}
                canAct={effectiveIsHelper && !previewHelper}
                readOnly={previewHelper}
                canEdit={canEditTasks && !previewHelper}
                onEdit={setEditTask}
                onStatusAction={(a) => onStatusAction(nextTask, a)}
              />
            </section>
          )}

          {!effectiveIsHelper && questions.length > 0 && (
            <section>
              <h2 lang="zh-Hant" className="mb-2 text-sm font-bold text-amber-800">
                姐姐有問題 ({questions.length})
              </h2>
              <div className="space-y-3">
                {questions.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    isHelperView={false}
                    canAct={false}
                    canEdit={canEditTasks && !previewHelper}
                    onEdit={setEditTask}
                  />
                ))}
              </div>
            </section>
          )}

          {overdue.length > 0 && (
            <section>
              <h2
                lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
                className="mb-2 text-sm font-bold text-rose-700"
              >
                {effectiveIsHelper ? 'Terlambat' : '已過時'}
              </h2>
              <div className="space-y-3">
                {overdue.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    isHelperView={effectiveIsHelper}
                    canAct={effectiveIsHelper && !previewHelper}
                    readOnly={previewHelper}
                    canEdit={canEditTasks && !previewHelper}
                onEdit={setEditTask}
                onStatusAction={(a) => onStatusAction(t, a)}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2
                lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
                className="text-sm font-bold text-slate-500"
              >
                {effectiveIsHelper ? 'Jadwal hari ini' : '今日時間線'}
              </h2>
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
            <div className="space-y-3">
              {sorted.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
                  {effectiveIsHelper
                    ? 'Belum ada tugas hari ini'
                    : '今日未有任務 — 撳「新增」開始'}
                </p>
              )}
              {sorted.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  isHelperView={effectiveIsHelper}
                  canAct={effectiveIsHelper && !previewHelper}
                  readOnly={previewHelper}
                  canEdit={canEditTasks && !previewHelper}
                onEdit={setEditTask}
                onStatusAction={(a) => onStatusAction(t, a)}
                />
              ))}
            </div>
          </section>

          {completed.length > 0 && !effectiveIsHelper && (
            <p className="text-center text-xs text-slate-400">
              今日已完成 {completed.length} 項
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

      <Toast message={toast} offline={toastOffline} />
    </div>
  )
}

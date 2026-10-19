import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { translateViaEdge } from '../lib/translateClient'
import {
  HIGH_RISK_WARNING,
  POLICY_VERSION,
  isHighRisk,
  todayHK,
} from '../lib/constants'
import { fetchActiveHelpers } from '../lib/assignees'
import AssigneePicker from './presets/AssigneePicker'
import RecurrenceFields from './presets/RecurrenceFields'
import { EDIT_SCOPES, mapBatchError } from '../lib/presets'

function dueToTime(dueAt) {
  if (!dueAt) return ''
  try {
    const d = new Date(dueAt)
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const h = parts.find((p) => p.type === 'hour')?.value || '09'
    const m = parts.find((p) => p.type === 'minute')?.value || '00'
    return `${h}:${m}`
  } catch {
    return ''
  }
}

/**
 * Employer edit modal — scoped edit for recurring (只修改今次 / 今次及之後 / 整個排程).
 * Preserves completed history; audits via task_events (RPC).
 */
export default function EditTaskModal({
  open,
  task,
  onClose,
  onSaved,
  onToast,
  glossary,
  userId,
  updateSchedule = true,
}) {
  const [titleZh, setTitleZh] = useState('')
  const [titleId, setTitleId] = useState('')
  const [instrZh, setInstrZh] = useState('')
  const [instrId, setInstrId] = useState('')
  const [addZh, setAddZh] = useState('')
  const [addId, setAddId] = useState('')
  const [assignedTo, setAssignedTo] = useState(null)
  const [helpers, setHelpers] = useState([])
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('normal')
  const [approved, setApproved] = useState(false)
  const [zhEdited, setZhEdited] = useState(false)
  const [scope, setScope] = useState('this_only')
  const [templateMeta, setTemplateMeta] = useState(null)
  const [recurrence, setRecurrence] = useState({
    recurrence_rule: 'daily',
    recurrence_weekdays: null,
    recurrence_interval: 1,
    start_date: '',
    end_date: null,
    neverEnds: true,
  })
  const [paused, setPaused] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !task) return
    setTitleZh(task.title_zh || '')
    setTitleId(task.title_id || '')
    setInstrZh(task.instructions_zh || '')
    setInstrId(task.instructions_id || '')
    setAddZh(task.additional_instructions_zh || '')
    setAddId(task.additional_instructions_id || '')
    setAssignedTo(task.assigned_to || null)
    fetchActiveHelpers(task.household_id).then(setHelpers)
    setTime(dueToTime(task.due_at))
    setPriority(task.priority || 'normal')
    setApproved(!!task.translation_approved)
    setZhEdited(false)
    setScope('this_only')
    setTemplateMeta(null)
    setPaused(false)
    if (task.template_id) {
      supabase
        .from('task_templates')
        .select(
          'id, recurrence_rule, recurrence_weekdays, recurrence_interval, default_time, title_zh, start_date, end_date, paused_at, is_active',
        )
        .eq('id', task.template_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setTemplateMeta(data)
            setPaused(!!data.paused_at)
            setRecurrence({
              recurrence_rule: data.recurrence_rule || 'daily',
              recurrence_weekdays: data.recurrence_weekdays,
              recurrence_interval: data.recurrence_interval || 1,
              start_date: data.start_date || task.task_date || todayHK(),
              end_date: data.end_date,
              neverEnds: !data.end_date,
            })
          }
        })
    }
  }, [open, task])

  if (!task) return null

  const risk = isHighRisk(`${titleZh} ${instrZh}`)
  const isRecurring = !!task.template_id && !!templateMeta

  async function doTranslate() {
    if (!titleZh.trim()) return
    setTranslating(true)
    try {
      await supabase.from('privacy_consents').upsert(
        {
          user_id: userId,
          policy_version: POLICY_VERSION,
          consent_type: 'translation',
        },
        { onConflict: 'user_id,policy_version,consent_type' },
      )
      const { translated } = await translateViaEdge(titleZh, glossary)
      setTitleId(translated)
      setApproved(false)
    } catch {
      onToast?.('翻譯失敗，請稍後再試')
    } finally {
      setTranslating(false)
    }
  }

  async function togglePause() {
    if (!task.template_id) return
    const next = !paused
    const { error } = await supabase.rpc('set_task_template_paused', {
      p_template_id: task.template_id,
      p_paused: next,
    })
    if (error) {
      onToast?.(mapBatchError(error) || error.message)
      return
    }
    setPaused(next)
    onToast?.(next ? '已暫停排程' : '已恢復排程')
  }

  async function save() {
    if (!titleZh.trim()) return
    setSaving(true)
    const dueAt = time ? `${task.task_date || todayHK()}T${time}:00+08:00` : null
    const patch = {
      title_zh: titleZh.trim(),
      title_id: titleId.trim(),
      instructions_zh: instrZh,
      instructions_id: instrId,
      additional_instructions_zh: addZh,
      additional_instructions_id: addId,
      assigned_to: assignedTo,
      priority,
      due_at: dueAt,
      due_time: time || null,
      translation_approved: approved,
    }

    if (
      updateSchedule &&
      isRecurring &&
      (scope === 'this_and_future' || scope === 'entire_series')
    ) {
      patch.recurrence_rule = recurrence.recurrence_rule
      patch.recurrence_interval = recurrence.recurrence_interval || 1
      if (recurrence.recurrence_weekdays?.length) {
        patch.recurrence_weekdays = recurrence.recurrence_weekdays
      }
      patch.end_date = recurrence.neverEnds ? null : recurrence.end_date || null
    }

    if (isRecurring) {
      const { data, error } = await supabase.rpc('edit_task_occurrence_scoped', {
        p_id: task.id,
        p_expected_version: task.version,
        p_scope: scope,
        p_patch: patch,
      })
      setSaving(false)
      if (error) {
        onToast?.(mapBatchError(error) || error.message)
        return
      }
      onToast?.(
        scope === 'this_only'
          ? '已更新今次'
          : scope === 'this_and_future'
            ? `已更新今次及之後（${data?.future_updated || 0}）`
            : `已更新整個排程（${data?.future_updated || 0}）`,
      )
      onSaved?.(data?.occurrence || data)
      onClose?.()
      return
    }

    const { data, error } = await supabase.rpc('update_task_occurrence', {
      p_id: task.id,
      p_expected_version: task.version,
      p_patch: patch,
    })
    setSaving(false)
    if (error) {
      onToast?.(error.message)
      return
    }
    onToast?.('已儲存')
    onSaved?.(data)
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="編輯任務"
      labelledBy="edit-task-title"
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="edit-zh">
          中文指示
        </label>
        <textarea
          id="edit-zh"
          lang="zh-Hant"
          rows={2}
          value={titleZh}
          onChange={(e) => {
            setTitleZh(e.target.value)
            setZhEdited(true)
            setApproved(false)
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        <label className="block text-sm font-medium" htmlFor="edit-instr-zh">
          詳細說明（中文）
        </label>
        <textarea
          id="edit-instr-zh"
          lang="zh-Hant"
          rows={2}
          value={instrZh}
          onChange={(e) => {
            setInstrZh(e.target.value)
            setZhEdited(true)
            setApproved(false)
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        {zhEdited && (
          <button
            type="button"
            onClick={doTranslate}
            disabled={translating}
            className="min-h-11 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 disabled:opacity-50"
          >
            {translating ? '…' : '重新翻譯'}
          </button>
        )}

        <label className="block text-sm font-medium" htmlFor="edit-id">
          Bahasa Indonesia
        </label>
        <textarea
          id="edit-id"
          lang="id"
          rows={2}
          value={titleId}
          onChange={(e) => {
            setTitleId(e.target.value)
            setApproved(false)
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        <label className="block text-sm font-medium" htmlFor="edit-instr-id">
          Detail (Indonesia)
        </label>
        <textarea
          id="edit-instr-id"
          lang="id"
          rows={2}
          value={instrId}
          onChange={(e) => {
            setInstrId(e.target.value)
            setApproved(false)
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        <label className="block text-sm font-medium" htmlFor="edit-add-zh" lang="zh-Hant">
          補充指示
        </label>
        <textarea
          id="edit-add-zh"
          lang="zh-Hant"
          rows={2}
          value={addZh}
          onChange={(e) => setAddZh(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <label className="block text-sm font-medium" htmlFor="edit-add-id" lang="id">
          Instruksi tambahan
        </label>
        <textarea
          id="edit-add-id"
          lang="id"
          rows={2}
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        <AssigneePicker
          id="edit-assignee"
          helpers={helpers}
          value={assignedTo || ''}
          onChange={setAssignedTo}
        />

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          我已核對印尼文（標記為已核准）
        </label>

        {risk && (
          <div role="alert" className="rounded-xl bg-amber-50 p-2 text-xs text-amber-950">
            <p lang="zh-Hant">{HIGH_RISK_WARNING.zh}</p>
            <p lang="id">{HIGH_RISK_WARNING.id}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm" htmlFor="edit-time">
              選擇時間
            </label>
            <input
              id="edit-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3"
            />
          </div>
          <div>
            <label className="text-sm" htmlFor="edit-pri">
              優先
            </label>
            <select
              id="edit-pri"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3"
            >
              <option value="low">低</option>
              <option value="normal">普通</option>
              <option value="high">高</option>
              <option value="urgent">緊急</option>
            </select>
          </div>
        </div>

        {isRecurring && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p lang="zh-Hant" className="text-sm font-bold text-slate-800">
              修改範圍
              <span lang="id" className="ml-1 font-normal text-slate-500">
                / Cakupan suntingan
              </span>
            </p>
            <div className="space-y-1">
              {EDIT_SCOPES.map((s) => (
                <label
                  key={s.value}
                  className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                    scope === s.value
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-scope"
                    value={s.value}
                    checked={scope === s.value}
                    onChange={() => setScope(s.value)}
                    className="mt-1"
                  />
                  <span>
                    <span lang="zh-Hant" className="font-semibold">
                      {s.zh}
                    </span>
                    <span lang="id" className="mt-0.5 block text-xs text-slate-600">
                      {s.id}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500" lang="zh-Hant">
              已完成嘅日子唔會被改動；歷史會保留，並寫入 task_events。
            </p>

            {(scope === 'this_and_future' || scope === 'entire_series') && (
              <RecurrenceFields
                idPrefix="edit-rec"
                {...recurrence}
                onChange={(p) => setRecurrence((r) => ({ ...r, ...p }))}
              />
            )}

            <button
              type="button"
              onClick={togglePause}
              className={`min-h-11 w-full rounded-xl border text-sm font-semibold ${
                paused
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
            >
              {paused ? '恢復排程 / Lanjutkan' : '暫停排程 / Jeda jadwal'}
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || !titleZh.trim()}
            onClick={save}
            className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-50"
          >
            {saving ? '…' : '儲存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

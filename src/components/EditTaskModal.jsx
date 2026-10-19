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
 * Employer edit modal for a task_occurrence (and optional linked task_template).
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
  const [recurrence, setRecurrence] = useState('daily')
  const [alsoTemplate, setAlsoTemplate] = useState(true)
  const [templateMeta, setTemplateMeta] = useState(null)
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
    setAlsoTemplate(true)
    setTemplateMeta(null)
    if (task.template_id) {
      supabase
        .from('task_templates')
        .select('id, recurrence_rule, default_time, title_zh')
        .eq('id', task.template_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setTemplateMeta(data)
            setRecurrence(data.recurrence_rule || 'daily')
          }
        })
    }
  }, [open, task])

  if (!task) return null

  const risk = isHighRisk(`${titleZh} ${instrZh}`)

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
      translation_approved: approved,
    }
    const { data, error } = await supabase.rpc('update_task_occurrence', {
      p_id: task.id,
      p_expected_version: task.version,
      p_patch: patch,
    })
    if (error) {
      setSaving(false)
      onToast?.(error.message)
      return
    }

    if (
      updateSchedule &&
      alsoTemplate &&
      task.template_id &&
      templateMeta
    ) {
      const { error: tErr } = await supabase
        .from('task_templates')
        .update({
          title_zh: titleZh.trim(),
          title_id: titleId.trim(),
          instructions_zh: instrZh,
          instructions_id: instrId,
          additional_instructions_zh: addZh,
          additional_instructions_id: addId,
          assigned_to: assignedTo,
          priority,
          default_time: time || null,
          recurrence_rule: recurrence,
          translation_approved: approved,
        })
        .eq('id', task.template_id)
      if (tErr) {
        onToast?.(`今日任務已更新，但排程更新失敗：${tErr.message}`)
        setSaving(false)
        onSaved?.(data)
        onClose?.()
        return
      }
    }

    setSaving(false)
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

        {task.template_id && templateMeta && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={alsoTemplate}
                onChange={(e) => setAlsoTemplate(e.target.checked)}
              />
              同時更新固定排程（之後日子）
            </label>
            {alsoTemplate && (
              <div>
                <label className="text-xs" htmlFor="edit-rec">
                  重複安排
                </label>
                <select
                  id="edit-rec"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
                >
                  <option value="daily">每日</option>
                  <option value="weekdays">平日</option>
                  <option value="weekly">每週</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
            )}
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

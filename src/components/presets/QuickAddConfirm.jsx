import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal'
import AssigneePicker from './AssigneePicker'
import {
  createTasksFromPresets,
  mapBatchError,
  mapRecurrence,
} from '../../lib/presets'
import { todayHK } from '../../lib/constants'
import { fetchActiveHelpers } from '../../lib/assignees'

export default function QuickAddConfirm({
  open,
  preset,
  householdId,
  userId: _userId,
  ensureToday: _ensureToday,
  onClose,
  onCreated,
  onToast,
}) {
  const [mode, setMode] = useState('adhoc')
  const [busy, setBusy] = useState(false)
  const [helpers, setHelpers] = useState([])
  const [assignedTo, setAssignedTo] = useState(null)
  const idempotencyKeyRef = useRef(null)

  useEffect(() => {
    if (!open || !householdId) return
    idempotencyKeyRef.current = crypto.randomUUID()
    setMode('adhoc')
    setBusy(false)
    fetchActiveHelpers(householdId).then((list) => {
      setHelpers(list)
      setAssignedTo(list.length === 1 ? list[0].user_id : null)
    })
  }, [open, householdId, preset?.id])

  if (!preset) return null

  async function confirm() {
    if (busy) return
    setBusy(true)
    const mapped = mapRecurrence(preset.suggested_recurrence)
    const time = (preset.suggested_time || '').toString().slice(0, 5) || '09:00'
    const key = idempotencyKeyRef.current || crypto.randomUUID()
    const { error } = await createTasksFromPresets({
      householdId,
      idempotencyKey: key,
      items: [
        {
          preset,
          draft: {
            mode,
            date: todayHK(),
            time,
            recurrence_rule:
              mode === 'adhoc' ? 'none' : mapped.recurrence_rule || 'daily',
            recurrence_weekdays: mapped.recurrence_weekdays,
            priority: preset.suggested_priority || 'normal',
            title_zh: preset.title_zh,
            title_id: preset.title_id,
            instructions_zh: preset.instructions_zh,
            instructions_id: preset.instructions_id,
            additional_instructions_zh: '',
            additional_instructions_id: '',
            assigned_to: assignedTo,
            translation_approved: preset.translation_approved !== false,
          },
        },
      ],
    })
    setBusy(false)
    if (error) {
      onToast?.(mapBatchError(error))
      return
    }
    onToast?.('已新增')
    onCreated?.()
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="快速新增"
      labelledBy="quick-add-title"
    >
      <p lang="zh-Hant" className="mb-1 font-semibold">
        {preset.title_zh}
      </p>
      <p lang="id" className="mb-3 text-sm text-slate-600">
        {preset.title_id}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={mode === 'adhoc'}
          onClick={() => setMode('adhoc')}
          className={`min-h-11 rounded-xl border text-sm font-semibold ${
            mode === 'adhoc' ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
          }`}
        >
          今日一次
        </button>
        <button
          type="button"
          aria-pressed={mode === 'scheduled'}
          onClick={() => setMode('scheduled')}
          className={`min-h-11 rounded-xl border text-sm font-semibold ${
            mode === 'scheduled'
              ? 'border-teal-600 bg-teal-50'
              : 'border-slate-200'
          }`}
        >
          設為固定工作
        </button>
      </div>
      <div className="mb-3">
        <AssigneePicker
          id="quick-assignee"
          helpers={helpers}
          value={assignedTo || ''}
          onChange={setAssignedTo}
          disabled={busy}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          aria-busy={busy}
          className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-50"
        >
          {busy ? '正在建立任務…' : '確認'}
        </button>
      </div>
    </Modal>
  )
}

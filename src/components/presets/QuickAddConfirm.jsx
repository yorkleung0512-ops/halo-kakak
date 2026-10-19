import { useState } from 'react'
import Modal from '../Modal'
import { createFromPreset, mapRecurrence } from '../../lib/presets'
import { todayHK } from '../../lib/constants'

export default function QuickAddConfirm({
  open,
  preset,
  householdId,
  userId,
  ensureToday,
  onClose,
  onCreated,
  onToast,
}) {
  const [mode, setMode] = useState('adhoc')
  const [busy, setBusy] = useState(false)

  if (!preset) return null

  async function confirm() {
    setBusy(true)
    const mapped = mapRecurrence(preset.suggested_recurrence)
    const time = (preset.suggested_time || '').toString().slice(0, 5) || '09:00'
    const { error } = await createFromPreset({
      householdId,
      userId,
      preset,
      ensureToday,
      draft: {
        mode,
        date: todayHK(),
        time,
        recurrence_rule: mode === 'adhoc' ? 'none' : mapped.recurrence_rule || 'daily',
        recurrence_weekdays: mapped.recurrence_weekdays,
        priority: preset.suggested_priority || 'normal',
        title_zh: preset.title_zh,
        title_id: preset.title_id,
        instructions_zh: preset.instructions_zh,
        instructions_id: preset.instructions_id,
        translation_approved: preset.translation_approved !== false,
      },
    })
    setBusy(false)
    if (error) {
      onToast?.(error.message)
      return
    }
    onToast?.('已新增')
    onCreated?.()
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
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
            mode === 'scheduled' ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
          }`}
        >
          設為固定工作
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl border border-slate-200"
        >
          取消
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white"
        >
          確認
        </button>
      </div>
    </Modal>
  )
}

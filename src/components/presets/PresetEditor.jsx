import { useEffect, useState } from 'react'
import Modal from '../Modal'
import RecurrenceFields from './RecurrenceFields'
import {
  detectSensitiveContent,
  mapRecurrence,
  updateHouseholdPreset,
  mapBatchError,
} from '../../lib/presets'

/**
 * Edit household preset fields. System presets are copy-only (not opened here).
 */
export default function PresetEditor({
  open,
  preset,
  categories = [],
  onClose,
  onSaved,
  onToast,
}) {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sensitiveAck, setSensitiveAck] = useState(false)

  useEffect(() => {
    if (!open || !preset) return
    const mapped = mapRecurrence(preset.suggested_recurrence)
    setSensitiveAck(false)
    setBusy(false)
    setForm({
      category_id: preset.category_id || preset.category?.id || '',
      title_zh: preset.title_zh || '',
      title_id: preset.title_id || '',
      instructions_zh: preset.instructions_zh || '',
      instructions_id: preset.instructions_id || '',
      additional_instructions_zh: preset.additional_instructions_zh || '',
      additional_instructions_id: preset.additional_instructions_id || '',
      suggested_task_type: preset.suggested_task_type || 'scheduled',
      suggested_time: (preset.suggested_time || '').toString().slice(0, 5),
      recurrence_rule:
        mapped.recurrence_rule === 'none'
          ? 'daily'
          : mapped.recurrence_rule || 'daily',
      recurrence_weekdays: mapped.recurrence_weekdays,
      recurrence_interval: mapped.recurrence_interval || 1,
      start_date: '',
      end_date: null,
      neverEnds: true,
      suggested_priority: preset.suggested_priority || 'normal',
      safety_warning: !!preset.safety_warning,
      keywords: (preset.keywords || []).join(', '),
      translation_approved: preset.translation_approved !== false,
    })
  }, [open, preset])

  if (!preset || !form) return null

  const hay = [
    form.title_zh,
    form.instructions_zh,
    form.additional_instructions_zh,
    form.keywords,
  ].join(' ')
  const sensitive = detectSensitiveContent(hay)

  function patch(p) {
    setForm((f) => ({ ...f, ...p }))
  }

  async function save() {
    if (!form.title_zh.trim() || !form.title_id.trim()) {
      onToast?.('標題（中／印）必填')
      return
    }
    if (sensitive.sensitive && !sensitiveAck) {
      onToast?.('偵測到敏感內容，請確認後再儲存')
      return
    }
    setBusy(true)
    const suggested_recurrence =
      form.suggested_task_type === 'adhoc'
        ? { rule: 'none' }
        : {
            rule: form.recurrence_rule,
            weekdays: form.recurrence_weekdays,
            interval: form.recurrence_interval || 1,
          }
    const { error } = await updateHouseholdPreset(preset.id, {
      category_id: form.category_id,
      title_zh: form.title_zh.trim(),
      title_id: form.title_id.trim(),
      instructions_zh: form.instructions_zh,
      instructions_id: form.instructions_id,
      additional_instructions_zh: form.additional_instructions_zh,
      additional_instructions_id: form.additional_instructions_id,
      suggested_task_type: form.suggested_task_type,
      suggested_time: form.suggested_time || null,
      suggested_recurrence,
      suggested_priority: form.suggested_priority,
      safety_warning: form.safety_warning,
      translation_approved: form.translation_approved,
      keywords: form.keywords
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    })
    setBusy(false)
    if (error) {
      onToast?.(mapBatchError(error) || error.message)
      return
    }
    onToast?.('已儲存範本')
    onSaved?.()
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="編輯我的範本"
      labelledBy="preset-editor-title"
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs" htmlFor="pe-cat" lang="zh-Hant">
            分類
          </label>
          <select
            id="pe-cat"
            value={form.category_id}
            disabled={busy}
            onChange={(e) => patch({ category_id: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_zh}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs" htmlFor="pe-zh" lang="zh-Hant">
            標題（中文）
          </label>
          <input
            id="pe-zh"
            lang="zh-Hant"
            value={form.title_zh}
            disabled={busy}
            onChange={(e) =>
              patch({ title_zh: e.target.value, translation_approved: false })
            }
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          />
        </div>
        <div>
          <label className="text-xs" htmlFor="pe-id" lang="id">
            Judul (Indonesia)
          </label>
          <input
            id="pe-id"
            lang="id"
            value={form.title_id}
            disabled={busy}
            onChange={(e) =>
              patch({ title_id: e.target.value, translation_approved: false })
            }
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          />
        </div>

        <div>
          <label className="text-xs" htmlFor="pe-iz" lang="zh-Hant">
            詳細指示
          </label>
          <textarea
            id="pe-iz"
            lang="zh-Hant"
            rows={2}
            value={form.instructions_zh}
            disabled={busy}
            onChange={(e) => patch({ instructions_zh: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2"
          />
        </div>
        <div>
          <label className="text-xs" htmlFor="pe-ii" lang="id">
            Instruksi detail
          </label>
          <textarea
            id="pe-ii"
            lang="id"
            rows={2}
            value={form.instructions_id}
            disabled={busy}
            onChange={(e) => patch({ instructions_id: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2"
          />
        </div>

        <div>
          <label className="text-xs" htmlFor="pe-az" lang="zh-Hant">
            補充指示
          </label>
          <textarea
            id="pe-az"
            lang="zh-Hant"
            rows={2}
            value={form.additional_instructions_zh}
            disabled={busy}
            onChange={(e) =>
              patch({ additional_instructions_zh: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2"
          />
        </div>
        <div>
          <label className="text-xs" htmlFor="pe-ai" lang="id">
            Instruksi tambahan
          </label>
          <textarea
            id="pe-ai"
            lang="id"
            rows={2}
            value={form.additional_instructions_id}
            disabled={busy}
            onChange={(e) =>
              patch({ additional_instructions_id: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs">類型</label>
            <select
              value={form.suggested_task_type}
              disabled={busy}
              onChange={(e) => patch({ suggested_task_type: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
            >
              <option value="adhoc">臨時</option>
              <option value="scheduled">排程</option>
            </select>
          </div>
          <div>
            <label className="text-xs">建議時間</label>
            <input
              type="time"
              value={form.suggested_time}
              disabled={busy}
              onChange={(e) => patch({ suggested_time: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
            />
          </div>
        </div>

        {form.suggested_task_type === 'scheduled' && (
          <RecurrenceFields
            idPrefix="pe-rec"
            recurrence_rule={form.recurrence_rule}
            recurrence_weekdays={form.recurrence_weekdays}
            recurrence_interval={form.recurrence_interval}
            start_date={form.start_date}
            end_date={form.end_date}
            neverEnds={form.neverEnds}
            disabled={busy}
            onChange={patch}
          />
        )}

        <div>
          <label className="text-xs">優先</label>
          <select
            value={form.suggested_priority}
            disabled={busy}
            onChange={(e) => patch({ suggested_priority: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          >
            <option value="low">低</option>
            <option value="normal">普通</option>
            <option value="high">高</option>
            <option value="urgent">緊急</option>
          </select>
        </div>

        <div>
          <label className="text-xs" htmlFor="pe-kw">
            關鍵字（逗號分隔）
          </label>
          <input
            id="pe-kw"
            value={form.keywords}
            disabled={busy}
            onChange={(e) => patch({ keywords: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
          />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.safety_warning}
            disabled={busy}
            onChange={(e) => patch({ safety_warning: e.target.checked })}
          />
          <span lang="zh-Hant">安全提示</span>
          <span lang="id" className="text-slate-500">
            / Peringatan keselamatan
          </span>
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.translation_approved}
            disabled={busy}
            onChange={(e) => patch({ translation_approved: e.target.checked })}
          />
          已核對印尼文
        </label>

        {sensitive.sensitive && (
          <div
            role="alert"
            className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
          >
            <p lang="zh-Hant">
              偵測到可能嘅敏感內容（{sensitive.kinds.join('、')}）。請確認唔好儲存門禁／身份證等私隱。
            </p>
            <p lang="id" className="text-xs">
              Terdeteksi konten sensitif ({sensitive.kinds.join(', ')}).
            </p>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={sensitiveAck}
                onChange={(e) => setSensitiveAck(e.target.checked)}
              />
              我明白，仍然儲存 / Saya paham, tetap simpan
            </label>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl border border-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || (sensitive.sensitive && !sensitiveAck)}
            onClick={save}
            className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-50"
          >
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

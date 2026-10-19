/**
 * Build JSON payloads for create_tasks_from_presets (preset or custom).
 * Pure — safe for unit tests without Supabase.
 */
import { todayHK } from './constants.js'
import { mapRecurrence } from './presetUtils.js'

export function draftToPayload(draft, preset, index) {
  const isCustom = !preset
  const title_zh = (draft.title_zh ?? preset?.title_zh ?? '').trim()
  const title_id = (draft.title_id ?? preset?.title_id ?? '').trim()
  const mode =
    draft.mode === 'scheduled' && draft.recurrence_rule !== 'none'
      ? 'scheduled'
      : draft.mode === 'adhoc' || draft.recurrence_rule === 'none'
        ? 'adhoc'
        : draft.mode || 'adhoc'
  const mapped = mapRecurrence(
    draft.suggested_recurrence || preset?.suggested_recurrence,
  )
  const rule = draft.recurrence_rule || mapped.recurrence_rule || 'daily'
  const weekdays = draft.recurrence_weekdays ?? mapped.recurrence_weekdays
  const addZh =
    draft.additional_instructions_zh ??
    preset?.additional_instructions_zh ??
    draft.notes ??
    ''
  const addId =
    draft.additional_instructions_id ??
    preset?.additional_instructions_id ??
    ''

  const payload = {
    client_item_id: draft.client_item_id || String(index + 1),
    mode,
    title_zh,
    title_id,
    instructions_zh: draft.instructions_zh ?? preset?.instructions_zh ?? '',
    instructions_id: draft.instructions_id ?? preset?.instructions_id ?? '',
    additional_instructions_zh: addZh,
    additional_instructions_id: addId,
    task_date: draft.date || todayHK(),
    due_time: draft.time || null,
    start_date: draft.start_date || draft.date || todayHK(),
    end_date: draft.end_date || null,
    priority: draft.priority || preset?.suggested_priority || 'normal',
    assigned_to: draft.assigned_to || null,
    translation_approved:
      draft.translation_approved ??
      (isCustom
        ? false
        : draft.zhEdited
          ? false
          : preset?.translation_approved !== false),
  }
  if (!isCustom) {
    payload.preset_id = preset.id
  } else {
    payload.preset_id = null
  }
  if (mode === 'scheduled') {
    payload.recurrence_rule = rule === 'none' ? 'daily' : rule
    if (weekdays?.length) payload.recurrence_weekdays = weekdays
    const interval = Number(
      draft.recurrence_interval ?? mapped.recurrence_interval ?? 1,
    )
    payload.recurrence_interval = Math.min(365, Math.max(1, interval || 1))
    if (payload.recurrence_rule === 'biweekly') {
      payload.recurrence_interval = Math.max(payload.recurrence_interval, 2)
    }
  }
  return payload
}

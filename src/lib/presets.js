/**
 * Task preset library helpers.
 * task_presets = reusable bilingual library (system + household)
 * task_templates = active recurring schedules (unchanged)
 */
import { supabase } from './supabase'
import { todayHK } from './constants'
import {
  FALLBACK_CATEGORIES,
  FALLBACK_SYSTEM_PRESETS,
} from '../data/systemPresetsFallback'
import { mapRecurrence } from './presetUtils'

export {
  mapRecurrence,
  detectSensitiveContent,
  filterPresets,
  recurrenceLabel,
  buildQuickAddList,
  scoreQuickAddPreset,
  hourHK,
  ISO_WEEKDAYS,
  WEEKDAY_LABELS,
  RECURRENCE_RULES,
  EDIT_SCOPES,
} from './presetUtils'

const SYSTEM_CACHE_KEY = 'halo-kakak:system-presets:v1'

function cacheSystem(categories, presets) {
  try {
    localStorage.setItem(
      SYSTEM_CACHE_KEY,
      JSON.stringify({ at: Date.now(), categories, presets }),
    )
  } catch {
    /* ignore quota */
  }
}

function readSystemCache() {
  try {
    const raw = localStorage.getItem(SYSTEM_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('task_preset_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error || !data?.length) {
    const cached = readSystemCache()
    return cached?.categories || FALLBACK_CATEGORIES
  }
  return data
}

export async function fetchPresets(householdId, { includeArchived = false } = {}) {
  let systemQuery = supabase
    .from('task_presets')
    .select('*, category:task_preset_categories(id, key, name_zh, name_id, icon)')
    .eq('source', 'system')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order')

  const { data: systemRows, error: sysErr } = await systemQuery

  let systemPresets = systemRows || []
  if (sysErr || !systemPresets.length) {
    const cached = readSystemCache()
    if (cached?.presets?.length) {
      systemPresets = cached.presets
    } else {
      systemPresets = FALLBACK_SYSTEM_PRESETS.map((p) => ({
        ...p,
        id: `fallback:${p.system_key}`,
        category_key: p.category_key,
        category: FALLBACK_CATEGORIES.find((c) => c.key === p.category_key),
      }))
    }
  } else {
    systemPresets = systemPresets.map((p) => ({
      ...p,
      category_key: p.category?.key,
    }))
    cacheSystem(
      systemPresets
        .map((p) => p.category)
        .filter(Boolean)
        .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i),
      systemPresets,
    )
  }

  let householdPresets = []
  if (householdId) {
    let q = supabase
      .from('task_presets')
      .select('*, category:task_preset_categories(id, key, name_zh, name_id, icon)')
      .eq('source', 'household')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('sort_order')
    if (!includeArchived) q = q.is('archived_at', null)
    const { data } = await q
    householdPresets = (data || []).map((p) => ({
      ...p,
      category_key: p.category?.key,
    }))
  }

  return [...systemPresets, ...householdPresets]
}

export async function fetchRecentUsage(householdId, limit = 10) {
  if (!householdId) return []
  const { data, error } = await supabase
    .from('task_preset_usage')
    .select(
      'preset_id, used_at, preset:task_presets(*, category:task_preset_categories(id, key, name_zh, name_id, icon))',
    )
    .eq('household_id', householdId)
    .order('used_at', { ascending: false })
    .limit(40)
  if (error || !data) return []
  const seen = new Set()
  const out = []
  for (const row of data) {
    if (!row.preset || seen.has(row.preset_id)) continue
    if (row.preset.archived_at) continue
    seen.add(row.preset_id)
    out.push({
      ...row.preset,
      category_key: row.preset.category?.key,
      last_used_at: row.used_at,
    })
    if (out.length >= limit) break
  }
  return out
}

export async function fetchFavourites(householdId) {
  if (!householdId) return []
  const { data, error } = await supabase
    .from('household_preset_favourites')
    .select(
      'preset_id, created_at, preset:task_presets(*, category:task_preset_categories(id, key, name_zh, name_id, icon))',
    )
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data
    .filter((r) => r.preset && !r.preset.archived_at)
    .map((r) => ({
      ...r.preset,
      category_key: r.preset.category?.key,
      favourited_at: r.created_at,
    }))
}

export async function toggleFavourite(householdId, presetId, userId, isFav) {
  if (isFav) {
    const { error } = await supabase
      .from('household_preset_favourites')
      .delete()
      .eq('household_id', householdId)
      .eq('preset_id', presetId)
    return { error }
  }
  const { error } = await supabase.from('household_preset_favourites').insert({
    household_id: householdId,
    preset_id: presetId,
    created_by: userId,
  })
  return { error }
}


export { mapBatchError } from './batchErrors.js'

function draftToPayload(draft, preset, index) {
  const title_zh = (draft.title_zh ?? preset.title_zh).trim()
  const title_id = (draft.title_id ?? preset.title_id).trim()
  const mode =
    draft.mode === 'scheduled' && draft.recurrence_rule !== 'none'
      ? 'scheduled'
      : draft.mode === 'adhoc' || draft.recurrence_rule === 'none'
        ? 'adhoc'
        : draft.mode || 'adhoc'
  const mapped = mapRecurrence(
    draft.suggested_recurrence || preset.suggested_recurrence,
  )
  const rule = draft.recurrence_rule || mapped.recurrence_rule || 'daily'
  const weekdays = draft.recurrence_weekdays ?? mapped.recurrence_weekdays
  const addZh =
    draft.additional_instructions_zh ??
    draft.notes ??
    ''
  const addId = draft.additional_instructions_id ?? ''

  const payload = {
    client_item_id: draft.client_item_id || String(index + 1),
    preset_id: preset.id,
    mode,
    title_zh,
    title_id,
    instructions_zh: draft.instructions_zh ?? preset.instructions_zh ?? '',
    instructions_id: draft.instructions_id ?? preset.instructions_id ?? '',
    additional_instructions_zh: addZh,
    additional_instructions_id: addId,
    task_date: draft.date || todayHK(),
    due_time: draft.time || null,
    start_date: draft.start_date || draft.date || todayHK(),
    end_date: draft.end_date || null,
    priority: draft.priority || preset.suggested_priority || 'normal',
    assigned_to: draft.assigned_to || null,
    translation_approved:
      draft.translation_approved ??
      (draft.zhEdited ? false : preset.translation_approved !== false),
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

/**
 * Atomic batch create via create_tasks_from_presets RPC.
 * @param {{ householdId: string, idempotencyKey: string, items: Array<{preset: object, draft: object}> }}
 */
export async function createTasksFromPresets({
  householdId,
  idempotencyKey,
  items,
}) {
  if (!householdId || !idempotencyKey) {
    return { error: { message: 'BATCH_FAILED' } }
  }
  if (!items?.length) {
    return { error: { message: 'BATCH_FAILED' } }
  }
  for (const it of items) {
    if (!it.preset?.id || String(it.preset.id).startsWith('fallback:')) {
      return { error: { message: 'INVALID_PRESET' } }
    }
  }
  const p_tasks = items.map((it, i) => draftToPayload(it.draft, it.preset, i))
  const { data, error } = await supabase.rpc('create_tasks_from_presets', {
    p_household_id: householdId,
    p_idempotency_key: idempotencyKey,
    p_tasks,
  })
  if (error) return { error }
  return { data }
}

/**
 * @deprecated Prefer createTasksFromPresets. Kept for single-item callers; routes through RPC.
 */
export async function createFromPreset({
  householdId,
  userId: _userId,
  preset,
  draft,
  ensureToday: _ensureToday,
  idempotencyKey,
}) {
  const key = idempotencyKey || crypto.randomUUID()
  const { data, error } = await createTasksFromPresets({
    householdId,
    idempotencyKey: key,
    items: [{ preset, draft }],
  })
  if (error) return { error }
  const created = data?.created?.[0]
  return {
    data,
    occurrence: created?.occurrence_id
      ? { id: created.occurrence_id }
      : undefined,
    template: created?.template_id ? { id: created.template_id } : undefined,
  }
}

export async function saveAsHouseholdPreset({
  householdId,
  userId,
  categoryId,
  title_zh,
  title_id,
  instructions_zh = '',
  instructions_id = '',
  suggested_task_type = 'scheduled',
  suggested_time = null,
  suggested_recurrence = null,
  suggested_priority = 'normal',
  safety_warning = false,
  translation_approved = true,
  keywords = [],
}) {
  const { data, error } = await supabase
    .from('task_presets')
    .insert({
      household_id: householdId,
      source: 'household',
      category_id: categoryId,
      title_zh,
      title_id,
      instructions_zh,
      instructions_id,
      suggested_task_type,
      suggested_time,
      suggested_recurrence,
      suggested_priority,
      safety_warning,
      translation_approved,
      keywords,
      created_by: userId,
    })
    .select()
    .single()
  return { data, error }
}

export async function archiveHouseholdPreset(presetId) {
  return supabase
    .from('task_presets')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', presetId)
    .eq('source', 'household')
}

export async function duplicateHouseholdPreset(preset, householdId, userId) {
  return saveAsHouseholdPreset({
    householdId,
    userId,
    categoryId: preset.category_id || preset.category?.id,
    title_zh: `${preset.title_zh}（副本）`,
    title_id: `${preset.title_id} (salinan)`,
    instructions_zh: preset.instructions_zh,
    instructions_id: preset.instructions_id,
    suggested_task_type: preset.suggested_task_type,
    suggested_time: preset.suggested_time,
    suggested_recurrence: preset.suggested_recurrence,
    suggested_priority: preset.suggested_priority,
    safety_warning: preset.safety_warning,
    translation_approved: preset.translation_approved,
    keywords: preset.keywords || [],
  })
}


/**
 * Task preset library helpers.
 * task_presets = reusable bilingual library (system + household)
 * task_templates = active recurring schedules (unchanged)
 *
 * Offline/fallback (Phase 3):
 * - Shared cache stores SYSTEM presets only (never household).
 * - Fallback only when genuinely offline / network unavailable.
 * - Auth / schema / permission errors are surfaced, never masked by fallback.
 */
import { supabase } from './supabase'
import { todayHK } from './constants'
import {
  FALLBACK_CATEGORIES,
  FALLBACK_SYSTEM_PRESETS,
} from '../data/systemPresetsFallback'
import { draftToPayload } from './taskPayload'
import {
  mapRecurrence,
  CLIENT_SEED_VERSION,
  OFFLINE_PRESET_MSG,
  UNAVAILABLE_PRESET_MSG,
} from './presetUtils'

export { draftToPayload } from './taskPayload'
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
  CLIENT_SEED_VERSION,
  OFFLINE_PRESET_MSG,
  UNAVAILABLE_PRESET_MSG,
} from './presetUtils'

const SYSTEM_CACHE_KEY = 'halo-kakak:system-presets:v2'

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Errors that must NOT be hidden behind fallback data */
function isHardError(error) {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  const status = error.status || error.statusCode
  if (status === 401 || status === 403) return true
  if (code === 'PGRST301' || code === '42501' || code === '28000') return true
  if (msg.includes('jwt') || msg.includes('not authorized') || msg.includes('permission'))
    return true
  if (msg.includes('column') || msg.includes('schema') || code === '42703' || code === '42P01')
    return true
  return false
}

function isNetworkish(error) {
  if (!error) return false
  if (isHardError(error)) return false
  const msg = String(error.message || '').toLowerCase()
  return (
    isOffline() ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    error.name === 'TypeError'
  )
}

function cacheSystem({ categories, presets, seedVersion, lastSyncedAt }) {
  try {
    // Never persist household presets in shared cache
    const safe = (presets || []).filter((p) => p.source === 'system')
    localStorage.setItem(
      SYSTEM_CACHE_KEY,
      JSON.stringify({
        at: Date.now(),
        seedVersion: seedVersion || CLIENT_SEED_VERSION,
        lastSyncedAt: lastSyncedAt || new Date().toISOString(),
        categories,
        presets: safe,
      }),
    )
  } catch {
    /* ignore quota */
  }
}

function readSystemCache() {
  try {
    const raw = localStorage.getItem(SYSTEM_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.presets?.some((p) => p.source === 'household')) {
      // Purge contaminated cache
      localStorage.removeItem(SYSTEM_CACHE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function fallbackSystemPresets() {
  return FALLBACK_SYSTEM_PRESETS.map((p) => ({
    ...p,
    id: `fallback:${p.system_key}`,
    source: 'system',
    category_key: p.category_key,
    category: FALLBACK_CATEGORIES.find((c) => c.key === p.category_key),
    template_version: 1,
  }))
}

/**
 * @returns {{ categories, presets, meta: { mode, seedVersion, lastSyncedAt, message? } }}
 */
export async function fetchPresetLibrary(householdId, { includeArchived = false } = {}) {
  const meta = {
    mode: 'online',
    seedVersion: CLIENT_SEED_VERSION,
    lastSyncedAt: null,
    message: null,
  }

  // Meta row (best-effort)
  try {
    const { data: metaRow } = await supabase
      .from('preset_library_meta')
      .select('seed_version, last_synced_at')
      .eq('id', 'global')
      .maybeSingle()
    if (metaRow) {
      meta.seedVersion = metaRow.seed_version || CLIENT_SEED_VERSION
      meta.lastSyncedAt = metaRow.last_synced_at
    }
  } catch {
    /* ignore */
  }

  const { data: cats, error: catErr } = await supabase
    .from('task_preset_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (catErr && isHardError(catErr)) {
    return {
      categories: [],
      presets: [],
      meta: { ...meta, mode: 'error', message: catErr.message },
      error: catErr,
    }
  }

  const { data: systemRows, error: sysErr } = await supabase
    .from('task_presets')
    .select('*, category:task_preset_categories(id, key, name_zh, name_id, icon)')
    .eq('source', 'system')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order')

  if (sysErr && isHardError(sysErr)) {
    return {
      categories: cats || [],
      presets: [],
      meta: { ...meta, mode: 'error', message: sysErr.message },
      error: sysErr,
    }
  }

  let categories = cats?.length ? cats : null
  let systemPresets = systemRows || []

  const needFallback =
    (!systemPresets.length && (!sysErr || isNetworkish(sysErr))) ||
    (sysErr && isNetworkish(sysErr)) ||
    isOffline()

  if (needFallback && !systemPresets.length) {
    const cached = readSystemCache()
    if (cached?.presets?.length) {
      systemPresets = cached.presets
      categories = categories || cached.categories || FALLBACK_CATEGORIES
      meta.mode = isOffline() ? 'offline' : 'cached'
      meta.seedVersion = cached.seedVersion || CLIENT_SEED_VERSION
      meta.lastSyncedAt = cached.lastSyncedAt || null
      meta.message = isOffline() ? OFFLINE_PRESET_MSG : UNAVAILABLE_PRESET_MSG
    } else {
      systemPresets = fallbackSystemPresets()
      categories = categories || FALLBACK_CATEGORIES
      meta.mode = isOffline() ? 'offline' : 'fallback'
      meta.message = isOffline() ? OFFLINE_PRESET_MSG : UNAVAILABLE_PRESET_MSG
    }
  } else if (systemPresets.length) {
    systemPresets = systemPresets.map((p) => ({
      ...p,
      category_key: p.category?.key,
    }))
    categories = categories || FALLBACK_CATEGORIES
    const syncedAt = new Date().toISOString()
    meta.mode = 'online'
    meta.lastSyncedAt = syncedAt
    cacheSystem({
      categories,
      presets: systemPresets,
      seedVersion: meta.seedVersion,
      lastSyncedAt: syncedAt,
    })
    // Best-effort stamp last_synced_at on server (employers may lack write; ignore fail)
    try {
      await supabase
        .from('preset_library_meta')
        .update({ last_synced_at: syncedAt, updated_at: syncedAt })
        .eq('id', 'global')
    } catch {
      /* RLS may block — ok */
    }
  }

  if (!categories?.length) categories = FALLBACK_CATEGORIES

  let householdPresets = []
  if (householdId && meta.mode === 'online') {
    let q = supabase
      .from('task_presets')
      .select('*, category:task_preset_categories(id, key, name_zh, name_id, icon)')
      .eq('source', 'household')
      .eq('household_id', householdId)
      .order('sort_order')
    if (!includeArchived) {
      q = q.is('archived_at', null).eq('is_active', true)
    }
    const { data, error: hhErr } = await q
    if (hhErr && isHardError(hhErr)) {
      return {
        categories,
        presets: systemPresets,
        meta: { ...meta, mode: 'error', message: hhErr.message },
        error: hhErr,
      }
    }
    if (!hhErr) {
      householdPresets = (data || []).map((p) => ({
        ...p,
        category_key: p.category?.key,
      }))
    }
  }

  return {
    categories,
    presets: [...systemPresets, ...householdPresets],
    meta,
  }
}

export async function fetchCategories() {
  const { categories, meta, error } = await fetchPresetLibrary(null)
  if (error && meta.mode === 'error') throw error
  return categories
}

export async function fetchPresets(householdId, opts = {}) {
  const { presets, meta, error } = await fetchPresetLibrary(householdId, opts)
  if (error && meta.mode === 'error') {
    // Surface hard errors to callers that check
    const err = Object.assign(new Error(error.message), { cause: error, meta })
    throw err
  }
  return presets
}

export function getSystemCacheMeta() {
  const c = readSystemCache()
  return c
    ? {
        seedVersion: c.seedVersion,
        lastSyncedAt: c.lastSyncedAt,
        at: c.at,
        count: c.presets?.length || 0,
      }
    : null
}

/** Call on window online to refresh system cache */
export async function refreshPresetLibraryOnReconnect(householdId) {
  if (isOffline()) return null
  return fetchPresetLibrary(householdId)
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
    const isCustom = it.custom === true || it.preset == null
    if (isCustom) {
      if (!(it.draft?.title_zh || '').trim()) {
        return { error: { message: 'BATCH_FAILED' } }
      }
      continue
    }
    if (!it.preset?.id || String(it.preset.id).startsWith('fallback:')) {
      return { error: { message: 'INVALID_PRESET' } }
    }
  }
  const p_tasks = items.map((it, i) =>
    draftToPayload(it.draft, it.custom || it.preset == null ? null : it.preset, i),
  )
  const { data, error } = await supabase.rpc('create_tasks_from_presets', {
    p_household_id: householdId,
    p_idempotency_key: idempotencyKey,
    p_tasks,
  })
  if (error) return { error }
  return { data }
}

/**
 * Employer custom ad-hoc / scheduled create via the same atomic RPC + notifications.
 */
export async function createCustomTask({
  householdId,
  draft,
  idempotencyKey,
}) {
  const key = idempotencyKey || crypto.randomUUID()
  const recurrence = draft.recurrence_rule || 'none'
  const mode = recurrence !== 'none' ? 'scheduled' : 'adhoc'
  const normalized = {
    ...draft,
    mode,
    recurrence_rule: recurrence,
    title_zh: (draft.title_zh || '').trim(),
    title_id: (draft.title_id || '').trim(),
    client_item_id: draft.client_item_id || 'custom-1',
  }
  const { data, error } = await createTasksFromPresets({
    householdId,
    idempotencyKey: key,
    items: [{ custom: true, preset: null, draft: normalized }],
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
  additional_instructions_zh = '',
  additional_instructions_id = '',
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
      additional_instructions_zh,
      additional_instructions_id,
      suggested_task_type,
      suggested_time,
      suggested_recurrence,
      suggested_priority,
      safety_warning,
      translation_approved,
      keywords,
      created_by: userId,
      template_version: 1,
    })
    .select()
    .single()
  return { data, error }
}

export async function updateHouseholdPreset(presetId, patch) {
  const { data, error } = await supabase.rpc('update_household_preset', {
    p_preset_id: presetId,
    p_patch: patch,
  })
  return { data, error }
}

export async function archiveHouseholdPreset(presetId) {
  const { data, error } = await supabase.rpc('archive_household_preset', {
    p_preset_id: presetId,
  })
  return { data, error }
}

export async function restoreHouseholdPreset(presetId) {
  const { data, error } = await supabase.rpc('restore_household_preset', {
    p_preset_id: presetId,
  })
  return { data, error }
}

export async function countPresetUsage(presetId) {
  const { count, error } = await supabase
    .from('task_preset_usage')
    .select('id', { count: 'exact', head: true })
    .eq('preset_id', presetId)
  return { count: count || 0, error }
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
    additional_instructions_zh: preset.additional_instructions_zh || '',
    additional_instructions_id: preset.additional_instructions_id || '',
    suggested_task_type: preset.suggested_task_type,
    suggested_time: preset.suggested_time,
    suggested_recurrence: preset.suggested_recurrence,
    suggested_priority: preset.suggested_priority,
    safety_warning: preset.safety_warning,
    translation_approved: preset.translation_approved,
    keywords: preset.keywords || [],
  })
}

/** Copy a system preset into the household library (system remains read-only). */
export async function copySystemPresetToHousehold(preset, householdId, userId) {
  if (preset.source !== 'system' && !String(preset.id).startsWith('fallback:')) {
    return duplicateHouseholdPreset(preset, householdId, userId)
  }
  return saveAsHouseholdPreset({
    householdId,
    userId,
    categoryId: preset.category_id || preset.category?.id,
    title_zh: preset.title_zh,
    title_id: preset.title_id,
    instructions_zh: preset.instructions_zh || '',
    instructions_id: preset.instructions_id || '',
    additional_instructions_zh: preset.additional_instructions_zh || '',
    additional_instructions_id: preset.additional_instructions_id || '',
    suggested_task_type: preset.suggested_task_type || 'scheduled',
    suggested_time: preset.suggested_time,
    suggested_recurrence: preset.suggested_recurrence,
    suggested_priority: preset.suggested_priority || 'normal',
    safety_warning: !!preset.safety_warning,
    translation_approved: preset.translation_approved !== false,
    keywords: preset.keywords || [],
  })
}

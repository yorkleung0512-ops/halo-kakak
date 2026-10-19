import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../Modal'
import MethodStep from './MethodStep'
import PresetBrowser from './PresetBrowser'
import ConfigureStep from './ConfigureStep'
import PreviewStep from './PreviewStep'
import {
  createTasksFromPresets,
  fetchFavourites,
  fetchPresetLibrary,
  fetchRecentUsage,
  mapBatchError,
  mapRecurrence,
  refreshPresetLibraryOnReconnect,
  saveAsHouseholdPreset,
  toggleFavourite,
} from '../../lib/presets'
import { todayHK, POLICY_VERSION } from '../../lib/constants'
import { translateViaEdge } from '../../lib/translateClient'
import { supabase } from '../../lib/supabase'
import { fetchActiveHelpers } from '../../lib/assignees'

function buildDraft(preset, helpers) {
  const mapped = mapRecurrence(preset.suggested_recurrence)
  const suggestedType = preset.suggested_task_type || 'scheduled'
  const time = (preset.suggested_time || '').toString().slice(0, 5) || '09:00'
  const defaultAssignee =
    helpers.length === 1 ? helpers[0].user_id : null
  const date = todayHK()
  return {
    preset,
    mode: suggestedType === 'adhoc' ? 'adhoc' : 'scheduled',
    date,
    start_date: date,
    end_date: null,
    neverEnds: true,
    time,
    recurrence_rule:
      suggestedType === 'adhoc' ? 'none' : mapped.recurrence_rule || 'daily',
    recurrence_weekdays: mapped.recurrence_weekdays,
    recurrence_interval: mapped.recurrence_interval || 1,
    priority: preset.suggested_priority || 'normal',
    title_zh: preset.title_zh,
    title_id: preset.title_id,
    instructions_zh: preset.instructions_zh || '',
    instructions_id: preset.instructions_id || '',
    additional_instructions_zh: preset.additional_instructions_zh || '',
    additional_instructions_id: preset.additional_instructions_id || '',
    assigned_to: defaultAssignee,
    translation_approved: preset.translation_approved !== false,
    zhEdited: false,
  }
}

/**
 * Multi-step add-task flow for employers.
 * Batch create is atomic via create_tasks_from_presets RPC.
 */
export default function AddTaskFlow({
  open,
  onClose,
  householdId,
  userId,
  glossary,
  ensureToday: _ensureToday,
  onCreated,
  onToast,
  customForm,
  initialPresetIds = [],
}) {
  const [step, setStep] = useState('method')
  const [categories, setCategories] = useState([])
  const [presets, setPresets] = useState([])
  const [favourites, setFavourites] = useState([])
  const [recent, setRecent] = useState([])
  const [helpers, setHelpers] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [drafts, setDrafts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [libraryMeta, setLibraryMeta] = useState(null)
  const idempotencyKeyRef = useRef(null)
  const stepHeadingRef = useRef(null)

  const favouriteIds = useMemo(
    () => new Set(favourites.map((f) => f.id)),
    [favourites],
  )

  const load = useCallback(async () => {
    if (!householdId) return
    try {
      const [{ categories: cats, presets: all, meta, error }, favs, rec, helps] =
        await Promise.all([
          fetchPresetLibrary(householdId),
          fetchFavourites(householdId),
          fetchRecentUsage(householdId, 10),
          fetchActiveHelpers(householdId),
        ])
      if (error && meta?.mode === 'error') {
        onToast?.(error.message)
      }
      setCategories(cats || [])
      setPresets(all || [])
      setLibraryMeta(meta)
      setFavourites(favs)
      setRecent(rec)
      setHelpers(helps)
    } catch (e) {
      onToast?.(e.message || '載入範本失敗')
    }
  }, [householdId, onToast])

  useEffect(() => {
    if (open) {
      const initial = new Set(
        (initialPresetIds || []).filter(Boolean),
      )
      setStep(initial.size ? 'browse' : 'method')
      setSelectedIds(initial)
      setDrafts([])
      idempotencyKeyRef.current = null
      setSubmitting(false)
      load()
    }
  }, [open, load, JSON.stringify(initialPresetIds || [])])

  useEffect(() => {
    if (!open) return
    stepHeadingRef.current?.focus?.()
  }, [step, open])

  const autoConfiguredRef = useRef(false)
  useEffect(() => {
    if (!open) {
      autoConfiguredRef.current = false
      return
    }
    if (autoConfiguredRef.current) return
    if (step !== 'browse') return
    if (!(initialPresetIds || []).length) return
    const pool = [...presets, ...favourites, ...recent]
    if (!pool.length) return
    const ready = (initialPresetIds || []).every((id) =>
      pool.some((p) => p.id === id),
    )
    if (!ready) return
    const dedup = []
    const seen = new Set()
    for (const p of pool) {
      if (!selectedIds.has(p.id) || seen.has(p.id)) continue
      seen.add(p.id)
      dedup.push(p)
    }
    if (!dedup.length) return
    autoConfiguredRef.current = true
    setDrafts(dedup.map((p) => buildDraft(p, helpers)))
    setStep('configure')
  }, [open, step, presets, favourites, recent, helpers, selectedIds])

  useEffect(() => {
    if (!open || !householdId) return
    function onOnline() {
      refreshPresetLibraryOnReconnect(householdId).then((res) => {
        if (!res) return
        if (res.error && res.meta?.mode === 'error') {
          onToast?.(res.error.message)
          return
        }
        setCategories(res.categories || [])
        setPresets(res.presets || [])
        setLibraryMeta(res.meta)
        onToast?.(
          res.meta?.mode === 'online'
            ? '已重新同步範本庫'
            : undefined,
        )
      })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [open, householdId, onToast])

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onToggleFavourite(preset) {
    const isFav = favouriteIds.has(preset.id)
    const { error } = await toggleFavourite(
      householdId,
      preset.id,
      userId,
      isFav,
    )
    if (error) {
      onToast?.(error.message)
      return
    }
    setFavourites(await fetchFavourites(householdId))
  }

  function goConfigure() {
    const selected = presets.filter((p) => selectedIds.has(p.id))
    const extra = [...favourites, ...recent].filter(
      (p) => selectedIds.has(p.id) && !selected.find((s) => s.id === p.id),
    )
    setDrafts([...selected, ...extra].map((p) => buildDraft(p, helpers)))
    setStep('configure')
  }

  function goPreview() {
    idempotencyKeyRef.current = crypto.randomUUID()
    setStep('preview')
  }

  function changeDraft(idx, patch) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    )
  }

  async function retranslate(idx) {
    const d = drafts[idx]
    if (!d?.title_zh?.trim()) return
    try {
      await supabase.from('privacy_consents').upsert(
        {
          user_id: userId,
          policy_version: POLICY_VERSION,
          consent_type: 'translation',
        },
        { onConflict: 'user_id,policy_version,consent_type' },
      )
      const { translated } = await translateViaEdge(d.title_zh, glossary)
      changeDraft(idx, {
        title_id: translated,
        translation_approved: false,
      })
    } catch {
      onToast?.('翻譯失敗，請稍後再試')
    }
  }

  async function saveAsTemplate(idx) {
    const d = drafts[idx]
    const categoryId =
      d.preset.category_id ||
      d.preset.category?.id ||
      categories.find((c) => c.key === (d.preset.category_key || 'special'))?.id
    if (!categoryId) {
      onToast?.('未搵到分類')
      return
    }
    const { error } = await saveAsHouseholdPreset({
      householdId,
      userId,
      categoryId,
      title_zh: d.title_zh,
      title_id: d.title_id,
      instructions_zh: d.instructions_zh,
      instructions_id: d.instructions_id,
      additional_instructions_zh: d.additional_instructions_zh || '',
      additional_instructions_id: d.additional_instructions_id || '',
      suggested_task_type: d.mode === 'adhoc' ? 'adhoc' : 'scheduled',
      suggested_time: d.time || null,
      suggested_recurrence: {
        rule: d.recurrence_rule || 'none',
        weekdays: d.recurrence_weekdays,
        interval: d.recurrence_interval || 1,
      },
      suggested_priority: d.priority,
      safety_warning: !!d.preset.safety_warning,
      translation_approved: !!d.translation_approved,
    })
    if (error) onToast?.(error.message)
    else {
      onToast?.('已儲存為我的範本')
      load()
    }
  }

  async function submitAll() {
    if (submitting) return
    const key = idempotencyKeyRef.current || crypto.randomUUID()
    idempotencyKeyRef.current = key
    setSubmitting(true)
    const { error } = await createTasksFromPresets({
      householdId,
      idempotencyKey: key,
      items: drafts.map((d) => ({ preset: d.preset, draft: d })),
    })
    setSubmitting(false)
    if (error) {
      onToast?.(mapBatchError(error))
      return
    }
    onToast?.(
      drafts.length > 1 ? `已建立 ${drafts.length} 項任務` : '已新增',
    )
    onCreated?.()
    onClose?.()
  }

  const title =
    step === 'method'
      ? '新增任務'
      : step === 'browse'
        ? '從範本選擇'
        : step === 'configure'
          ? '設定任務'
          : step === 'preview'
            ? '預覽及確認'
            : '自訂任務'

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={title}
      labelledBy="add-task-flow-title"
    >
      {step === 'method' && (
        <MethodStep
          onChooseTemplate={() => setStep('browse')}
          onChooseCustom={() => setStep('custom')}
        />
      )}
      {step === 'browse' && (
        <PresetBrowser
          categories={categories}
          presets={presets}
          favourites={favourites}
          recent={recent}
          selectedIds={selectedIds}
          favouriteIds={favouriteIds}
          onToggleSelect={toggleSelect}
          onToggleFavourite={onToggleFavourite}
          onContinue={goConfigure}
          libraryMeta={libraryMeta}
        />
      )}
      {step === 'configure' && (
        <ConfigureStep
          drafts={drafts}
          helpers={helpers}
          onChangeDraft={changeDraft}
          onBack={() => setStep('browse')}
          onContinue={goPreview}
        />
      )}
      {step === 'preview' && (
        <PreviewStep
          drafts={drafts}
          helpers={helpers}
          onChangeDraft={changeDraft}
          onBack={() => setStep('configure')}
          onSubmit={submitAll}
          onSaveAsTemplate={saveAsTemplate}
          onRetranslate={retranslate}
          submitting={submitting}
        />
      )}
      {step === 'custom' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setStep('method')}
            className="min-h-11 text-sm font-semibold text-teal-800"
          >
            ← 返回選擇方式
          </button>
          {customForm}
        </div>
      )}
    </Modal>
  )
}

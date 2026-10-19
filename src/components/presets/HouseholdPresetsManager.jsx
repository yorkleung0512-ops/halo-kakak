import { useCallback, useEffect, useState } from 'react'
import {
  archiveHouseholdPreset,
  copySystemPresetToHousehold,
  countPresetUsage,
  duplicateHouseholdPreset,
  fetchCategories,
  fetchFavourites,
  fetchPresets,
  restoreHouseholdPreset,
  toggleFavourite,
} from '../../lib/presets'
import PresetCard from './PresetCard'
import PresetEditor from './PresetEditor'
import AddTaskFlow from './AddTaskFlow'

/**
 * Settings → 我的範本: use / edit / copy / fav / archive / restore.
 * System templates: copy-only.
 */
export default function HouseholdPresetsManager({
  householdId,
  userId,
  onToast,
  glossary,
  ensureToday,
  onCreated,
}) {
  const [view, setView] = useState('active') // active | archived | system
  const [presets, setPresets] = useState([])
  const [systemPresets, setSystemPresets] = useState([])
  const [categories, setCategories] = useState([])
  const [favouriteIds, setFavouriteIds] = useState(() => new Set())
  const [expanded, setExpanded] = useState(null)
  const [editing, setEditing] = useState(null)
  const [usePreset, setUsePreset] = useState(null)

  const load = useCallback(async () => {
    if (!householdId) return
    try {
      const [all, favs, cats] = await Promise.all([
        fetchPresets(householdId, { includeArchived: true }),
        fetchFavourites(householdId),
        fetchCategories(),
      ])
      setCategories(cats)
      setFavouriteIds(new Set(favs.map((f) => f.id)))
      setPresets(all.filter((p) => p.source === 'household'))
      setSystemPresets(all.filter((p) => p.source === 'system'))
    } catch (e) {
      onToast?.(e.message || '載入失敗')
    }
  }, [householdId, onToast])

  useEffect(() => {
    load()
  }, [load])

  const active = presets.filter((p) => !p.archived_at)
  const archived = presets.filter((p) => p.archived_at)

  const list =
    view === 'archived'
      ? archived
      : view === 'system'
        ? systemPresets
        : active

  async function onFav(preset) {
    const isFav = favouriteIds.has(preset.id)
    const { error } = await toggleFavourite(
      householdId,
      preset.id,
      userId,
      isFav,
    )
    if (error) onToast?.(error.message)
    else {
      onToast?.(isFav ? '已移除常用' : '已加到常用')
      load()
    }
  }

  async function onArchive(preset) {
    const { count } = await countPresetUsage(preset.id)
    const warn =
      count > 0
        ? `「${preset.title_zh}」曾使用 ${count} 次。只會封存（唔會刪除紀錄），確認？`
        : `封存「${preset.title_zh}」？可稍後復原。`
    if (!confirm(warn)) return
    const { error } = await archiveHouseholdPreset(preset.id)
    if (error) onToast?.(error.message)
    else {
      onToast?.('已封存')
      setExpanded(null)
      load()
    }
  }

  async function onRestore(preset) {
    const { error } = await restoreHouseholdPreset(preset.id)
    if (error) onToast?.(error.message)
    else {
      onToast?.('已復原')
      load()
    }
  }

  async function onDup(preset) {
    const { error } =
      preset.source === 'system'
        ? await copySystemPresetToHousehold(preset, householdId, userId)
        : await duplicateHouseholdPreset(preset, householdId, userId)
    if (error) onToast?.(error.message)
    else {
      onToast?.(preset.source === 'system' ? '已複製到我的範本' : '已複製')
      setView('active')
      load()
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <h2 lang="zh-Hant" className="font-bold" tabIndex={-1} id="my-presets-heading">
        我的範本
        <span lang="id" className="ml-2 text-sm font-normal text-slate-500">
          / Templat saya
        </span>
      </h2>
      <p className="text-xs text-slate-500" lang="zh-Hant">
        家庭自訂範本可編輯；系統範本只可複製。姐姐只可睇，唔可以改。
      </p>

      <div
        role="tablist"
        aria-label="範本檢視"
        className="flex gap-2 overflow-x-auto"
      >
        {[
          { key: 'active', zh: '使用中', id: 'Aktif' },
          { key: 'archived', zh: '已封存', id: 'Diarsipkan' },
          { key: 'system', zh: '系統範本', id: 'Sistem' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            onClick={() => {
              setView(t.key)
              setExpanded(null)
            }}
            className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
              view === t.key
                ? 'bg-teal-700 text-white'
                : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {t.zh}
            <span className="sr-only"> / {t.id}</span>
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="text-sm text-slate-500" lang="zh-Hant">
          {view === 'archived'
            ? '未有封存範本'
            : view === 'system'
              ? '未載入系統範本'
              : '尚未有家庭範本 — 可從系統範本複製，或新增任務時「儲存為範本」'}
        </p>
      )}

      <div className="space-y-2" role="list" aria-label="範本列表">
        {list.map((p) => (
          <div key={p.id} className="space-y-2" role="listitem">
            <PresetCard
              preset={p}
              selected={expanded === p.id}
              favourited={favouriteIds.has(p.id)}
              showFavourite={view !== 'archived' && !String(p.id).startsWith('fallback:')}
              onToggleSelect={() =>
                setExpanded((s) => (s === p.id ? null : p.id))
              }
              onToggleFavourite={() => onFav(p)}
            />
            {expanded === p.id && (
              <div className="flex flex-wrap gap-2 pl-1">
                {view !== 'archived' && (
                  <button
                    type="button"
                    onClick={() => setUsePreset(p)}
                    className="min-h-11 rounded-xl border border-teal-300 bg-teal-50 px-3 text-sm font-semibold text-teal-900"
                  >
                    使用
                  </button>
                )}
                {p.source === 'household' && view === 'active' && (
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    編輯
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDup(p)}
                  className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
                >
                  {p.source === 'system' ? '複製到我的範本' : '複製'}
                </button>
                {view !== 'archived' && !String(p.id).startsWith('fallback:') && (
                  <button
                    type="button"
                    onClick={() => onFav(p)}
                    className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    {favouriteIds.has(p.id) ? '移除常用' : '加到常用'}
                  </button>
                )}
                {p.source === 'household' && view === 'active' && (
                  <button
                    type="button"
                    onClick={() => onArchive(p)}
                    className="min-h-11 rounded-xl border border-rose-200 px-3 text-sm text-rose-700"
                  >
                    封存
                  </button>
                )}
                {view === 'archived' && (
                  <button
                    type="button"
                    onClick={() => onRestore(p)}
                    className="min-h-11 rounded-xl border border-teal-300 bg-teal-50 px-3 text-sm font-semibold text-teal-900"
                  >
                    復原
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <PresetEditor
        open={!!editing}
        preset={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={load}
        onToast={onToast}
      />

      <AddTaskFlow
        open={!!usePreset}
        onClose={() => setUsePreset(null)}
        householdId={householdId}
        userId={userId}
        glossary={glossary}
        ensureToday={ensureToday}
        onCreated={() => {
          onCreated?.()
          load()
        }}
        onToast={onToast}
        initialPresetIds={usePreset ? [usePreset.id] : []}
      />
    </section>
  )
}

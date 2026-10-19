import { useCallback, useEffect, useState } from 'react'
import {
  archiveHouseholdPreset,
  duplicateHouseholdPreset,
  fetchPresets,
  toggleFavourite,
  fetchFavourites,
} from '../../lib/presets'
import PresetCard from './PresetCard'

export default function HouseholdPresetsManager({
  householdId,
  userId,
  onToast,
}) {
  const [presets, setPresets] = useState([])
  const [favouriteIds, setFavouriteIds] = useState(() => new Set())
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    if (!householdId) return
    const [all, favs] = await Promise.all([
      fetchPresets(householdId, { includeArchived: false }),
      fetchFavourites(householdId),
    ])
    setPresets(all.filter((p) => p.source === 'household'))
    setFavouriteIds(new Set(favs.map((f) => f.id)))
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  async function onFav(preset) {
    const isFav = favouriteIds.has(preset.id)
    const { error } = await toggleFavourite(
      householdId,
      preset.id,
      userId,
      isFav,
    )
    if (error) onToast?.(error.message)
    else load()
  }

  async function onArchive(preset) {
    if (!confirm(`封存「${preset.title_zh}」？`)) return
    const { error } = await archiveHouseholdPreset(preset.id)
    if (error) onToast?.(error.message)
    else {
      onToast?.('已封存')
      load()
    }
  }

  async function onDup(preset) {
    const { error } = await duplicateHouseholdPreset(
      preset,
      householdId,
      userId,
    )
    if (error) onToast?.(error.message)
    else {
      onToast?.('已複製')
      load()
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <h2 lang="zh-Hant" className="font-bold">
        我的範本
      </h2>
      <p className="text-xs text-slate-500">
        家庭自訂範本；姐姐只可睇，唔可以改。
      </p>
      {presets.length === 0 && (
        <p className="text-sm text-slate-500">尚未有家庭範本</p>
      )}
      <div className="space-y-2">
        {presets.map((p) => (
          <div key={p.id} className="space-y-2">
            <PresetCard
              preset={p}
              selected={selected === p.id}
              favourited={favouriteIds.has(p.id)}
              onToggleSelect={() =>
                setSelected((s) => (s === p.id ? null : p.id))
              }
              onToggleFavourite={() => onFav(p)}
            />
            {selected === p.id && (
              <div className="flex flex-wrap gap-2 pl-1">
                <button
                  type="button"
                  onClick={() => onDup(p)}
                  className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
                >
                  複製
                </button>
                <button
                  type="button"
                  onClick={() => onArchive(p)}
                  className="min-h-11 rounded-xl border border-rose-200 px-3 text-sm text-rose-700"
                >
                  封存
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

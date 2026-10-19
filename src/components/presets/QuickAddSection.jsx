import { useEffect, useState } from 'react'
import { Zap, X } from 'lucide-react'
import {
  buildQuickAddList,
  fetchFavourites,
  fetchPresets,
  fetchRecentUsage,
} from '../../lib/presets'
import QuickAddConfirm from './QuickAddConfirm'

const QUICK_ADD_VISIBLE = 6
const QUICK_ADD_POOL = 40
const HIDDEN_KEY = 'halo-kakak:quick-add-hidden:v1'

function readHidden() {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function writeHidden(set) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

/**
 * Quick Add: max 6 visible; favourites→recent→time→usage; 查看全部範本;
 * remove suggestion (local); confirm required via QuickAddConfirm.
 */
export default function QuickAddSection({
  householdId,
  userId,
  ensureToday,
  onCreated,
  onToast,
  onBrowseAll,
}) {
  const [items, setItems] = useState([])
  const [pick, setPick] = useState(null)
  const [hidden, setHidden] = useState(() => readHidden())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [favs, recent, all] = await Promise.all([
          fetchFavourites(householdId),
          fetchRecentUsage(householdId, 20),
          fetchPresets(householdId),
        ])
        if (cancelled) return
        const usageCounts = {}
        for (const r of recent) {
          usageCounts[r.id] = (usageCounts[r.id] || 0) + 1
        }
        const ranked = buildQuickAddList(
          { favourites: favs, recent, all, usageCounts },
          { limit: QUICK_ADD_POOL, max: QUICK_ADD_POOL },
        )
        const visible = ranked
          .filter((p) => !hidden.has(p.id))
          .slice(0, QUICK_ADD_VISIBLE)
        setItems(visible)
      } catch (e) {
        if (!cancelled) {
          onToast?.(e.message || "載入快速新增失敗")
          setItems([])
        }
      }
    }
    if (householdId) load()
    return () => {
      cancelled = true
    }
  }, [householdId, hidden])

  function removeSuggestion(id, e) {
    e?.stopPropagation?.()
    setHidden((prev) => {
      const next = new Set(prev)
      next.add(id)
      writeHidden(next)
      return next
    })
  }

  if (!items.length && !onBrowseAll) return null

  return (
    <section className="space-y-2">
      <h2
        lang="zh-Hant"
        className="flex items-center gap-1 text-sm font-bold text-slate-500"
      >
        <Zap className="h-4 w-4 text-teal-700" aria-hidden />
        快速新增
        <span lang="id" className="ml-1 font-normal text-slate-400">
          / Tambah cepat
        </span>
        <span className="ml-1 font-normal text-slate-400">
          ({items.length}/{QUICK_ADD_VISIBLE})
        </span>
      </h2>
      <div className="flex flex-wrap gap-2 pb-1">
        {items.map((p) => (
          <div key={p.id} className="group relative inline-flex max-w-full">
            <button
              type="button"
              onClick={() => setPick(p)}
              className="min-h-11 max-w-full shrink-0 truncate rounded-full border border-teal-200 bg-teal-50 py-1 pl-3 pr-8 text-sm font-semibold text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <span lang="zh-Hant">{p.title_zh}</span>
            </button>
            <button
              type="button"
              aria-label={`移除建議 ${p.title_zh}`}
              onClick={(e) => removeSuggestion(p.id, e)}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-teal-800/70 hover:bg-teal-100 hover:text-teal-950"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {onBrowseAll && (
        <button
          type="button"
          onClick={onBrowseAll}
          className="min-h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-teal-900"
        >
          查看全部範本
          <span lang="id" className="ml-1 font-normal text-slate-500">
            / Lihat semua templat
          </span>
        </button>
      )}
      <QuickAddConfirm
        open={!!pick}
        preset={pick}
        householdId={householdId}
        userId={userId}
        ensureToday={ensureToday}
        onClose={() => setPick(null)}
        onCreated={onCreated}
        onToast={onToast}
      />
    </section>
  )
}

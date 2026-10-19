import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import {
  buildQuickAddList,
  fetchFavourites,
  fetchPresets,
  fetchRecentUsage,
} from '../../lib/presets'
import QuickAddConfirm from './QuickAddConfirm'

const QUICK_ADD_LIMIT = 16
const QUICK_ADD_MAX = 20

export default function QuickAddSection({
  householdId,
  userId,
  ensureToday,
  onCreated,
  onToast,
}) {
  const [items, setItems] = useState([])
  const [pick, setPick] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [favs, recent, all] = await Promise.all([
        fetchFavourites(householdId),
        fetchRecentUsage(householdId, 20),
        fetchPresets(householdId),
      ])
      if (cancelled) return
      setItems(
        buildQuickAddList(
          { favourites: favs, recent, all },
          { limit: QUICK_ADD_LIMIT, max: QUICK_ADD_MAX },
        ),
      )
    }
    if (householdId) load()
    return () => {
      cancelled = true
    }
  }, [householdId])

  if (!items.length) return null

  return (
    <section className="space-y-2">
      <h2
        lang="zh-Hant"
        className="flex items-center gap-1 text-sm font-bold text-slate-500"
      >
        <Zap className="h-4 w-4 text-teal-700" aria-hidden />
        快速新增
        <span className="ml-1 font-normal text-slate-400">({items.length})</span>
      </h2>
      {/* Mobile-friendly wrap grid with max height + scroll if many chips */}
      <div className="max-h-36 overflow-y-auto overscroll-contain rounded-xl">
        <div className="flex flex-wrap gap-2 pb-1">
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPick(p)}
              className="min-h-11 max-w-full shrink-0 truncate rounded-full border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <span lang="zh-Hant">{p.title_zh}</span>
            </button>
          ))}
        </div>
      </div>
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

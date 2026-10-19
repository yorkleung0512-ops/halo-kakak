import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { fetchFavourites, fetchPresets } from '../../lib/presets'
import QuickAddConfirm from './QuickAddConfirm'

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
      const [favs, all] = await Promise.all([
        fetchFavourites(householdId),
        fetchPresets(householdId),
      ])
      if (cancelled) return
      const merged = []
      const seen = new Set()
      for (const p of [...favs, ...all]) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        merged.push(p)
        if (merged.length >= 6) break
      }
      setItems(merged)
    }
    if (householdId) load()
    return () => {
      cancelled = true
    }
  }, [householdId])

  if (!items.length) return null

  return (
    <section className="space-y-2">
      <h2 lang="zh-Hant" className="flex items-center gap-1 text-sm font-bold text-slate-500">
        <Zap className="h-4 w-4 text-teal-700" aria-hidden />
        快速新增
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPick(p)}
            className="min-h-11 shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <span lang="zh-Hant">{p.title_zh}</span>
          </button>
        ))}
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

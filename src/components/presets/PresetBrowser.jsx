import { useMemo, useState, useEffect, useRef } from 'react'
import PresetCard from './PresetCard'
import { filterPresets } from '../../lib/presets'

const TABS = [
  { key: 'favourites', label: '常用範本', labelId: 'Favorit' },
  { key: 'recent', label: '最近使用', labelId: 'Terbaru' },
  { key: 'mine', label: '我的範本', labelId: 'Templat saya' },
  { key: 'all', label: '全部範本', labelId: 'Semua' },
]

export default function PresetBrowser({
  categories,
  presets,
  favourites,
  recent,
  selectedIds,
  favouriteIds,
  onToggleSelect,
  onToggleFavourite,
  onContinue,
  libraryMeta,
}) {
  const [tab, setTab] = useState('all')
  const [categoryKey, setCategoryKey] = useState('all')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const headingRef = useRef(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200)
    return () => clearTimeout(t)
  }, [query])

  const baseList = useMemo(() => {
    if (tab === 'favourites') return favourites
    if (tab === 'recent') return recent
    if (tab === 'mine') return presets.filter((p) => p.source === 'household')
    return presets
  }, [tab, favourites, recent, presets])

  const filtered = useMemo(
    () =>
      filterPresets(baseList, {
        query: debounced,
        categoryKey:
          tab === 'mine' ? null : categoryKey === 'all' ? null : categoryKey,
        source: tab === 'mine' ? 'household' : null,
      }),
    [baseList, debounced, categoryKey, tab],
  )

  const chips = [
    { key: 'all', name_zh: '全部' },
    ...categories.filter((c) => c.key !== 'mine'),
    { key: 'mine', name_zh: '我的範本' },
  ]

  return (
    <div className="space-y-3">
      <h3
        ref={headingRef}
        tabIndex={-1}
        lang="zh-Hant"
        className="text-base font-bold text-slate-900 outline-none"
        id="browse-step-heading"
      >
        從範本選擇
        <span lang="id" className="ml-2 text-sm font-normal text-slate-500">
          / Pilih templat
        </span>
      </h3>

      {libraryMeta?.message && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          <span lang="zh-Hant">{libraryMeta.message.zh}</span>
          <span lang="id" className="mt-1 block">
            {libraryMeta.message.id}
          </span>
        </p>
      )}

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="範本範圍"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
              tab === t.key
                ? 'bg-teal-700 text-white'
                : 'border border-slate-200 bg-slate-100 text-slate-700'
            }`}
          >
            {t.label}
            <span className="sr-only"> / {t.labelId}</span>
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium" htmlFor="preset-search" lang="zh-Hant">
        搜尋範本
      </label>
      <input
        id="preset-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="用繁體中文搜尋…"
        className="w-full min-h-11 rounded-xl border border-slate-200 px-3"
      />

      {tab === 'all' && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="分類篩選"
        >
          {chips.map((c) => {
            const on = categoryKey === c.key
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => setCategoryKey(c.key)}
                className={`min-h-11 shrink-0 rounded-full border px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  on
                    ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {c.name_zh}
                {on && <span className="sr-only">（已選）</span>}
              </button>
            )
          })}
        </div>
      )}

      <p aria-live="polite" aria-atomic="true" className="text-xs text-slate-500">
        <span lang="zh-Hant">
          已選 {selectedIds.size} 項 · 顯示 {filtered.length} 個範本
        </span>
        <span lang="id" className="mt-0.5 block">
          Terpilih {selectedIds.size} · Menampilkan {filtered.length}
        </span>
      </p>

      <div
        role="group"
        aria-label="任務範本列表"
        className="max-h-[40vh] space-y-2 overflow-y-auto"
      >
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
            未搵到範本
          </p>
        )}
        {filtered.map((p) => (
          <PresetCard
            key={p.id}
            preset={p}
            selected={selectedIds.has(p.id)}
            favourited={favouriteIds.has(p.id)}
            onToggleSelect={() => onToggleSelect(p.id)}
            onToggleFavourite={() => onToggleFavourite(p)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={selectedIds.size === 0}
        onClick={onContinue}
        className="w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        套用範本（{selectedIds.size}）
      </button>
    </div>
  )
}

import { Star } from 'lucide-react'
import { recurrenceLabel } from '../../lib/presets'

export default function PresetCard({
  preset,
  selected,
  favourited,
  onToggleSelect,
  onToggleFavourite,
  showFavourite = true,
}) {
  const time = (preset.suggested_time || '').toString().slice(0, 5)
  const rec = recurrenceLabel(preset.suggested_recurrence)
  const sourceLabel =
    preset.source === 'household' ? '我的範本' : '系統範本'

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onToggleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleSelect?.()
        }
      }}
      className={`flex min-h-[44px] cursor-pointer gap-3 rounded-2xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
        selected
          ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {sourceLabel}
          </span>
          {preset.safety_warning && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              安全提示
            </span>
          )}
          {time && (
            <span className="text-[10px] text-slate-500">
              {time} · {rec}
            </span>
          )}
        </div>
        <p lang="zh-Hant" className="font-semibold text-slate-900">
          {preset.title_zh}
        </p>
        <p lang="id" className="text-sm text-slate-600">
          {preset.title_id}
        </p>
      </div>
      {showFavourite && onToggleFavourite && !String(preset.id).startsWith('fallback:') && (
        <button
          type="button"
          aria-pressed={favourited}
          aria-label={favourited ? '取消常用' : '加到常用範本'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavourite()
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200"
        >
          <Star
            className={`h-5 w-5 ${favourited ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`}
            aria-hidden
          />
        </button>
      )}
    </div>
  )
}

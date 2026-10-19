import { Star } from 'lucide-react'
import { recurrenceLabel } from '../../lib/presets'

/**
 * Checkbox-style selectable card (not role=option inside fake listbox).
 * Selection indicated by checkbox + border + text, not colour alone.
 */
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
  const name = preset.title_zh || preset.title_id || '範本'

  return (
    <div
      className={`flex min-h-[44px] gap-3 rounded-2xl border p-3 transition ${
        selected
          ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
          : 'border-slate-200 bg-white'
      }`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onToggleSelect?.()
            }
          }}
          className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
          aria-label={`選擇 ${name}`}
        />
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {sourceLabel}
            </span>
            {selected && (
              <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                已選
              </span>
            )}
            {preset.safety_warning && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                安全提示
              </span>
            )}
            {preset.archived_at && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                已封存
              </span>
            )}
            {time && (
              <span className="text-[10px] text-slate-500">
                {time} · {rec}
              </span>
            )}
          </span>
          <span lang="zh-Hant" className="block font-semibold text-slate-900">
            {preset.title_zh}
          </span>
          <span lang="id" className="block text-sm text-slate-600">
            {preset.title_id}
          </span>
        </span>
      </label>
      {showFavourite &&
        onToggleFavourite &&
        !String(preset.id).startsWith('fallback:') && (
          <button
            type="button"
            aria-pressed={favourited}
            aria-label={
              favourited
                ? `從常用移除「${name}」`
                : `將「${name}」加到常用範本`
            }
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavourite()
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <Star
              className={`h-5 w-5 ${
                favourited
                  ? 'fill-amber-400 text-amber-500'
                  : 'text-slate-400'
              }`}
              aria-hidden
            />
            <span className="sr-only">
              {favourited ? '常用中' : '非常用'}
            </span>
          </button>
        )}
    </div>
  )
}

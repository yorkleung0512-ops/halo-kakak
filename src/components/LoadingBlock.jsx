/**
 * Accessible loading placeholder — replaces bare "…" with aria-busy + optional skeleton.
 */
export default function LoadingBlock({
  label = '載入中',
  labelId = 'Memuat',
  compact = false,
  className = '',
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${
        compact ? 'py-4' : 'min-h-[8rem] py-8'
      } ${className}`}
    >
      <div className="w-full max-w-sm space-y-2 px-4" aria-hidden="true">
        <div className="h-3 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-3 w-4/5 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-3 w-3/5 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <p className="text-sm">
        <span lang="zh-Hant">{label}</span>
        <span className="mx-1 opacity-50" aria-hidden>
          /
        </span>
        <span lang="id">{labelId}</span>
      </p>
    </div>
  )
}

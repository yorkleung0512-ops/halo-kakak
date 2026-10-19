/**
 * Compact employer summary strip / lighter helper line.
 * Counts derived from already-loaded tasks — no extra queries.
 */
export default function TodaySummaryStrip({
  counts,
  isHelper,
}) {
  if (!counts) return null

  if (isHelper) {
    const line = `Hari ini ${counts.today} tugas · ${counts.incomplete} belum selesai · ${counts.completed} selesai${
      counts.needsHandling ? ` · ${counts.needsHandling} perlu ditanggapi` : ''
    }${counts.newForHelper ? ` · ${counts.newForHelper} baru` : ''}`
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={line}
        lang="id"
        className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2 text-sm text-teal-950"
      >
        <p className="font-medium">{line}</p>
      </div>
    )
  }

  // Employer: one compact strip, secondary under 需要處理
  const primary = `今日 ${counts.today}項 · 待完成 ${counts.incomplete} · 已完成 ${counts.completed}`
  const secondary = [
    counts.needsHandling ? `需要處理 ${counts.needsHandling}` : null,
    counts.overdue ? `逾期 ${counts.overdue}` : null,
    counts.awaitingAck ? `等待確認 ${counts.awaitingAck}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${primary}${secondary ? `。${secondary}` : ''}`}
      lang="zh-Hant"
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm"
    >
      <p className="font-semibold text-slate-900">{primary}</p>
      {secondary && (
        <p className="mt-0.5 text-xs text-slate-600">{secondary}</p>
      )}
    </div>
  )
}

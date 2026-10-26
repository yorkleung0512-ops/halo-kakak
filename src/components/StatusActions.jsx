import { HELPER_ACTIONS, STATUS_LABELS } from '../lib/constants'

export default function StatusActions({
  isHelper,
  currentStatus,
  onAction,
  disabled,
  lang = 'zh',
}) {
  if (!isHelper) {
    const meta = STATUS_LABELS[currentStatus] || STATUS_LABELS.pending
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        <span aria-hidden>{meta.icon}</span>
        <span lang={lang === 'id' ? 'id' : 'zh-Hant'}>
          {lang === 'id' ? meta.id : meta.zh}
        </span>
      </span>
    )
  }

  // Helper chrome: Indonesian only. Chinese stays on the task body secondary line.
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Tindakan tugas">
      {HELPER_ACTIONS.map((a) => {
        const active = currentStatus === a.status
        return (
          <button
            key={a.status}
            type="button"
            disabled={disabled}
            onClick={() => onAction(a)}
            aria-label={a.id}
            aria-pressed={active}
            className={`min-h-11 min-w-11 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 ${
              active
                ? 'bg-teal-700 text-white'
                : 'border border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100'
            }`}
          >
            <span lang="id">{a.id}</span>
          </button>
        )
      })}
    </div>
  )
}

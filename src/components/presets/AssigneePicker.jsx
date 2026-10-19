/**
 * Assignee select: active helpers + 暫不指派.
 */
export default function AssigneePicker({
  id,
  helpers,
  value,
  onChange,
  disabled = false,
}) {
  const single = helpers.length === 1 ? helpers[0].user_id : ''
  const effective = value === undefined || value === null ? '' : value

  return (
    <div>
      <label className="text-xs" htmlFor={id} lang="zh-Hant">
        指派給
      </label>
      <select
        id={id}
        disabled={disabled || helpers.length === 0}
        value={effective || (helpers.length === 1 ? single : '')}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-2"
      >
        <option value="">暫不指派</option>
        {helpers.map((h) => (
          <option key={h.user_id} value={h.user_id}>
            {h.display_name}
          </option>
        ))}
      </select>
      {helpers.length === 0 && (
        <p lang="zh-Hant" className="mt-1 text-[11px] text-slate-500">
          未有活躍姐姐 — 可稍後再指派
        </p>
      )}
    </div>
  )
}

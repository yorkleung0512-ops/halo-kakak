import { HIGH_RISK_WARNING } from '../../lib/constants'
import { detectSensitiveContent, recurrenceLabel } from '../../lib/presets'

const PRIORITY_ZH = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '緊急',
}

export default function PreviewStep({
  drafts,
  onChangeDraft,
  onBack,
  onSubmit,
  onSaveAsTemplate,
  onRetranslate,
  submitting,
  helpers = [],
}) {
  function helperName(id) {
    if (!id) return '暫不指派 / Belum ditugaskan'
    return helpers.find((h) => h.user_id === id)?.display_name || '姐姐'
  }

  const unreviewed = drafts.filter((d) => !d.translation_approved).length
  const adhocCount = drafts.filter((d) => d.mode === 'adhoc').length
  const scheduledCount = drafts.filter((d) => d.mode === 'scheduled').length

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <p lang="zh-Hant" className="font-semibold text-slate-800">
          共 {drafts.length} 項
          {adhocCount ? ` · 臨時 ${adhocCount}` : ''}
          {scheduledCount ? ` · 排程 ${scheduledCount}` : ''}
        </p>
        <p lang="id" className="text-xs text-slate-600">
          Total {drafts.length}
          {adhocCount ? ` · sekali ${adhocCount}` : ''}
          {scheduledCount ? ` · jadwal ${scheduledCount}` : ''}
        </p>
        {unreviewed > 0 && (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-amber-50 px-2 py-1.5 text-xs text-amber-950"
            lang="zh-Hant"
          >
            有 {unreviewed} 項印尼文未核對 — 建立後姐姐仍見得到，建議先核對。
            <span lang="id" className="mt-0.5 block">
              {unreviewed} terjemahan ID belum ditinjau.
            </span>
          </p>
        )}
      </div>

      <p lang="zh-Hant" className="text-sm text-slate-600">
        預覽雙語內容。未改中文唔會呼叫翻譯。可返回修改。
      </p>

      {drafts.map((d, idx) => {
        const risk =
          d.preset.safety_warning ||
          detectSensitiveContent(
            `${d.title_zh} ${d.instructions_zh} ${d.additional_instructions_zh || ''}`,
          ).sensitive
        const rec = {
          rule: d.recurrence_rule,
          weekdays: d.recurrence_weekdays,
          interval: d.recurrence_interval || 1,
        }
        return (
          <div
            key={d.preset.id}
            className="space-y-2 rounded-2xl border border-slate-200 p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  d.mode === 'adhoc'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-teal-100 text-teal-900'
                }`}
              >
                {d.mode === 'adhoc'
                  ? '臨時任務 · Tugas sekali'
                  : '排程任務 · Jadwal'}
              </span>
              <span className="text-slate-500">
                {d.date || '—'}
                {d.time ? ` · ${d.time}` : ''}
              </span>
              <span className="text-slate-500">
                優先：{PRIORITY_ZH[d.priority] || d.priority}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              指派：{helperName(d.assigned_to)}
            </p>

            {d.mode === 'scheduled' && (
              <p className="text-xs text-slate-600">
                重複：{recurrenceLabel(rec, 'zh')} ·{' '}
                {recurrenceLabel(rec, 'id')}
                {d.start_date ? ` · 起 ${d.start_date}` : ''}
                {d.neverEnds !== false || !d.end_date
                  ? ' · 永不結束 / Tidak pernah berakhir'
                  : ` · 至 ${d.end_date}`}
              </p>
            )}

            <label className="block text-xs" htmlFor={`zh-${idx}`}>
              標題（中文）
            </label>
            <textarea
              id={`zh-${idx}`}
              lang="zh-Hant"
              rows={2}
              value={d.title_zh}
              onChange={(e) =>
                onChangeDraft(idx, {
                  title_zh: e.target.value,
                  zhEdited: true,
                  translation_approved: false,
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <label className="block text-xs" htmlFor={`id-${idx}`}>
              Judul (Bahasa Indonesia)
            </label>
            <textarea
              id={`id-${idx}`}
              lang="id"
              rows={2}
              value={d.title_id}
              onChange={(e) =>
                onChangeDraft(idx, {
                  title_id: e.target.value,
                  translation_approved: false,
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />

            {(d.instructions_zh || d.instructions_id) && (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-slate-500">詳細指示</p>
                {d.instructions_zh && (
                  <p lang="zh-Hant" className="text-slate-700">
                    {d.instructions_zh}
                  </p>
                )}
                {d.instructions_id && (
                  <p lang="id" className="mt-1 text-slate-600">
                    {d.instructions_id}
                  </p>
                )}
              </div>
            )}

            {(d.additional_instructions_zh || d.additional_instructions_id) && (
              <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm">
                <p lang="zh-Hant" className="text-xs font-semibold text-teal-900">
                  補充指示 / Instruksi tambahan
                </p>
                {d.additional_instructions_zh && (
                  <p lang="zh-Hant" className="text-teal-950">
                    {d.additional_instructions_zh}
                  </p>
                )}
                {d.additional_instructions_id && (
                  <p lang="id" className="mt-1 text-teal-900">
                    {d.additional_instructions_id}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500">
              翻譯狀態：
              {d.translation_approved
                ? '已核對 ✓'
                : '未核對印尼文'}
              {d.preset.safety_warning ? ' · 安全提示範本' : ''}
            </p>

            {d.zhEdited && (
              <button
                type="button"
                onClick={() => onRetranslate?.(idx)}
                className="min-h-11 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900"
              >
                重新翻譯
              </button>
            )}
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!d.translation_approved}
                onChange={(e) =>
                  onChangeDraft(idx, {
                    translation_approved: e.target.checked,
                  })
                }
              />
              我已核對印尼文 / Saya sudah periksa ID
            </label>
            {risk && (
              <div
                role="alert"
                className="rounded-xl bg-amber-50 p-2 text-xs text-amber-950"
              >
                <p lang="zh-Hant">{HIGH_RISK_WARNING.zh}</p>
                <p lang="id">{HIGH_RISK_WARNING.id}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => onSaveAsTemplate?.(idx)}
              className="min-h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold"
            >
              儲存為範本
            </button>
          </div>
        )
      })}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 disabled:opacity-50"
        >
          返回修改
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          aria-busy={submitting}
          className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-50"
        >
          {submitting
            ? '正在建立任務…'
            : drafts.length > 1
              ? `建立 ${drafts.length} 項任務`
              : drafts[0]?.mode === 'scheduled'
                ? '建立排程'
                : '加入任務'}
        </button>
      </div>
    </div>
  )
}

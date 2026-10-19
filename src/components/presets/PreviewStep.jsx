import { HIGH_RISK_WARNING } from '../../lib/constants'
import { detectSensitiveContent } from '../../lib/presets'

export default function PreviewStep({
  drafts,
  onChangeDraft,
  onBack,
  onSubmit,
  onSaveAsTemplate,
  onRetranslate,
  submitting,
}) {
  return (
    <div className="space-y-4">
      <p lang="zh-Hant" className="text-sm text-slate-600">
        預覽雙語內容。未改中文唔會呼叫翻譯。
      </p>
      {drafts.map((d, idx) => {
        const risk =
          d.preset.safety_warning ||
          detectSensitiveContent(`${d.title_zh} ${d.instructions_zh}`).sensitive
        return (
          <div
            key={d.preset.id}
            className="space-y-2 rounded-2xl border border-slate-200 p-3"
          >
            <p className="text-xs font-semibold text-slate-500">
              {d.mode === 'adhoc' ? '臨時任務 · Tugas sekali' : '排程任務'}
              {d.time ? ` · ${d.time}` : ''}
            </p>
            <label className="block text-xs" htmlFor={`zh-${idx}`}>
              中文
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
              Bahasa Indonesia
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
              我已核對印尼文
            </label>
            {risk && (
              <div role="alert" className="rounded-xl bg-amber-50 p-2 text-xs text-amber-950">
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
          className="min-h-11 flex-1 rounded-xl border border-slate-200"
        >
          返回
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-50"
        >
          {drafts.length > 1
            ? `建立 ${drafts.length} 項任務`
            : drafts[0]?.mode === 'scheduled'
              ? '建立排程'
              : '加入任務'}
        </button>
      </div>
    </div>
  )
}

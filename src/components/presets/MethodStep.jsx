import { BookOpen, PenLine } from 'lucide-react'

export default function MethodStep({ onChooseTemplate, onChooseCustom }) {
  return (
    <div className="space-y-3">
      <p lang="zh-Hant" className="text-sm text-slate-600">
        建議先由範本選擇，慳時間又有核准雙語。
      </p>
      <button
        type="button"
        onClick={onChooseTemplate}
        className="flex w-full min-h-[72px] items-center gap-3 rounded-2xl border-2 border-teal-600 bg-teal-50 px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        <BookOpen className="h-7 w-7 shrink-0 text-teal-800" aria-hidden />
        <div>
          <p lang="zh-Hant" className="font-bold text-teal-950">
            從範本選擇
          </p>
          <p className="text-xs text-teal-800">推薦 · 雙語即用</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onChooseCustom}
        className="flex w-full min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        <PenLine className="h-7 w-7 shrink-0 text-slate-600" aria-hidden />
        <div>
          <p lang="zh-Hant" className="font-bold text-slate-900">
            自訂任務
          </p>
          <p className="text-xs text-slate-500">手動輸入並翻譯</p>
        </div>
      </button>
    </div>
  )
}

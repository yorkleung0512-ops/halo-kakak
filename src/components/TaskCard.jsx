import { Volume2, AlertTriangle, Pencil } from 'lucide-react'
import { STATUS_LABELS, formatTimeHK, isHighRisk } from '../lib/constants'
import { speakIndonesian } from '../lib/translateClient'
import StatusActions from './StatusActions'

export default function TaskCard({
  task,
  isHelperView,
  canAct,
  onStatusAction,
  onEdit,
  canEdit,
  highlight,
  readOnly,
  htmlId,
}) {
  const meta = STATUS_LABELS[task.status] || STATUS_LABELS.pending
  const risk = isHighRisk(`${task.title_zh} ${task.instructions_zh || ''}`)
  const time =
    formatTimeHK(task.due_at) ||
    (task.due_at ? '' : '') ||
    (task.task_date ? '' : '')

  return (
    <article
      id={htmlId || (task?.id ? `task-${task.id}` : undefined)}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlight
          ? 'border-teal-400 ring-2 ring-teal-100'
          : task.status === 'completed'
            ? 'border-emerald-200 bg-emerald-50/30'
            : task.status === 'needs_clarification'
              ? 'border-amber-300'
              : 'border-slate-200'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {time && (
            <p className="mb-1 text-xs font-semibold text-teal-700">{time}</p>
          )}
          <h3 lang="zh-Hant" className="text-base font-bold text-slate-900">
            {task.title_zh}
          </h3>
          {task.title_id && (
            <p lang="id" className="mt-0.5 text-sm text-slate-600">
              {task.title_id}
              {!task.translation_approved && (
                <span className="ml-1 text-[10px] text-amber-700">
                  ({isHelperView ? 'terjemahan mesin' : '機器翻譯'})
                </span>
              )}
            </p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          <span aria-hidden>{meta.icon}</span>
          <span lang={isHelperView ? 'id' : 'zh-Hant'}>
            {isHelperView ? meta.id : meta.zh}
          </span>
        </span>
      </div>

      {(task.instructions_zh || task.instructions_id) && (
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          {task.instructions_zh && (
            <p lang="zh-Hant" className="text-slate-700">
              {task.instructions_zh}
            </p>
          )}
          {task.instructions_id && (
            <p lang="id" className="mt-1 text-slate-600">
              {task.instructions_id}
            </p>
          )}
        </div>
      )}

      {(task.additional_instructions_zh || task.additional_instructions_id) && (
        <div className="mb-3 rounded-xl bg-teal-50 px-3 py-2 text-sm">
          <p lang="zh-Hant" className="text-xs font-semibold text-teal-900">
            補充指示
          </p>
          {task.additional_instructions_zh && (
            <p lang="zh-Hant" className="text-teal-950">
              {task.additional_instructions_zh}
            </p>
          )}
          {task.additional_instructions_id && (
            <p lang="id" className="mt-1 text-teal-900">
              {task.additional_instructions_id}
            </p>
          )}
        </div>
      )}

      {risk && (
        <div
          role="alert"
          className="mb-3 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p lang="zh-Hant">
              ⚠️ 呢個指示可能涉及藥物、過敏、幼兒安全、煮食溫度或緊急情況。請僱主同姐姐一齊確認意思，唔好單靠機器翻譯。
            </p>
            <p lang="id" className="mt-1">
              ⚠️ Instruksi ini mungkin terkait obat, alergi, keselamatan anak, suhu memasak, atau keadaan darurat. Majikan dan kakak harap konfirmasi bersama; jangan mengandalkan terjemahan mesin saja.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && !readOnly && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label="編輯任務"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            編輯
          </button>
        )}
        {task.title_id && (
          <button
            type="button"
            onClick={() => speakIndonesian(task.title_id)}
            aria-label="朗讀印尼文"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <Volume2 className="h-4 w-4" aria-hidden />
            {isHelperView ? 'Dengarkan' : '朗讀'}
          </button>
        )}
        {canAct && !readOnly && (
          <StatusActions
            isHelper={isHelperView}
            currentStatus={task.status}
            onAction={onStatusAction}
            lang={isHelperView ? 'id' : 'zh'}
          />
        )}
      </div>
    </article>
  )
}

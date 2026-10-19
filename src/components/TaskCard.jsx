import { Volume2, AlertTriangle, Pencil, MessageCircle } from 'lucide-react'
import { STATUS_LABELS, formatTimeHK, isHighRisk } from '../lib/constants'
import { speakIndonesian } from '../lib/translateClient'
import StatusActions from './StatusActions'
import { formatRecurrence } from '../lib/recurrenceFormat'
import {
  isAdHoc,
  isOverdue,
  taskTypeBadge,
} from '../lib/todayClassify'

const PRIORITY_LABEL = {
  urgent: { zh: '緊急', id: 'Mendesak' },
  high: { zh: '高', id: 'Tinggi' },
  normal: { zh: '一般', id: 'Normal' },
  low: { zh: '低', id: 'Rendah' },
}

export default function TaskCard({
  task,
  isHelperView,
  canAct,
  onStatusAction,
  onEdit,
  onOpen,
  canEdit,
  highlight,
  readOnly,
  htmlId,
  assigneeName,
  template,
  commentCount = 0,
  unsynced = false,
  showNewBadge = false,
  hasUnreadNotif = false,
  forceOverdueBadge = false,
  hero = false,
  lang: langProp,
}) {
  const lang = langProp || (isHelperView ? 'id' : 'zh')
  const meta = STATUS_LABELS[task.status] || STATUS_LABELS.pending
  const risk = isHighRisk(
    `${task.title_zh} ${task.instructions_zh || ''} ${task.additional_instructions_zh || ''}`,
  )
  const time = formatTimeHK(task.due_at)
  const overdue = forceOverdueBadge || isOverdue(task)
  const typeLabel = taskTypeBadge(task, lang === 'id' ? 'id' : 'zh')
  const recurrence =
    template && !isAdHoc(task)
      ? formatRecurrence(template, lang === 'id' ? 'id' : 'zh', {
          time: template.default_time,
        })
      : ''
  const priority = task.priority && task.priority !== 'normal'
    ? PRIORITY_LABEL[task.priority] || null
    : null

  const primaryTitle = isHelperView
    ? task.title_id || task.title_zh
    : task.title_zh
  const secondaryTitle = isHelperView
    ? task.title_zh && task.title_id
      ? task.title_zh
      : null
    : task.title_id || null

  function openDetail(e) {
    // Don't open when clicking buttons / interactive controls
    if (e?.target?.closest?.('button, a, input, select, textarea')) return
    onOpen?.(task)
  }

  return (
    <article
      id={htmlId || (task?.id ? `task-${task.id}` : undefined)}
      tabIndex={onOpen ? 0 : undefined}
      role={onOpen ? 'button' : undefined}
      onClick={onOpen ? openDetail : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(task)
              }
            }
          : undefined
      }
      aria-label={primaryTitle || 'task'}
      className={`rounded-2xl border bg-white p-4 shadow-sm outline-none transition ${
        onOpen ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-600' : ''
      } ${
        highlight || hero
          ? 'border-teal-400 ring-2 ring-teal-100'
          : task.status === 'completed'
            ? 'border-emerald-200 bg-emerald-50/30'
            : task.status === 'needs_clarification' ||
                task.status === 'cannot_complete' ||
                task.status === 'delayed'
              ? 'border-amber-300'
              : overdue
                ? 'border-rose-200'
                : 'border-slate-200'
      }`}
    >
      {/* 1. Due time + title */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {time ? (
              <p
                className={`text-xs font-bold ${overdue ? 'text-rose-700' : 'text-teal-700'}`}
              >
                {time}
                {overdue && (
                  <span className="ml-1 font-semibold" lang={lang === 'id' ? 'id' : 'zh-Hant'}>
                    {lang === 'id' ? '· Terlambat' : '· 逾期'}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs font-semibold text-slate-400" lang={lang === 'id' ? 'id' : 'zh-Hant'}>
                {lang === 'id' ? 'Tanpa waktu' : '未定時間'}
              </p>
            )}
            {(showNewBadge || hasUnreadNotif) && task.status === 'pending' && (
              <span
                lang="id"
                className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              >
                Baru
              </span>
            )}
            {unsynced && (
              <span
                lang={lang === 'id' ? 'id' : 'zh-Hant'}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
              >
                {lang === 'id' ? 'Belum sinkron' : '尚未同步'}
              </span>
            )}
          </div>
          <h3
            lang={isHelperView ? 'id' : 'zh-Hant'}
            className={`font-bold text-slate-900 ${hero ? 'text-lg' : 'text-base'}`}
          >
            {primaryTitle}
          </h3>
          {secondaryTitle && (
            <p
              lang={isHelperView ? 'zh-Hant' : 'id'}
              className="mt-0.5 text-sm text-slate-600"
            >
              {secondaryTitle}
              {!task.translation_approved && task.title_id && (
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

      {/* 2. Status / type / priority badges */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          lang={lang === 'id' ? 'id' : 'zh-Hant'}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
          title={isAdHoc(task) ? 'ad-hoc' : 'scheduled'}
        >
          {typeLabel}
        </span>
        {priority && (
          <span
            lang={lang === 'id' ? 'id' : 'zh-Hant'}
            className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
              task.priority === 'urgent'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-orange-50 text-orange-900'
            }`}
          >
            {lang === 'id' ? priority.id : priority.zh}
          </span>
        )}
        {commentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            {commentCount}
          </span>
        )}
      </div>

      {/* 3. Assignee + recurrence */}
      <div className="mb-2 space-y-0.5 text-xs text-slate-600">
        {assigneeName && (
          <p lang={lang === 'id' ? 'id' : 'zh-Hant'}>
            {lang === 'id' ? 'Ditugaskan: ' : '指派：'}
            <span className="font-medium text-slate-800">{assigneeName}</span>
          </p>
        )}
        {recurrence && (
          <p lang={lang === 'id' ? 'id' : 'zh-Hant'} className="text-slate-500">
            {recurrence}
          </p>
        )}
      </div>

      {/* Instructions — compact on non-hero */}
      {(task.instructions_zh || task.instructions_id) && hero && (
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          {isHelperView && task.instructions_id ? (
            <p lang="id" className="text-slate-700">
              {task.instructions_id}
            </p>
          ) : (
            task.instructions_zh && (
              <p lang="zh-Hant" className="text-slate-700">
                {task.instructions_zh}
              </p>
            )
          )}
        </div>
      )}

      {(task.additional_instructions_zh || task.additional_instructions_id) && (
        <div className="mb-3 rounded-xl bg-teal-50 px-3 py-2 text-sm">
          <p lang="zh-Hant" className="text-xs font-semibold text-teal-900">
            補充指示
          </p>
          {isHelperView && task.additional_instructions_id ? (
            <p lang="id" className="text-teal-950">
              {task.additional_instructions_id}
            </p>
          ) : (
            task.additional_instructions_zh && (
              <p lang="zh-Hant" className="text-teal-950">
                {task.additional_instructions_zh}
              </p>
            )
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

      <div
        className="flex flex-wrap items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
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

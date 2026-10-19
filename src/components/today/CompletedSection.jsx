import { useState } from 'react'
import TaskCard from '../TaskCard'

export default function CompletedSection({
  tasks,
  isHelper,
  deepTaskId,
  onOpen,
  assigneeNames,
  templatesById,
  commentCounts,
}) {
  const [open, setOpen] = useState(false)
  if (!tasks?.length) return null

  const collapse = tasks.length > 3
  const shown = collapse && !open ? tasks.slice(0, 3) : tasks

  return (
    <section aria-labelledby="today-completed-heading">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          id="today-completed-heading"
          lang={isHelper ? 'id' : 'zh-Hant'}
          className="text-sm font-bold text-slate-500"
        >
          {isHelper
            ? `Selesai hari ini (${tasks.length})`
            : `今日已完成 (${tasks.length})`}
        </h2>
        {collapse && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="min-h-11 rounded-xl px-3 text-xs font-semibold text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <span lang={isHelper ? 'id' : 'zh-Hant'}>
              {open
                ? isHelper
                  ? 'Sembunyikan'
                  : '收合'
                : isHelper
                  ? 'Lihat semua'
                  : '展開全部'}
            </span>
          </button>
        )}
      </div>
      <div className="space-y-3">
        {shown.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            highlight={deepTaskId === t.id}
            isHelperView={isHelper}
            canAct={false}
            canEdit={false}
            onOpen={onOpen}
            assigneeName={assigneeNames?.[t.assigned_to]}
            template={templatesById?.[t.template_id]}
            commentCount={commentCounts?.[t.id] || 0}
            lang={isHelper ? 'id' : 'zh'}
          />
        ))}
      </div>
    </section>
  )
}

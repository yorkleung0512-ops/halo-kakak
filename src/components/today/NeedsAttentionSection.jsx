import TaskCard from '../TaskCard'

export default function NeedsAttentionSection({
  tasks,
  isHelper,
  deepTaskId,
  canAct,
  canEdit,
  readOnly,
  onEdit,
  onOpen,
  onStatusAction,
  assigneeNames,
  templatesById,
  commentCounts,
  pendingIds,
  emptyHint,
}) {
  const lang = isHelper ? 'id' : 'zh'
  if (!tasks?.length) {
    if (!emptyHint) return null
    return (
      <p
        lang={isHelper ? 'id' : 'zh-Hant'}
        className="text-sm text-slate-500"
      >
        {emptyHint}
      </p>
    )
  }

  return (
    <section aria-labelledby="today-needs-attention-heading">
      <h2
        id="today-needs-attention-heading"
        lang={isHelper ? 'id' : 'zh-Hant'}
        className="mb-2 text-sm font-bold text-amber-800"
      >
        {isHelper
          ? `Perlu ditanggapi (${tasks.length})`
          : `需要處理 (${tasks.length})`}
      </h2>
      <div className="space-y-3">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            highlight={deepTaskId === t.id}
            isHelperView={isHelper}
            canAct={canAct}
            canEdit={canEdit}
            readOnly={readOnly}
            onEdit={onEdit}
            onOpen={onOpen}
            onStatusAction={(a) => onStatusAction?.(t, a)}
            assigneeName={assigneeNames?.[t.assigned_to]}
            template={templatesById?.[t.template_id]}
            commentCount={commentCounts?.[t.id] || 0}
            unsynced={pendingIds?.has?.(t.id)}
            showNewBadge={false}
            lang={lang}
          />
        ))}
      </div>
    </section>
  )
}

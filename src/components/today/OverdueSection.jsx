import TaskCard from '../TaskCard'

export default function OverdueSection({
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
}) {
  if (!tasks?.length) return null

  return (
    <section aria-labelledby="today-overdue-heading">
      <h2
        id="today-overdue-heading"
        lang={isHelper ? 'id' : 'zh-Hant'}
        className="mb-2 text-sm font-bold text-rose-700"
      >
        {isHelper ? `Terlambat (${tasks.length})` : `逾期 (${tasks.length})`}
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
            forceOverdueBadge
            lang={isHelper ? 'id' : 'zh'}
          />
        ))}
      </div>
    </section>
  )
}

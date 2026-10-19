import TaskCard from '../TaskCard'

/** Helper-only: Tugas baru */
export default function NewTasksSection({
  tasks,
  deepTaskId,
  canAct,
  readOnly,
  onOpen,
  onStatusAction,
  assigneeNames,
  templatesById,
  commentCounts,
  pendingIds,
  unreadTaskIds,
}) {
  if (!tasks?.length) return null

  return (
    <section aria-labelledby="today-new-tasks-heading">
      <h2
        id="today-new-tasks-heading"
        lang="id"
        className="mb-2 text-sm font-bold text-teal-800"
      >
        Tugas baru ({tasks.length})
      </h2>
      <div className="space-y-3">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            highlight={deepTaskId === t.id}
            isHelperView
            canAct={canAct}
            readOnly={readOnly}
            onOpen={onOpen}
            onStatusAction={(a) => onStatusAction?.(t, a)}
            assigneeName={assigneeNames?.[t.assigned_to]}
            template={templatesById?.[t.template_id]}
            commentCount={commentCounts?.[t.id] || 0}
            unsynced={pendingIds?.has?.(t.id)}
            showNewBadge
            hasUnreadNotif={unreadTaskIds?.has?.(t.id)}
            lang="id"
          />
        ))}
      </div>
    </section>
  )
}

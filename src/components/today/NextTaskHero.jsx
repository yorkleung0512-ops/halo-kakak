import TaskCard from '../TaskCard'

export default function NextTaskHero({
  task,
  deepTaskId,
  canAct,
  readOnly,
  onOpen,
  onStatusAction,
  assigneeName,
  template,
  commentCount,
  unsynced,
  showNewBadge,
  hasUnreadNotif,
}) {
  if (!task) {
    return (
      <section
        aria-labelledby="today-next-hero-heading"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"
      >
        <h2
          id="today-next-hero-heading"
          lang="id"
          className="text-sm font-bold text-emerald-900"
        >
          Tugas berikutnya
        </h2>
        <p lang="id" className="mt-2 text-base font-semibold text-emerald-950">
          Semua tugas hari ini sudah selesai
        </p>
        <p lang="zh-Hant" className="mt-1 text-sm text-emerald-800">
          今日工作已全部完成
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="today-next-hero-heading">
      <h2
        id="today-next-hero-heading"
        lang="id"
        className="mb-2 text-sm font-bold text-slate-500"
      >
        Tugas berikutnya
      </h2>
      <div className="rounded-2xl ring-2 ring-teal-200 ring-offset-2">
        <TaskCard
          task={task}
          highlight={deepTaskId ? deepTaskId === task.id : true}
          isHelperView
          canAct={canAct}
          readOnly={readOnly}
          onOpen={onOpen}
          onStatusAction={(a) => onStatusAction?.(task, a)}
          assigneeName={assigneeName}
          template={template}
          commentCount={commentCount || 0}
          unsynced={unsynced}
          showNewBadge={showNewBadge}
          hasUnreadNotif={hasUnreadNotif}
          hero
          lang="id"
        />
      </div>
    </section>
  )
}

import TaskCard from '../TaskCard'

const EMPTY_COPY = {
  all_done: {
    id: 'Semua tugas hari ini sudah selesai',
    zh: '今日工作已全部完成',
  },
  no_tasks: {
    id: 'Belum ada tugas dari majikan hari ini',
    zh: '今日僱主尚未指派任務',
  },
  focus_above: {
    id: 'Selesaikan tugas di atas dulu',
    zh: '請先處理上方嘅新任務或需跟進事項',
  },
}

export default function NextTaskHero({
  task,
  emptyKind = 'all_done',
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
    const copy = EMPTY_COPY[emptyKind] || EMPTY_COPY.all_done
    const tone =
      emptyKind === 'focus_above'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-emerald-200 bg-emerald-50/50'
    const titleTone =
      emptyKind === 'focus_above' ? 'text-amber-900' : 'text-emerald-900'
    const bodyTone =
      emptyKind === 'focus_above' ? 'text-amber-950' : 'text-emerald-950'
    const subTone =
      emptyKind === 'focus_above' ? 'text-amber-800' : 'text-emerald-800'
    return (
      <section
        aria-labelledby="today-next-hero-heading"
        className={`rounded-2xl border p-4 ${tone}`}
      >
        <h2
          id="today-next-hero-heading"
          lang="id"
          className={`text-sm font-bold ${titleTone}`}
        >
          Tugas berikutnya
        </h2>
        <p lang="id" className={`mt-2 text-base font-semibold ${bodyTone}`}>
          {copy.id}
        </p>
        <p lang="zh-Hant" className={`mt-1 text-sm ${subTone}`}>
          {copy.zh}
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

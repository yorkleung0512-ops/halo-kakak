import { useMemo, useState } from 'react'
import TaskCard from '../TaskCard'
import { isAdHoc, isScheduled } from '../../lib/todayClassify'

const FILTERS = [
  { id: 'all', zh: '全部', idLabel: 'Semua' },
  { id: 'adhoc', zh: '臨時', idLabel: 'Sekali' },
  { id: 'scheduled', zh: '排程', idLabel: 'Terjadwal' },
]

export default function TodayTimeline({
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
  unreadTaskIds,
  excludeIds,
}) {
  const [filter, setFilter] = useState('all')
  const lang = isHelper ? 'id' : 'zh'

  const visible = useMemo(() => {
    const ex = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || [])
    return (tasks || []).filter((t) => {
      if (ex.has(t.id)) return false
      if (t.status === 'cancelled') return false
      if (t.status === 'completed') return false
      if (filter === 'adhoc') return isAdHoc(t)
      if (filter === 'scheduled') return isScheduled(t)
      return true
    })
  }, [tasks, filter, excludeIds])

  return (
    <section aria-labelledby="today-timeline-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="today-timeline-heading"
          lang={isHelper ? 'id' : 'zh-Hant'}
          className="text-sm font-bold text-slate-500"
        >
          {isHelper ? 'Jadwal hari ini' : '今日時間線'}
        </h2>
        <div
          role="group"
          aria-label={isHelper ? 'Filter jenis tugas' : '任務類型篩選'}
          className="flex gap-1"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                className={`min-h-11 rounded-xl px-3 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span lang={isHelper ? 'id' : 'zh-Hant'}>
                  {isHelper ? f.idLabel : f.zh}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
            {isHelper ? 'Tidak ada tugas di filter ini' : '此篩選下沒有任務'}
          </p>
        )}
        {visible.map((t) => (
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
            showNewBadge={t.status === 'pending' && isHelper}
            hasUnreadNotif={unreadTaskIds?.has?.(t.id)}
            lang={lang}
          />
        ))}
      </div>
    </section>
  )
}

import assert from 'node:assert/strict'
import {
  isAdHoc,
  isScheduled,
  isOverdue,
  isNewTask,
  hasUnreadNewTaskNotif,
  needsAttention,
  classifyPrimary,
  partitionTodayTasks,
  summarizeCounts,
  pickNextTask,
  helperHeroEmptyKind,
  timelineGroups,
  unreadAssignedTaskIds,
  PRIMARY,
} from '../src/lib/todayClassify.js'
import {
  isLikelyOfflineError,
  isVersionConflictError,
} from '../src/lib/statusUpdateErrors.js'
import { formatRecurrence } from '../src/lib/recurrenceFormat.js'

const HK_NOW = new Date('2026-10-19T04:00:00.000Z') // 12:00 HKT

function task(partial) {
  return {
    id: partial.id || 't1',
    status: 'pending',
    template_id: null,
    due_at: null,
    assigned_to: 'helper-a',
    priority: 'normal',
    task_date: '2026-10-19',
    ...partial,
  }
}

// 1. Ad-hoc
assert.equal(isAdHoc(task({ template_id: null })), true)
assert.equal(isAdHoc(task({ template_id: undefined })), true)
assert.equal(isScheduled(task({ template_id: null })), false)

// 2. Scheduled
assert.equal(isScheduled(task({ template_id: 'tpl-1' })), true)
assert.equal(isAdHoc(task({ template_id: 'tpl-1' })), false)

// 3. New task appears once
{
  const t = task({ id: 'new1', status: 'pending', assigned_to: 'helper-a' })
  const ctx = {
    isHelper: true,
    currentUserId: 'helper-a',
    unreadTaskIds: new Set(['new1']),
    now: HK_NOW,
  }
  assert.equal(isNewTask(t, ctx), true)
  assert.equal(classifyPrimary(t, ctx), PRIMARY.NEW_TASK)
  const parts = partitionTodayTasks([t], ctx)
  assert.equal(parts.new_task.length, 1)
  assert.equal(parts.overdue.length, 0)
  assert.equal(parts.needs_attention.length, 0)
  // only in one section
  const allIds = [
    ...parts.new_task,
    ...parts.overdue,
    ...parts.needs_attention,
    ...parts.upcoming,
    ...parts.later,
  ].map((x) => x.id)
  assert.deepEqual(allIds, ['new1'])
}

// 4. Overdue appears once only
{
  const t = task({
    id: 'ov1',
    status: 'acknowledged',
    due_at: '2026-10-19T02:00:00.000Z', // 10:00 HKT, before noon
    assigned_to: 'helper-a',
  })
  const ctx = { isHelper: true, currentUserId: 'helper-a', now: HK_NOW }
  assert.equal(isOverdue(t, HK_NOW), true)
  assert.equal(classifyPrimary(t, ctx), PRIMARY.OVERDUE)
  const parts = partitionTodayTasks([t], ctx)
  assert.equal(parts.overdue.length, 1)
  assert.equal(parts.upcoming.length + parts.later.length + parts.new_task.length, 0)
}

// 5. Needs-attention takes priority over overdue
{
  const t = task({
    id: 'na1',
    status: 'needs_clarification',
    due_at: '2026-10-19T02:00:00.000Z',
  })
  const ctx = { isHelper: false, currentUserId: 'employer-a', now: HK_NOW }
  assert.equal(needsAttention(t, ctx), true)
  assert.equal(classifyPrimary(t, ctx), PRIMARY.NEEDS_ATTENTION)
  const parts = partitionTodayTasks([t], ctx)
  assert.equal(parts.needs_attention.length, 1)
  assert.equal(parts.overdue.length, 0)
}

// 6. Completed excluded from active counts
{
  const tasks = [
    task({ id: 'c1', status: 'completed' }),
    task({ id: 'p1', status: 'acknowledged', due_at: '2026-10-19T06:00:00.000Z' }),
  ]
  const s = summarizeCounts(tasks, { now: HK_NOW })
  assert.equal(s.completed, 1)
  assert.equal(s.pending, 1)
  assert.equal(s.total, 2)
}

// 7. Cancelled excluded from active counts
{
  const tasks = [
    task({ id: 'x1', status: 'cancelled' }),
    task({ id: 'p1', status: 'pending' }),
  ]
  const s = summarizeCounts(tasks, { now: HK_NOW, isHelper: true, currentUserId: 'helper-a' })
  assert.equal(s.total, 1)
  assert.equal(s.pending, 1)
}

// 8. Task without due time sorts after timed tasks
{
  const timed = task({ id: 'd1', status: 'acknowledged', due_at: '2026-10-19T06:00:00.000Z' })
  const noDue = task({ id: 'd2', status: 'acknowledged', due_at: null })
  const parts = partitionTodayTasks([noDue, timed], {
    isHelper: false,
    now: HK_NOW,
  })
  // both later (not due soon from noon — 14:00 HKT is later)
  const combined = [...parts.upcoming, ...parts.later]
  assert.ok(combined.length >= 2)
  assert.equal(combined[0].id, 'd1')
  assert.equal(combined[combined.length - 1].id, 'd2')
}

// 9. Next-task selection prioritizes urgent/overdue
{
  const ctx = { currentUserId: 'helper-a', now: HK_NOW, isHelper: true }
  const tasks = [
    task({
      id: 'later',
      status: 'acknowledged',
      due_at: '2026-10-19T10:00:00.000Z',
      priority: 'normal',
    }),
    task({
      id: 'urgent-ov',
      status: 'acknowledged',
      due_at: '2026-10-19T01:00:00.000Z',
      priority: 'urgent',
    }),
    task({
      id: 'ov-normal',
      status: 'acknowledged',
      due_at: '2026-10-19T02:00:00.000Z',
      priority: 'normal',
    }),
  ]
  const next = pickNextTask(tasks, ctx)
  assert.equal(next.id, 'urgent-ov')
}

// 10. Helper sees only assigned tasks as actionable (pickNextTask)
{
  const ctx = { currentUserId: 'helper-a', now: HK_NOW }
  const tasks = [
    task({
      id: 'other',
      assigned_to: 'helper-b',
      status: 'acknowledged',
      due_at: '2026-10-19T01:00:00.000Z',
      priority: 'urgent',
    }),
    task({
      id: 'mine',
      assigned_to: 'helper-a',
      status: 'acknowledged',
      due_at: '2026-10-19T08:00:00.000Z',
    }),
  ]
  const next = pickNextTask(tasks, ctx)
  assert.equal(next.id, 'mine')
}

// 11. Recurrence summary correct in both languages
{
  const daily = formatRecurrence(
    { recurrence_rule: 'daily', default_time: '07:00' },
    'zh',
  )
  assert.match(daily, /每日/)
  assert.match(daily, /07:00/)
  const dailyId = formatRecurrence(
    { recurrence_rule: 'daily', default_time: '07:00' },
    'id',
  )
  assert.match(dailyId, /Setiap hari/)
  assert.match(dailyId, /07\.00/)

  const weekdays = formatRecurrence({ recurrence_rule: 'weekdays', default_time: '15:30' }, 'zh')
  assert.match(weekdays, /平日/)
  const weekdaysId = formatRecurrence({ recurrence_rule: 'weekdays', default_time: '15:30' }, 'id')
  assert.match(weekdaysId, /Hari kerja/)

  const mwf = formatRecurrence(
    { recurrence_rule: 'weekly', recurrence_weekdays: [1, 3, 5], default_time: '09:00' },
    'zh',
  )
  assert.match(mwf, /逢星期/)
  assert.ok(mwf.includes('一') && mwf.includes('三') && mwf.includes('五'))
  const mwfId = formatRecurrence(
    { recurrence_rule: 'weekly', recurrence_weekdays: [1, 3, 5], default_time: '09:00' },
    'id',
  )
  assert.match(mwfId, /Senin/)
  assert.match(mwfId, /Rabu/)
  assert.match(mwfId, /Jumat/)

  const bi = formatRecurrence(
    { recurrence_rule: 'biweekly', recurrence_weekdays: [1] },
    'zh',
  )
  assert.match(bi, /每兩星期/)
  const biId = formatRecurrence(
    { recurrence_rule: 'biweekly', recurrence_weekdays: [1] },
    'id',
  )
  assert.match(biId, /dua minggu/)

  const monthly = formatRecurrence(
    { recurrence_rule: 'monthly', month_day: 15 },
    'zh',
  )
  assert.match(monthly, /每月15日/)
  const monthlyId = formatRecurrence(
    { recurrence_rule: 'monthly', month_day: 15 },
    'id',
  )
  assert.match(monthlyId, /tanggal 15/)

  const until = formatRecurrence(
    { recurrence_rule: 'daily', end_date: '2026-12-31' },
    'zh',
  )
  assert.match(until, /排程至/)
  assert.match(until, /2026/)
  const untilId = formatRecurrence(
    { recurrence_rule: 'daily', end_date: '2026-12-31' },
    'id',
  )
  assert.match(untilId, /Dijadwalkan hingga/)

  assert.equal(
    formatRecurrence({ recurrence_rule: 'daily', paused_at: '2026-10-01' }, 'zh'),
    '排程已暫停',
  )
  assert.equal(
    formatRecurrence({ recurrence_rule: 'daily', paused_at: '2026-10-01' }, 'id'),
    'Jadwal dijeda',
  )
}

// 12. Notification read does not set task acknowledged
{
  const t = task({ id: 'n1', status: 'pending', assigned_to: 'helper-a' })
  const ctxUnread = {
    isHelper: true,
    currentUserId: 'helper-a',
    unreadTaskIds: new Set(['n1']),
    now: HK_NOW,
  }
  const ctxRead = {
    isHelper: true,
    currentUserId: 'helper-a',
    unreadTaskIds: new Set(), // notification read
    now: HK_NOW,
  }
  assert.equal(isNewTask(t, ctxUnread), true)
  assert.equal(isNewTask(t, ctxRead), true) // still pending = still new
  assert.equal(hasUnreadNewTaskNotif(t, ctxUnread), true)
  assert.equal(hasUnreadNewTaskNotif(t, ctxRead), false)
  assert.equal(t.status, 'pending') // unchanged
}

// 13. Acknowledgement removes new-task state
{
  const t = task({ id: 'n2', status: 'acknowledged', assigned_to: 'helper-a' })
  const ctx = {
    isHelper: true,
    currentUserId: 'helper-a',
    unreadTaskIds: new Set(['n2']),
    now: HK_NOW,
  }
  assert.equal(isNewTask(t, ctx), false)
  assert.notEqual(classifyPrimary(t, ctx), PRIMARY.NEW_TASK)
}

// 14. Hong Kong date boundaries
{
  // 2026-10-18 16:00 UTC = 2026-10-19 00:00 HKT — start of HK day
  const startHKT = new Date('2026-10-18T16:00:00.000Z')
  const dueJustBefore = task({
    id: 'b1',
    status: 'acknowledged',
    due_at: '2026-10-18T15:59:00.000Z', // still 18th HKT evening? 15:59 UTC = 23:59 HKT on 18th
  })
  const dueJustAfter = task({
    id: 'b2',
    status: 'acknowledged',
    due_at: '2026-10-18T16:30:00.000Z', // 00:30 HKT on 19th
  })
  // At start of HK day Oct 19, dueJustBefore is overdue, dueJustAfter is also overdue if now is later…
  // At exactly 00:00 HKT Oct 19, due at 00:30 is NOT overdue
  assert.equal(isOverdue(dueJustBefore, startHKT), true)
  assert.equal(isOverdue(dueJustAfter, startHKT), false)

  // todayHK-style: tasks filtered by task_date='2026-10-19' already; classification uses due_at vs now
  const lateNight = new Date('2026-10-19T15:59:00.000Z') // 23:59 HKT Oct 19
  const dueEvening = task({
    id: 'b3',
    status: 'in_progress',
    due_at: '2026-10-19T10:00:00.000Z', // 18:00 HKT
  })
  assert.equal(isOverdue(dueEvening, lateNight), true)
}

// Extra: unreadAssignedTaskIds
{
  const set = unreadAssignedTaskIds([
    { type: 'task_assigned', task_occurrence_id: 'a', read_at: null },
    { type: 'task_assigned', task_occurrence_id: 'b', read_at: '2026-10-19T01:00:00Z' },
    { type: 'schedule_created', task_occurrence_id: 'c', read_at: null },
  ])
  assert.equal(set.has('a'), true)
  assert.equal(set.has('b'), false)
  assert.equal(set.has('c'), false)
}

// Extra: summarize never double-counts needs
{
  const t = task({
    id: 'dbl',
    status: 'needs_clarification',
    due_at: '2026-10-19T01:00:00.000Z',
  })
  const s = summarizeCounts([t], {
    now: HK_NOW,
    unreadCommentTaskIds: new Set(['dbl']),
  })
  assert.equal(s.needsHandling, 1)
  assert.equal(s.overdue, 1) // overdue count separate; primary section is needs_attention
  assert.equal(s.pending, 1)
}

// Extra: timeline groups
{
  const groups = timelineGroups(
    [
      task({ id: 'o', status: 'acknowledged', due_at: '2026-10-19T01:00:00.000Z' }),
      task({ id: 'n', status: 'in_progress', due_at: '2026-10-19T04:30:00.000Z' }),
      task({ id: 'l', status: 'acknowledged', due_at: '2026-10-19T12:00:00.000Z' }),
      task({ id: 'z', status: 'acknowledged', due_at: null }),
      task({ id: 'c', status: 'completed' }),
    ],
    { now: HK_NOW },
  )
  assert.equal(groups.overdue.map((t) => t.id).join(), 'o')
  assert.ok(groups.now.some((t) => t.id === 'n'))
  assert.ok(groups.later.some((t) => t.id === 'l'))
  assert.ok(groups.no_time.some((t) => t.id === 'z'))
  assert.ok(groups.completed.some((t) => t.id === 'c'))
}

// P0: helper hero empty kind — never "all done" when New / Needs attention remain
{
  const pendingNew = task({
    id: 'pn1',
    status: 'pending',
    assigned_to: 'helper-a',
  })
  const clarify = task({
    id: 'cl1',
    status: 'needs_clarification',
    assigned_to: 'helper-a',
  })
  assert.equal(
    helperHeroEmptyKind({
      heroTask: null,
      tasks: [pendingNew],
      sections: { new_task: [pendingNew], needs_attention: [] },
    }),
    'focus_above',
  )
  assert.equal(
    helperHeroEmptyKind({
      heroTask: null,
      tasks: [clarify],
      sections: { new_task: [], needs_attention: [clarify] },
    }),
    'focus_above',
  )
  assert.equal(
    helperHeroEmptyKind({ heroTask: null, tasks: [], sections: {} }),
    'no_tasks',
  )
  assert.equal(
    helperHeroEmptyKind({
      heroTask: null,
      tasks: [task({ id: 'done', status: 'completed' })],
      sections: { new_task: [], needs_attention: [] },
    }),
    'all_done',
  )
  assert.equal(
    helperHeroEmptyKind({
      heroTask: pendingNew,
      tasks: [pendingNew],
      sections: { new_task: [pendingNew] },
    }),
    null,
  )
}

// P0: status update error classification
{
  assert.equal(isLikelyOfflineError(new Error('offline'), true), true)
  assert.equal(isLikelyOfflineError(new Error('Failed to fetch'), true), true)
  assert.equal(isLikelyOfflineError(new Error('boom'), false), true)
  assert.equal(isLikelyOfflineError(new Error('version conflict'), true), false)
  assert.equal(isVersionConflictError({ message: 'version conflict', code: '40001' }), true)
  assert.equal(isVersionConflictError(new Error('version conflict')), true)
  assert.equal(isVersionConflictError(new Error('Failed to fetch')), false)
  assert.equal(isVersionConflictError(new Error('RLS denied')), false)
}

console.log('All today unit tests passed')

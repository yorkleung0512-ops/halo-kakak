/**
 * Today-page task classification — single source of truth.
 * Every task maps to exactly one primary section.
 */

export const PRIMARY = {
  NEEDS_ATTENTION: 'needs_attention',
  NEW_TASK: 'new_task',
  OVERDUE: 'overdue',
  UPCOMING: 'upcoming',
  LATER: 'later',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

const ATTENTION_STATUSES = new Set([
  'needs_clarification',
  'cannot_complete',
  'delayed',
])

const DONE_STATUSES = new Set(['completed', 'cancelled'])

/** Ad-hoc = not generated from a recurring template */
export function isAdHoc(task) {
  return !task?.template_id
}

/** Scheduled = linked to a recurring task template */
export function isScheduled(task) {
  return !!task?.template_id
}

export function isCancelled(task) {
  return task?.status === 'cancelled'
}

export function isCompleted(task) {
  return task?.status === 'completed'
}

/**
 * Overdue: not completed/cancelled, has due_at earlier than now.
 * @param {object} task
 * @param {Date|number|string} [now]
 */
export function isOverdue(task, now = new Date()) {
  if (!task || DONE_STATUSES.has(task.status)) return false
  if (!task.due_at) return false
  const t = new Date(task.due_at).getTime()
  if (Number.isNaN(t)) return false
  return t < new Date(now).getTime()
}

/**
 * New task for the current helper:
 * - assigned to current helper
 * - status pending
 * - unread task_assigned notification OR still pending (not acknowledged)
 * Reading a notification does NOT acknowledge the task.
 *
 * @param {object} task
 * @param {{ currentUserId?: string, isHelper?: boolean, unreadTaskIds?: Set<string> }} ctx
 */
export function isNewTask(task, ctx = {}) {
  if (!task || task.status !== 'pending') return false
  if (!ctx.isHelper) return false
  const uid = ctx.currentUserId
  if (!uid || task.assigned_to !== uid) return false
  // Pending + assigned = not yet acknowledged. Unread notif is for badge emphasis.
  return true
}

/**
 * Has unread new-task notification (task_assigned) — for Baru badge.
 * Separate from acknowledgement.
 */
export function hasUnreadNewTaskNotif(task, ctx = {}) {
  if (!task?.id) return false
  const set = ctx.unreadTaskIds
  return set instanceof Set ? set.has(task.id) : !!set?.[task.id]
}

/**
 * Needs attention: problem statuses or unread comment requiring response.
 */
export function needsAttention(task, ctx = {}) {
  if (!task || DONE_STATUSES.has(task.status)) return false
  if (ATTENTION_STATUSES.has(task.status)) return true
  const set = ctx.unreadCommentTaskIds
  if (set instanceof Set) return set.has(task.id)
  return !!set?.[task.id]
}

/**
 * Due-soon window: within the next `minutes` (default 120).
 */
export function isDueSoon(task, now = new Date(), minutes = 120) {
  if (!task?.due_at || DONE_STATUSES.has(task.status)) return false
  const t = new Date(task.due_at).getTime()
  const n = new Date(now).getTime()
  if (t < n) return false
  return t - n <= minutes * 60 * 1000
}

/**
 * Classify into exactly one primary section.
 * Priority: NEEDS_ATTENTION > NEW > OVERDUE > UPCOMING > LATER > COMPLETED
 */
export function classifyPrimary(task, ctx = {}) {
  if (!task) return PRIMARY.CANCELLED
  if (task.status === 'cancelled') return PRIMARY.CANCELLED
  if (task.status === 'completed') return PRIMARY.COMPLETED
  if (needsAttention(task, ctx)) return PRIMARY.NEEDS_ATTENTION
  if (isNewTask(task, ctx)) return PRIMARY.NEW_TASK
  const now = ctx.now || new Date()
  if (isOverdue(task, now)) return PRIMARY.OVERDUE
  if (task.status === 'in_progress' || isDueSoon(task, now, ctx.dueSoonMinutes ?? 120)) {
    return PRIMARY.UPCOMING
  }
  return PRIMARY.LATER
}

function sortByDue(a, b) {
  const ad = a.due_at || ''
  const bd = b.due_at || ''
  if (!ad && bd) return 1
  if (ad && !bd) return -1
  return ad.localeCompare(bd)
}

/**
 * Partition today's tasks into primary sections (each task once).
 * Cancelled omitted from active section lists (kept in `cancelled` if needed).
 */
export function partitionTodayTasks(tasks, ctx = {}) {
  const sections = {
    needs_attention: [],
    new_task: [],
    overdue: [],
    upcoming: [],
    later: [],
    completed: [],
    cancelled: [],
  }
  for (const task of tasks || []) {
    const key = classifyPrimary(task, ctx)
    if (sections[key]) sections[key].push(task)
  }
  for (const k of Object.keys(sections)) {
    if (k === 'completed') {
      sections[k].sort((a, b) =>
        String(b.completed_at || b.updated_at || '').localeCompare(
          String(a.completed_at || a.updated_at || ''),
        ),
      )
    } else {
      sections[k].sort(sortByDue)
    }
  }
  return sections
}

/**
 * Summary counts from already-loaded tasks. No double-count. Exclude cancelled from active.
 */
export function summarizeCounts(tasks, ctx = {}) {
  const list = tasks || []
  const now = ctx.now || new Date()
  let total = 0
  let pending = 0 // 待完成 = not completed/cancelled
  let completed = 0
  let overdue = 0
  let awaitingAck = 0 // pending status (等待確認)
  let needsHandling = 0
  let newForHelper = 0
  const seenNeeds = new Set()

  for (const t of list) {
    if (t.status === 'cancelled') continue
    total += 1
    if (t.status === 'completed') {
      completed += 1
      continue
    }
    pending += 1
    if (t.status === 'pending') awaitingAck += 1
    if (isOverdue(t, now)) overdue += 1
    if (needsAttention(t, ctx) && !seenNeeds.has(t.id)) {
      needsHandling += 1
      seenNeeds.add(t.id)
    }
    if (isNewTask(t, ctx)) newForHelper += 1
  }

  return {
    total,
    pending,
    completed,
    overdue,
    awaitingAck,
    needsHandling,
    newForHelper,
    // aliases for UI
    today: total,
    incomplete: pending,
  }
}

/**
 * Helper next-task hero selection.
 * Priority: (1) urgent overdue (2) urgent due-soon (3) earliest due incomplete
 * (4) in_progress (5) earliest without due time.
 * Excludes completed/cancelled/other helper's / outside today (caller filters today).
 */
export function pickNextTask(tasks, ctx = {}) {
  const uid = ctx.currentUserId
  const now = ctx.now || new Date()
  const pool = (tasks || []).filter((t) => {
    if (!t || DONE_STATUSES.has(t.status)) return false
    if (uid && t.assigned_to && t.assigned_to !== uid) return false
    // Unassigned tasks are actionable for helpers in household (optional)
    // Spec: "Tasks assigned to another helper" excluded; unassigned OK for display?
    // "Helper sees only assigned tasks as actionable" — filter to assigned to self when uid set
    if (uid && t.assigned_to !== uid) return false
    return true
  })

  if (!pool.length) return null

  const urgent = (t) => t.priority === 'urgent' || t.priority === 'high'

  const urgentOverdue = pool
    .filter((t) => isOverdue(t, now) && urgent(t))
    .sort(sortByDue)
  if (urgentOverdue[0]) return urgentOverdue[0]

  const urgentSoon = pool
    .filter((t) => !isOverdue(t, now) && isDueSoon(t, now, 120) && urgent(t))
    .sort(sortByDue)
  if (urgentSoon[0]) return urgentSoon[0]

  // Also prefer any overdue before general earliest
  const anyOverdue = pool.filter((t) => isOverdue(t, now)).sort(sortByDue)
  if (anyOverdue[0]) return anyOverdue[0]

  const withDue = pool.filter((t) => t.due_at).sort(sortByDue)
  const inProg = pool.filter((t) => t.status === 'in_progress').sort(sortByDue)
  // Spec order: earliest due incomplete before preferring in_progress alone…
  // (3) earliest due incomplete (4) in_progress (5) no due
  // So if there is any with due_at, take earliest; else in_progress; else no due.
  if (withDue[0]) {
    // Prefer in_progress if it's the earliest-due among with-due? Spec lists
    // earliest due as #3 and in_progress as #4 — so earliest due wins.
    return withDue[0]
  }
  if (inProg[0]) return inProg[0]
  const noDue = pool.filter((t) => !t.due_at)
  return noDue[0] || pool[0] || null
}

/**
 * Timeline buckets for remaining tasks (after removing higher sections / hero).
 * Groups: overdue | now | later | no_time | completed
 */
export function timelineGroups(tasks, ctx = {}) {
  const now = ctx.now || new Date()
  const groups = {
    overdue: [],
    now: [],
    later: [],
    no_time: [],
    completed: [],
  }
  for (const t of tasks || []) {
    if (t.status === 'cancelled') continue
    if (t.status === 'completed') {
      groups.completed.push(t)
      continue
    }
    if (isOverdue(t, now)) {
      groups.overdue.push(t)
      continue
    }
    if (!t.due_at) {
      groups.no_time.push(t)
      continue
    }
    if (isDueSoon(t, now, ctx.dueSoonMinutes ?? 120) || t.status === 'in_progress') {
      groups.now.push(t)
    } else {
      groups.later.push(t)
    }
  }
  for (const k of ['overdue', 'now', 'later', 'no_time']) {
    groups[k].sort(sortByDue)
  }
  return groups
}

/**
 * Build unread task id set from notification items (type task_assigned, !read_at).
 */
export function unreadAssignedTaskIds(notifications) {
  const set = new Set()
  for (const n of notifications || []) {
    if (n.deleted_at) continue
    if (n.read_at) continue
    if (n.type !== 'task_assigned' && n.type !== 'task_available') continue
    if (n.task_occurrence_id) set.add(n.task_occurrence_id)
  }
  return set
}

/**
 * From batched comments, find task ids where latest comment is from someone
 * other than currentUserId (needs a response from current user).
 */
export function deriveUnreadCommentTaskIds(comments, currentUserId) {
  const set = new Set()
  if (!currentUserId || !comments?.length) return set
  const latestByTask = new Map()
  for (const c of comments) {
    const tid = c.task_occurrence_id
    if (!tid) continue
    const prev = latestByTask.get(tid)
    if (!prev || String(c.created_at) > String(prev.created_at)) {
      latestByTask.set(tid, c)
    }
  }
  for (const [tid, c] of latestByTask) {
    if (c.user_id && c.user_id !== currentUserId) set.add(tid)
  }
  return set
}

/**
 * Aggregate comment counts per occurrence id.
 */
export function aggregateCommentCounts(comments) {
  const counts = {}
  for (const c of comments || []) {
    const tid = c.task_occurrence_id
    if (!tid) continue
    counts[tid] = (counts[tid] || 0) + 1
  }
  return counts
}

/** Type badge labels */
export function taskTypeBadge(task, lang = 'zh') {
  if (isScheduled(task)) {
    return lang === 'id' ? 'Terjadwal' : '排程'
  }
  return lang === 'id' ? 'Sekali' : '臨時'
}

/**
 * Filter tasks for helper actionable view (assigned to self).
 */
export function filterAssignedTo(tasks, userId) {
  if (!userId) return tasks || []
  return (tasks || []).filter((t) => t.assigned_to === userId)
}

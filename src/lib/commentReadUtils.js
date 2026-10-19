/**
 * Pure helpers for task comment read receipts (no Supabase import).
 */

/**
 * Build Set of task_occurrence_id with unread_count > 0.
 * @param {Array<{ task_occurrence_id?: string, unread_count?: number }>|null|undefined} rows
 * @returns {Set<string>}
 */
export function unreadCommentTaskIdsFromSummary(rows) {
  const set = new Set()
  for (const row of rows || []) {
    const id = row?.task_occurrence_id
    const n = Number(row?.unread_count) || 0
    if (id && n > 0) set.add(id)
  }
  return set
}

/**
 * Map summary rows to { [taskId]: unread_count }.
 */
export function unreadCountsByTask(rows) {
  const map = {}
  for (const row of rows || []) {
    const id = row?.task_occurrence_id
    if (!id) continue
    map[id] = Number(row.unread_count) || 0
  }
  return map
}

/**
 * Comments written by someone else (eligible to be unread for current user).
 * @param {Array<{ id: string, user_id?: string }>|null|undefined} comments
 * @param {string|null|undefined} currentUserId
 * @returns {string[]}
 */
export function otherUsersCommentIds(comments, currentUserId) {
  if (!currentUserId) return []
  return (comments || [])
    .filter((c) => c?.id && c.user_id && c.user_id !== currentUserId)
    .map((c) => c.id)
}

/**
 * Offline queue payload shape for mark_comments_read.
 */
export function buildMarkCommentsReadMutation(
  taskOccurrenceId,
  commentIds,
  householdId,
) {
  return {
    type: 'mark_comments_read',
    payload: {
      task_occurrence_id: taskOccurrenceId,
      comment_ids: commentIds == null ? null : [...commentIds],
      household_id: householdId || null,
    },
  }
}

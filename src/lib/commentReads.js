import { supabase } from './supabase'
export {
  unreadCommentTaskIdsFromSummary,
  unreadCountsByTask,
  otherUsersCommentIds,
  buildMarkCommentsReadMutation,
} from './commentReadUtils.js'

/**
 * Fetch unread comment summary for the current user on a household day.
 * @returns {Promise<{ rows: object[], error: Error|null }>}
 */
export async function fetchUnreadCommentSummary(householdId, taskDate) {
  if (!householdId || !taskDate) {
    return { rows: [], error: null }
  }
  const { data, error } = await supabase.rpc('get_my_unread_comment_summary', {
    p_household_id: householdId,
    p_task_date: taskDate,
  })
  if (error) return { rows: [], error }
  return { rows: data || [], error: null }
}

/**
 * Mark comments as read for auth.uid() on a task.
 * @param {string} taskOccurrenceId
 * @param {string[]|null|undefined} commentIds — null/empty = all others on the task
 * @returns {Promise<{ marked_count: number, remaining_unread_count: number, error: Error|null }>}
 */
export async function markTaskCommentsRead(taskOccurrenceId, commentIds = null) {
  if (!taskOccurrenceId) {
    return {
      marked_count: 0,
      remaining_unread_count: 0,
      error: new Error('task_occurrence_id required'),
    }
  }
  const payload = {
    p_task_occurrence_id: taskOccurrenceId,
  }
  if (commentIds != null) {
    payload.p_comment_ids = commentIds.length ? commentIds : []
  }
  const { data, error } = await supabase.rpc('mark_task_comments_read', payload)
  if (error) {
    return { marked_count: 0, remaining_unread_count: 0, error }
  }
  return {
    marked_count: Number(data?.marked_count) || 0,
    remaining_unread_count: Number(data?.remaining_unread_count) || 0,
    error: null,
  }
}

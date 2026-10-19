import { supabase } from './supabase'

export {
  formatUnreadBadge,
  notificationCopy,
  deepLinkForNotification,
  NOTIF_LABELS,
} from './notificationUtils.js'

export async function fetchUnreadCount() {
  const { data, error } = await supabase.rpc('get_unread_notification_count')
  if (error) throw error
  return Number(data) || 0
}

export async function fetchNotifications({ unreadOnly = false, limit = 50 } = {}) {
  let q = supabase
    .from('notifications')
    .select(
      'id, household_id, type, title_zh, title_id, body_zh, body_id, task_occurrence_id, task_template_id, metadata, read_at, created_at, expires_at',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) q = q.is('read_at', null)

  const { data, error } = await q
  if (error) throw error
  const now = Date.now()
  return (data || []).filter(
    (n) => !n.expires_at || new Date(n.expires_at).getTime() > now,
  )
}

export async function markNotificationsRead(ids) {
  if (!ids?.length) return 0
  const { data, error } = await supabase.rpc('mark_notifications_read', {
    p_ids: ids,
  })
  if (error) throw error
  return Number(data) || 0
}

export async function markNotificationUnread(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteNotification(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const rows = await fetchNotifications({ unreadOnly: true, limit: 200 })
  const ids = rows.map((r) => r.id)
  return markNotificationsRead(ids)
}

export async function fetchNotificationById(id) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function occurrenceExists(id) {
  if (!id) return false
  const { data, error } = await supabase
    .from('task_occurrences')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return false
  return !!data
}

export async function templateExists(id) {
  if (!id) return false
  const { data, error } = await supabase
    .from('task_templates')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return false
  return !!data
}

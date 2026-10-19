import { supabase } from './supabase'

/**
 * Active helpers in a household (for assignee picker).
 * @returns {Promise<Array<{ user_id: string, display_name: string }>>}
 */
export async function fetchActiveHelpers(householdId) {
  if (!householdId) return []
  const { data: members, error } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('role', 'helper')
    .eq('status', 'active')
  if (error || !members?.length) return []
  const ids = members.map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
  const byId = new Map((profiles || []).map((p) => [p.id, p.display_name]))
  return ids.map((user_id) => ({
    user_id,
    display_name: byId.get(user_id) || '姐姐',
  }))
}

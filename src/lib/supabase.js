import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    '[halo-kakak] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and sync will fail.',
  )
}

export const SUPABASE_URL = url || ''
export const SUPABASE_ANON_KEY = anonKey || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

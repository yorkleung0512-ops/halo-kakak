import { createClient } from '@supabase/supabase-js'

const FALLBACK_URL = 'https://yevqwospotfujiziegpz.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldnF3b3Nwb3RmdWppemllZ3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzc4MTEsImV4cCI6MjEwNzkxMzgxMX0.r3UhHTV8njUXfcvzQOrs9xd6YedqJFW9QcFlkt6e9o0'

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

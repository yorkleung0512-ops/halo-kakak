import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { mapAuthError } from '../lib/constants'
import {
  consumePendingDeepLink,
  sanitizeInternalPath,
} from '../lib/taskDetailAccess'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const { error: err } = await supabase.auth.getSession()
      if (cancelled) return
      if (err) {
        setError(mapAuthError(err, 'zh'))
        return
      }
      // Prefer stored deep link from sign-in; else keep callback query (task/n).
      const pending = consumePendingDeepLink()
      const search = window.location.search || ''
      const fallback =
        search && (search.includes('task=') || search.includes('n='))
          ? `/${search}`
          : '/'
      const target = sanitizeInternalPath(pending || fallback)
      navigate(target, { replace: true })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p role="alert" className="text-rose-700">
          {error}
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-teal-700 px-4 text-white"
          onClick={() => navigate('/signin')}
        >
          返回登入
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      登入中…
    </div>
  )
}

import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function InviteAccept() {
  const { token } = useParams()
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">…</div>
  }

  if (!isAuthenticated) {
    return <Navigate to={`/signin?invite=${encodeURIComponent(token || '')}`} replace />
  }

  async function accept() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('accept_household_invite', {
      p_token: token,
    })
    setBusy(false)
    if (err) {
      const msg = err.message || ''
      if (msg.includes('expired')) setError('邀請已過期 / Undangan kedaluwarsa')
      else if (msg.includes('used')) setError('邀請已使用 / Undangan sudah dipakai')
      else if (msg.includes('revoked')) setError('邀請已取消 / Undangan dibatalkan')
      else setError('無法加入 / Tidak dapat bergabung')
      return
    }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1200)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 lang="zh-Hant" className="text-xl font-bold text-slate-900">
          加入家庭
        </h1>
        <p lang="id" className="text-sm text-slate-500">
          Bergabung ke rumah tangga
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {done ? (
          <p className="mt-4 text-teal-800">成功 / Berhasil</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={accept}
            className="mt-6 w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-60"
          >
            {busy ? '…' : '接受邀請 / Terima undangan'}
          </button>
        )}
      </div>
    </div>
  )
}

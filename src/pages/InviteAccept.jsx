import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { isPlausibleInviteToken } from '../lib/inviteToken'
import LoadingBlock from '../components/LoadingBlock'

export default function InviteAccept() {
  const { token } = useParams()
  const { isAuthenticated, loading } = useAuth()
  const { reload } = useHousehold()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <LoadingBlock />
      </div>
    )
  }

  if (!isPlausibleInviteToken(token || '')) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <h1 lang="zh-Hant" className="text-xl font-bold text-amber-950">
            邀請無效
          </h1>
          <p lang="id" className="mt-1 text-sm text-amber-900">
            Undangan tidak valid
          </p>
          <p lang="zh-Hant" className="mt-3 text-sm text-amber-950">
            請向僱主索取完整 WhatsApp 邀請連結。
          </p>
          <button
            type="button"
            className="mt-6 w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white"
            onClick={() => navigate('/signin', { replace: true })}
          >
            返回登入 / Kembali
          </button>
        </div>
      </div>
    )
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
    if (err) {
      setBusy(false)
      const msg = err.message || ''
      if (msg.includes('expired')) setError('邀請已過期 / Undangan kedaluwarsa')
      else if (msg.includes('used')) setError('邀請已使用 / Undangan sudah dipakai')
      else if (msg.includes('revoked')) setError('邀請已取消 / Undangan dibatalkan')
      else if (msg.includes('invalid')) setError('邀請無效 / Undangan tidak valid')
      else setError('無法加入 / Tidak dapat bergabung')
      return
    }

    let rows = []
    try {
      rows = (await reload()) || []
    } catch {
      rows = []
    }

    if (!rows.length) {
      // Context may still race; hard reload so ProtectedApp re-fetches memberships.
      setDone(true)
      setBusy(false)
      window.location.replace(`${window.location.origin}/`)
      return
    }

    setDone(true)
    setBusy(false)
    setTimeout(() => navigate('/', { replace: true }), 800)
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
          <p className="mt-4 text-teal-800" role="status">
            成功 / Berhasil
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={accept}
            className="mt-6 w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-60"
          >
            {busy ? '處理中… / Memproses…' : '接受邀請 / Terima undangan'}
          </button>
        )}
      </div>
    </div>
  )
}

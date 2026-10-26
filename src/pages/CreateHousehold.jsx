import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHousehold } from '../lib/household'
import { isPlausibleInviteToken, parseInviteToken } from '../lib/inviteToken'

export default function CreateHousehold() {
  const { createHousehold } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createHousehold(name.trim() || '我的家庭')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || '建立失敗 / Gagal membuat')
    } finally {
      setBusy(false)
    }
  }

  function onInviteSubmit(e) {
    e.preventDefault()
    setInviteError(null)
    const token = parseInviteToken(inviteInput)
    if (!token || !isPlausibleInviteToken(token)) {
      setInviteError(
        '請貼上完整邀請連結或 token（至少 16 字） / Tempel tautan undangan lengkap atau token',
      )
      return
    }
    navigate(`/invite/${encodeURIComponent(token)}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-16">
      <form
        onSubmit={onInviteSubmit}
        className="rounded-2xl border border-teal-200 bg-teal-50/60 p-6 shadow-sm"
      >
        <h2 lang="zh-Hant" className="text-lg font-bold text-teal-950">
          我有邀請連結
        </h2>
        <p lang="id" className="mb-3 text-sm text-teal-800">
          Saya punya tautan undangan
        </p>
        <p
          lang="zh-Hant"
          className="mb-1 text-xs text-teal-900/80"
        >
          姐姐／幫手：唔好喺度新建家庭，請貼上僱主 WhatsApp 傳嚟嘅連結。
        </p>
        <p lang="id" className="mb-3 text-xs text-teal-900/80">
          Asisten: jangan buat rumah tangga baru di sini. Tempel tautan dari majikan.
        </p>
        <label htmlFor="invite-link" className="mb-1 block text-sm font-medium">
          <span lang="zh-Hant">邀請連結</span>
          <span className="text-slate-400"> / </span>
          <span lang="id">Tautan undangan</span>
        </label>
        <input
          id="invite-link"
          value={inviteInput}
          onChange={(e) => setInviteInput(e.target.value)}
          className="mb-3 w-full min-h-11 rounded-xl border border-teal-200 bg-white px-3"
          placeholder="https://…/invite/… 或 token"
          autoComplete="off"
        />
        {inviteError && (
          <p role="alert" className="mb-2 text-sm text-rose-700">
            {inviteError}
          </p>
        )}
        <button
          type="submit"
          className="w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white"
        >
          <span lang="zh-Hant">繼續加入</span>
          <span className="mx-1 opacity-70">/</span>
          <span lang="id">Lanjut bergabung</span>
        </button>
      </form>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-busy={busy}
      >
        <h1 lang="zh-Hant" className="text-xl font-bold">
          建立家庭
        </h1>
        <p lang="id" className="mb-4 text-sm text-slate-500">
          Buat rumah tangga (untuk majikan)
        </p>
        <label htmlFor="hh-name" className="mb-1 block text-sm font-medium">
          <span lang="zh-Hant">家庭名稱</span>
          <span className="text-slate-400"> / </span>
          <span lang="id">Nama rumah tangga</span>
        </label>
        <input
          id="hh-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full min-h-11 rounded-xl border border-slate-200 px-3"
          placeholder="例如：李宅 / Contoh: Keluarga Li"
        />
        {error && (
          <p role="alert" className="mb-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-11 rounded-xl bg-slate-800 font-bold text-white"
        >
          {busy ? (
            <span lang="zh-Hant">建立中…</span>
          ) : (
            <>
              <span lang="zh-Hant">建立</span>
              <span className="mx-1 opacity-70">/</span>
              <span lang="id">Buat</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

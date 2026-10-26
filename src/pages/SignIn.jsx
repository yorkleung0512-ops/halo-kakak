import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function SignIn() {
  const { signInWithMagicLink, authError } = useAuth()
  const [params] = useSearchParams()
  const invite = params.get('invite')
  const [email, setEmail] = useState('')
  const [lang, setLang] = useState('zh')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      const redirectTo = invite
        ? `${window.location.origin}/invite/${invite}`
        : `${window.location.origin}/auth/callback`
      await signInWithMagicLink(email, { lang, redirectTo })
      setSent(true)
    } catch {
      /* authError set in context */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-2xl text-white shadow">
          🏠
        </div>
        <h1 lang="zh-Hant" className="text-2xl font-bold text-slate-900">
          Halo Kakak
        </h1>
        <p
          lang={lang === 'id' ? 'id' : 'zh-Hant'}
          className="mt-2 text-sm text-slate-600"
        >
          {lang === 'id'
            ? 'Tugas rumah tangga yang jelas antara majikan Hong Kong dan asisten rumah tangga Indonesia.'
            : '香港僱主同印尼籍家傭嘅雙語家務協作。'}
        </p>
      </div>

      <div className="mb-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setLang('zh')}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${lang === 'zh' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          中文
        </button>
        <button
          type="button"
          onClick={() => setLang('id')}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${lang === 'id' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Indonesia
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        {sent ? (
          <div className="space-y-2 text-center">
            <p lang="zh-Hant" className="font-medium text-teal-800">
              {lang === 'id'
                ? 'Cek email Anda untuk tautan masuk (tanpa kata sandi).'
                : '請查收電郵入面嘅登入連結（唔使密碼）。'}
            </p>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
        ) : (
          <>
            <label
              htmlFor="email"
              lang={lang === 'id' ? 'id' : 'zh-Hant'}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              {lang === 'id' ? 'Email' : '電郵'}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-3 w-full min-h-11 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              placeholder="you@example.com"
            />
            {authError && (
              <p role="alert" className="mb-3 text-sm text-rose-700">
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-11 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              {busy
                ? '…'
                : lang === 'id'
                  ? 'Kirim tautan masuk'
                  : '發送登入連結'}
            </button>
            <p
              lang={lang === 'id' ? 'id' : 'zh-Hant'}
              className="mt-3 text-xs text-slate-500"
            >
              {lang === 'id'
                ? 'Masuk tanpa kata sandi. Tautan kedaluwarsa akan meminta email baru.'
                : '免密碼登入。連結過期請重新索取電郵。'}
            </p>
          </>
        )}
      </form>

      <p
        lang={lang === 'id' ? 'id' : 'zh-Hant'}
        className="mt-6 text-center text-xs text-slate-500"
      >
        <Link to="/privacy" className="underline">
          {lang === 'id' ? 'Privasi' : '私隱'}
        </Link>
        {' · '}
        <Link to="/terms" className="underline">
          {lang === 'id' ? 'Syarat' : '條款'}
        </Link>
        {' · '}
        <Link to="/pics" className="underline">
          PICS
        </Link>
      </p>
    </div>
  )
}

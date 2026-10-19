import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHousehold } from '../lib/household'

export default function CreateHousehold() {
  const { createHousehold } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createHousehold(name.trim() || '我的家庭')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 lang="zh-Hant" className="text-xl font-bold">
          建立家庭
        </h1>
        <p lang="id" className="mb-4 text-sm text-slate-500">
          Buat rumah tangga
        </p>
        <label htmlFor="hh-name" className="mb-1 block text-sm font-medium">
          家庭名稱
        </label>
        <input
          id="hh-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full min-h-11 rounded-xl border border-slate-200 px-3"
          placeholder="例如：李宅"
        />
        {error && (
          <p role="alert" className="mb-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-11 rounded-xl bg-teal-700 font-bold text-white"
        >
          {busy ? '…' : '建立'}
        </button>
      </form>
    </div>
  )
}

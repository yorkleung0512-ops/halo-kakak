import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import HouseholdPresetsManager from '../components/presets/HouseholdPresetsManager'

/** Public support contact until in-app ownership transfer exists. */
const SUPPORT_ISSUE_URL =
  'https://github.com/yorkleung0512-ops/halo-kakak/issues/new'

const ROLE_LABEL = {
  owner: { zh: '擁有者', id: 'Pemilik' },
  employer: { zh: '僱主', id: 'Majikan' },
  helper: { zh: '幫手', id: 'Asisten' },
}

export default function Settings() {
  const { user, profile, signOut, updateProfile } = useAuth()
  const {
    household,
    role,
    effectiveIsHelper,
    memberships,
    glossary,
    ensureToday,
    selectHousehold,
  } = useHousehold()
  const [name, setName] = useState(profile?.display_name || '')
  const [msg, setMsg] = useState('')

  async function saveProfile(e) {
    e.preventDefault()
    try {
      await updateProfile({ display_name: name.trim() })
      setMsg(effectiveIsHelper ? 'Disimpan' : '已儲存')
    } catch (err) {
      setMsg(err.message)
    }
  }

  async function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile,
      memberships,
      household,
    }
    if (household?.id) {
      const [{ data: tasks }, { data: comments }] = await Promise.all([
        supabase
          .from('task_occurrences')
          .select('*')
          .eq('household_id', household.id)
          .limit(500),
        supabase
          .from('task_comments')
          .select('*')
          .eq('household_id', household.id)
          .eq('user_id', user.id)
          .limit(200),
      ])
      payload.tasks = tasks
      payload.myComments = comments
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `halo-kakak-export-${Date.now()}.json`
    a.click()
  }

  async function leaveHousehold() {
    if (!household?.id) return
    if (role === 'owner') {
      setMsg(
        effectiveIsHelper
          ? 'Pemilik belum bisa keluar di aplikasi. Transfer kepemilikan belum tersedia — buka isu dukungan.'
          : '擁有者暫時無法喺 App 內離開。尚未支援移交擁有權 — 請開支援 Issue。',
      )
      return
    }
    if (!confirm(effectiveIsHelper ? 'Keluar dari rumah tangga?' : '離開呢個家庭？'))
      return
    const { error } = await supabase.rpc('leave_household', {
      p_household_id: household.id,
    })
    if (error) setMsg(error.message)
    else {
      setMsg(effectiveIsHelper ? 'Sudah keluar' : '已離開')
      window.location.href = '/'
    }
  }

  async function requestDelete() {
    if (
      !confirm(
        effectiveIsHelper
          ? 'Ini HANYA mencatat permintaan. Akun belum dihapus. Lanjutkan?'
          : '呢個只會記錄「刪除要求」，帳戶唔會即時刪除。繼續？',
      )
    )
      return
    await supabase.from('privacy_consents').upsert(
      {
        user_id: user.id,
        policy_version: 'deletion-request',
        consent_type: 'privacy',
      },
      { onConflict: 'user_id,policy_version,consent_type' },
    )
    setMsg(
      effectiveIsHelper
        ? 'Permintaan tercatat (belum dihapus). Buka isu dukungan untuk menyelesaikan.'
        : '已記錄刪除要求（帳戶仍在）。請開支援 Issue 完成人手處理。',
    )
  }

  function roleLabel(r) {
    const meta = ROLE_LABEL[r]
    if (!meta) return r
    return effectiveIsHelper ? meta.id : meta.zh
  }

  return (
    <div className="space-y-6">
      <h1
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-lg font-bold"
      >
        {effectiveIsHelper ? 'Pengaturan' : '設定'}
      </h1>

      {msg && (
        <p role="status" className="rounded-xl bg-teal-50 px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-bold">
          {effectiveIsHelper ? 'Profil' : '個人資料'}
        </h2>
        <p className="mb-2 text-sm text-slate-500">{user?.email}</p>
        <form onSubmit={saveProfile} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3"
            aria-label={effectiveIsHelper ? 'Nama tampilan' : '顯示名稱'}
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
          >
            {effectiveIsHelper ? 'Simpan' : '儲存'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-bold">
          {effectiveIsHelper ? 'Keanggotaan' : '家庭成員身分'}
        </h2>
        {memberships.length > 1 && (
          <div className="mb-3">
            <label
              htmlFor="active-household"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {effectiveIsHelper ? 'Rumah tangga aktif' : '目前家庭'}
            </label>
            <select
              id="active-household"
              value={household?.id || ''}
              onChange={(e) => selectHousehold(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {memberships.map((m) => (
                <option key={m.householdId} value={m.householdId}>
                  {m.household?.name || m.householdId} · {roleLabel(m.role)}
                </option>
              ))}
            </select>
          </div>
        )}
        <ul className="text-sm text-slate-700">
          {memberships.map((m) => (
            <li key={m.householdId}>
              {m.household?.name} · {roleLabel(m.role)}
              {m.householdId === household?.id
                ? effectiveIsHelper
                  ? ' (aktif)'
                  : '（目前）'
                : ''}
            </li>
          ))}
        </ul>
        {role === 'owner' && household && (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p lang="zh-Hant">
              擁有者暫時無法離開家庭：App 內尚未支援移交擁有權。如需關閉家庭或移交，請開支援 Issue。
            </p>
            <p lang="id">
              Pemilik belum bisa keluar: transfer kepemilikan belum ada di aplikasi. Untuk menutup atau mentransfer, buka isu dukungan.
            </p>
            <a
              href={SUPPORT_ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-teal-800 underline"
            >
              {effectiveIsHelper ? 'Buka isu dukungan' : '開支援 Issue'}
            </a>
          </div>
        )}
        {role !== 'owner' && household && (
          <button
            type="button"
            onClick={leaveHousehold}
            className="mt-3 min-h-11 rounded-xl border border-rose-200 px-4 text-sm text-rose-700"
          >
            {effectiveIsHelper ? 'Keluar rumah tangga' : '離開家庭'}
          </button>
        )}
      </section>

      {!effectiveIsHelper && household?.id && (
        <HouseholdPresetsManager
          householdId={household.id}
          userId={user.id}
          onToast={setMsg}
          glossary={glossary}
          ensureToday={ensureToday}
        />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="font-bold">
          {effectiveIsHelper ? 'Privasi' : '私隱'}
        </h2>
        <Link className="block min-h-11 text-teal-800 underline" to="/privacy">
          {effectiveIsHelper ? 'Kebijakan Privasi' : '私隱政策'}
        </Link>
        <Link className="block min-h-11 text-teal-800 underline" to="/pics">
          PICS
        </Link>
        <Link className="block min-h-11 text-teal-800 underline" to="/terms">
          {effectiveIsHelper ? 'Syarat Layanan' : '服務條款'}
        </Link>
        <button
          type="button"
          onClick={exportData}
          className="mt-2 block min-h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold"
        >
          {effectiveIsHelper ? 'Ekspor data saya' : '匯出我嘅資料'}
        </button>
        <button
          type="button"
          onClick={requestDelete}
          className="block min-h-11 w-full rounded-xl border border-rose-200 text-sm text-rose-700"
        >
          {effectiveIsHelper
            ? 'Catat permintaan hapus akun'
            : '登記刪除帳戶要求'}
        </button>
        <p className="text-xs text-slate-500">
          {effectiveIsHelper
            ? 'Tombol ini tidak menghapus akun. Hanya mencatat permintaan untuk ditinjau manual.'
            : '呢個掣唔會即時刪除帳戶，只會登記要求，等人手處理。'}
        </p>
        <a
          href={SUPPORT_ISSUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-h-11 text-sm text-teal-800 underline"
        >
          {effectiveIsHelper ? 'Isu dukungan (GitHub)' : '支援 Issue（GitHub）'}
        </a>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="w-full min-h-11 rounded-xl bg-slate-800 font-semibold text-white"
      >
        {effectiveIsHelper ? 'Keluar' : '登出'}
      </button>
    </div>
  )
}

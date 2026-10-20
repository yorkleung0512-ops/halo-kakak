import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import HouseholdPresetsManager from '../components/presets/HouseholdPresetsManager'

export default function Settings() {
  const {
    user,
    profile,
    signOut,
    pendingQueueCount,
    quarantinedQueueCount,
    discardQuarantinedQueue,
    updateProfile,
  } = useAuth()
  const { household, role, effectiveIsHelper, memberships, glossary, ensureToday } =
    useHousehold()
  const [name, setName] = useState(profile?.display_name || '')
  const [msg, setMsg] = useState('')
  const [quarantined, setQuarantined] = useState(0)

  useEffect(() => {
    setQuarantined(quarantinedQueueCount?.() || 0)
  }, [quarantinedQueueCount, user?.id])

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
      setMsg('Owner 請先移交或聯絡支援先離開')
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
          ? 'Kirim permintaan hapus akun? Data akan ditinjau manual.'
          : '要求刪除帳戶？我哋會人手處理。',
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
        ? 'Permintaan tercatat. Hubungi dukungan untuk menyelesaikan.'
        : '已記錄刪除要求。請電郵聯絡支援完成程序。',
    )
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
        <ul className="text-sm text-slate-700">
          {memberships.map((m) => (
            <li key={m.householdId}>
              {m.household?.name} · {m.role}
            </li>
          ))}
        </ul>
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
          Privacy Policy
        </Link>
        <Link className="block min-h-11 text-teal-800 underline" to="/pics">
          PICS
        </Link>
        <Link className="block min-h-11 text-teal-800 underline" to="/terms">
          Terms
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
          {effectiveIsHelper ? 'Minta hapus akun' : '要求刪除帳戶'}
        </button>
      </section>


      {quarantined > 0 && (
        <section
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2"
        >
          <h2 className="font-bold text-amber-950">
            {effectiveIsHelper
              ? 'Perubahan offline lama tidak aman'
              : '舊版未同步變更無法安全重放'}
          </h2>
          <p className="text-sm text-amber-900">
            {effectiveIsHelper
              ? `${quarantined} item antrean lama tidak punya kepemilikan yang jelas, jadi tidak akan dikirim. Anda dapat membuangnya secara eksplisit.`
              : `有 ${quarantined} 項舊版離線佇列缺少可靠擁有者標記，唔會自動重放。請明確捨棄。`}
          </p>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                effectiveIsHelper
                  ? 'Buang perubahan offline lama yang tidak dapat dikirim?'
                  : '確定捨棄無法安全重放嘅舊版離線變更？',
              )
              if (!ok) return
              const n = discardQuarantinedQueue?.() || 0
              setQuarantined(quarantinedQueueCount?.() || 0)
              setMsg(
                effectiveIsHelper
                  ? `Dibuang ${n} item lama`
                  : `已捨棄 ${n} 項舊版變更`,
              )
            }}
            className="min-h-11 rounded-xl border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950"
          >
            {effectiveIsHelper ? 'Buang item lama' : '捨棄舊版佇列'}
          </button>
        </section>
      )}

      <button
        type="button"
        onClick={async () => {
          const pending = pendingQueueCount?.() || 0
          if (pending > 0) {
            const discard = effectiveIsHelper
              ? `Ada ${pending} perubahan offline. Buang dan keluar? (Batal = tetap masuk)`
              : `有 ${pending} 項未同步變更。捨棄並登出？（取消＝繼續留喺入面）`
            if (!window.confirm(discard)) return
          }
          await signOut({ discardPending: true })
        }}
        className="w-full min-h-11 rounded-xl bg-slate-800 font-semibold text-white"
      >
        {effectiveIsHelper ? 'Keluar' : '登出'}
      </button>
    </div>
  )
}

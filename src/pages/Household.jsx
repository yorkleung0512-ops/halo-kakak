import { useCallback, useEffect, useRef, useState } from 'react'
import { Share2, Trash2, UserMinus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { HK_DICT } from '../lib/constants'
import { getSessionEpoch, subscribeSessionEpoch } from '../lib/sessionEpoch'

export default function HouseholdPage() {
  const { user } = useAuth()
  const {
    household,
    role,
    canManageMembers,
    canEditTasks,
    glossary,
    reloadGlossary,
    setPreview,
    previewHelper,
    isEmployerSide,
  } = useHousehold()

  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteLink, setInviteLink] = useState('')
  const [toast, setToast] = useState('')
  const [gZh, setGZh] = useState('')
  const [gId, setGId] = useState('')
  const loadGenRef = useRef(0)
  const hhIdRef = useRef(household?.id || null)

  useEffect(() => {
    hhIdRef.current = household?.id || null
  }, [household?.id])

  const clearLocal = useCallback(() => {
    loadGenRef.current += 1
    setMembers([])
    setInvites([])
    setInviteLink('')
  }, [])

  useEffect(() => subscribeSessionEpoch(() => clearLocal()), [clearLocal])

  useEffect(() => {
    if (!user || !household?.id) {
      clearLocal()
    }
  }, [user?.id, household?.id, clearLocal])

  const load = useCallback(async () => {
    if (!user || !household?.id) {
      clearLocal()
      return
    }
    const gen = ++loadGenRef.current
    const expectedHh = household.id
    const epoch = getSessionEpoch()
    const [{ data: mem }, { data: inv }] = await Promise.all([
      supabase
        .from('household_members')
        .select('user_id, role, status, joined_at')
        .eq('household_id', expectedHh)
        .eq('status', 'active'),
      supabase
        .from('household_invites')
        .select('id, invited_role, expires_at, used_at, revoked_at, created_at')
        .eq('household_id', expectedHh)
        .is('used_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false }),
    ])
    if (gen !== loadGenRef.current) return
    if (hhIdRef.current !== expectedHh) return
    if (getSessionEpoch() !== epoch) return
    let enriched = mem || []
    const ids = enriched.map((m) => m.user_id)
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      if (gen !== loadGenRef.current) return
      if (hhIdRef.current !== expectedHh) return
      if (getSessionEpoch() !== epoch) return
      const map = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
      enriched = enriched.map((m) => ({ ...m, profiles: map[m.user_id] || null }))
    }
    setMembers(enriched)
    setInvites(inv || [])
  }, [household?.id, user, clearLocal])

  useEffect(() => {
    load()
  }, [load])

  // OFF-1: refresh member list on reconnect without full page reload
  useEffect(() => {
    function onOnline() {
      load()
    }
    function onVis() {
      if (document.visibilityState === 'visible' && navigator.onLine) load()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  async function createInvite() {
    const { data, error } = await supabase.rpc('create_household_invite', {
      p_household_id: household.id,
      p_invited_role: 'helper',
      p_expires_hours: 72,
    })
    if (error) {
      setToast(error.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const link = `${window.location.origin}/invite/${row.token}`
    setInviteLink(link)
    setToast('邀請已建立（只顯示一次）')
    load()
  }

  function shareWhatsApp() {
    if (!inviteLink) return
    const text = encodeURIComponent(
      `Hola-Kakak — silakan buka tautan undangan ini untuk bergabung:\n${inviteLink}`,
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
  }

  async function revoke(id) {
    const { error } = await supabase.rpc('revoke_household_invite', {
      p_invite_id: id,
    })
    if (error) setToast(error.message)
    else {
      setToast('已撤銷')
      load()
    }
  }

  async function removeMember(uid) {
    if (!confirm('確定移除呢位成員？')) return
    const { error } = await supabase.rpc('remove_household_member', {
      p_household_id: household.id,
      p_user_id: uid,
    })
    if (error) setToast(error.message)
    else {
      setToast('已移除')
      load()
    }
  }

  async function addGlossary(e) {
    e.preventDefault()
    if (!gZh.trim() || !gId.trim()) return
    const { error } = await supabase.from('household_glossary').upsert(
      {
        household_id: household.id,
        chinese_term: gZh.trim(),
        indonesian_term: gId.trim(),
        created_by: user.id,
      },
      { onConflict: 'household_id,chinese_term' },
    )
    if (error) setToast(error.message)
    else {
      setGZh('')
      setGId('')
      reloadGlossary()
      setToast('詞彙已儲存')
    }
  }

  async function deleteGlossary(id) {
    await supabase.from('household_glossary').delete().eq('id', id)
    reloadGlossary()
  }

  if (!isEmployerSide) {
    return (
      <p lang="id" className="text-slate-500">
        Halaman ini untuk majikan.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 lang="zh-Hant" className="text-lg font-bold">
          家庭
        </h1>
        <p className="text-sm text-slate-500">{household?.name}</p>
      </div>

      {toast && (
        <p role="status" className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {toast}
        </p>
      )}

      {canEditTasks && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-bold">預覽姐姐介面</h2>
          <p className="mb-3 text-xs text-slate-500">
            唯讀預覽，唔會改變你嘅真實角色。
          </p>
          <button
            type="button"
            onClick={() => setPreview(!previewHelper)}
            className="min-h-11 rounded-xl bg-amber-100 px-4 text-sm font-semibold text-amber-950"
          >
            {previewHelper ? '退出預覽' : 'Preview helper view'}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">邀請姐姐</h2>
        <button
          type="button"
          onClick={createInvite}
          className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white"
        >
          產生邀請連結
        </button>
        {inviteLink && (
          <div className="mt-3 space-y-2">
            <input
              readOnly
              value={inviteLink}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              aria-label="邀請連結"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink)
                  setToast('已複製')
                }}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 text-sm"
              >
                複製
              </button>
              <button
                type="button"
                onClick={shareWhatsApp}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
              >
                <Share2 className="h-4 w-4" /> WhatsApp
              </button>
            </div>
          </div>
        )}
        {invites.length > 0 && (
          <ul className="mt-4 space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {inv.invited_role} · 到期{' '}
                  {new Date(inv.expires_at).toLocaleString('zh-HK', {
                    timeZone: 'Asia/Hong_Kong',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => revoke(inv.id)}
                  className="min-h-11 rounded-lg px-2 text-rose-700"
                  aria-label="撤銷邀請"
                >
                  撤銷
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">成員</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between gap-2"
            >
              <div>
                <p className="font-medium">
                  {m.profiles?.display_name || m.user_id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-500">{m.role}</p>
              </div>
              {canManageMembers && m.user_id !== user.id && (
                <div className="flex items-center gap-1">
                  {/* Beta: role-change select hidden (decision H). Server RPC unchanged. */}
                  <button
                    type="button"
                    onClick={() => removeMember(m.user_id)}
                    aria-label="移除成員"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-rose-700"
                  >
                    <UserMinus className="h-5 w-5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canEditTasks && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-bold">家庭詞彙表</h2>
          <form onSubmit={addGlossary} className="mb-3 grid gap-2 sm:grid-cols-3">
            <input
              value={gZh}
              onChange={(e) => setGZh(e.target.value)}
              placeholder="中文"
              className="min-h-11 rounded-xl border border-slate-200 px-3"
            />
            <input
              value={gId}
              onChange={(e) => setGId(e.target.value)}
              placeholder="Bahasa Indonesia"
              lang="id"
              className="min-h-11 rounded-xl border border-slate-200 px-3"
            />
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-teal-700 text-sm font-semibold text-white"
            >
              新增
            </button>
          </form>
          <ul className="space-y-1 text-sm">
            {glossary.map((g) => (
              <li key={g.id} className="flex justify-between gap-2">
                <span>
                  <span lang="zh-Hant">{g.chinese_term}</span>
                  {' → '}
                  <span lang="id">{g.indonesian_term}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteGlossary(g.id)}
                  aria-label="刪除詞彙"
                  className="min-h-11 min-w-11 text-rose-600"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <details className="mt-3 text-xs text-slate-500">
            <summary>內建常用詞（參考）</summary>
            <ul className="mt-1 columns-2 gap-2">
              {Object.entries(HK_DICT)
                .slice(0, 12)
                .map(([zh, id]) => (
                  <li key={zh}>
                    {zh} → {id}
                  </li>
                ))}
            </ul>
          </details>
        </section>
      )}

      <p className="text-xs text-slate-400">你嘅角色：{role}</p>
    </div>
  )
}

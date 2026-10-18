import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Copy,
  Link2,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Volume2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Home,
  ListTodo,
  Clock,
} from 'lucide-react'
import { supabase, SUPABASE_URL } from './lib/supabase'
import { translateToIndonesian, speakIndonesian, HK_DICT } from './lib/translate'
import {
  DEFAULT_ROOM,
  SAMPLE_ROUTINES,
  SAMPLE_TASKS,
  createId,
} from './lib/sampleData'

const STORAGE_KEY = 'halo-kakak-v1'
const CHANNEL_NAME = 'halo-kakak-sync'

function parseQuery() {
  const params = new URLSearchParams(window.location.search)
  return {
    room: params.get('room') || DEFAULT_ROOM,
    mode: params.get('mode') === 'kakak' ? 'helper' : 'employer',
  }
}

function loadLocal(room) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${room}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveLocal(room, payload) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${room}`, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}

function formatDoneAt(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('zh-HK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Hong_Kong',
    })
  } catch {
    return ''
  }
}

export default function App() {
  const initial = useMemo(() => parseQuery(), [])
  const [roomCode, setRoomCode] = useState(initial.room)
  const [roomInput, setRoomInput] = useState(initial.room)
  const [mode, setMode] = useState(initial.mode) // employer | helper
  const [routines, setRoutines] = useState(SAMPLE_ROUTINES)
  const [tasks, setTasks] = useState(SAMPLE_TASKS)
  const [syncStatus, setSyncStatus] = useState('idle') // idle | syncing | ok | error
  const [lastSynced, setLastSynced] = useState(null)
  const [showAdd, setShowAdd] = useState(null) // 'routine' | 'task' | null
  const [formZh, setFormZh] = useState('')
  const [formId, setFormId] = useState('')
  const [formTime, setFormTime] = useState('09:00')
  const [formUrgent, setFormUrgent] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [listening, setListening] = useState(false)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  const recognitionRef = useRef(null)
  const skipPushRef = useRef(false)
  const bcRef = useRef(null)
  const isHelper = mode === 'helper'

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }, [])

  const buildPayload = useCallback(
    () => ({
      routines,
      tasks,
      updatedAt: new Date().toISOString(),
    }),
    [routines, tasks],
  )

  const applyPayload = useCallback((payload, { fromRemote = false } = {}) => {
    if (!payload) return
    if (Array.isArray(payload.routines)) setRoutines(payload.routines)
    if (Array.isArray(payload.tasks)) setTasks(payload.tasks)
    if (payload.updatedAt) setLastSynced(payload.updatedAt)
    if (fromRemote) skipPushRef.current = true
  }, [])

  // Load local on room change
  useEffect(() => {
    const local = loadLocal(roomCode)
    if (local?.routines || local?.tasks) {
      applyPayload(local, { fromRemote: true })
    } else {
      setRoutines(SAMPLE_ROUTINES)
      setTasks(SAMPLE_TASKS)
    }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist local + BroadcastChannel
  useEffect(() => {
    const payload = buildPayload()
    saveLocal(roomCode, payload)
    try {
      if (!bcRef.current) {
        bcRef.current = new BroadcastChannel(CHANNEL_NAME)
        bcRef.current.onmessage = (ev) => {
          if (ev.data?.room === roomCode && ev.data?.payload) {
            applyPayload(ev.data.payload, { fromRemote: true })
          }
        }
      }
      bcRef.current.postMessage({ room: roomCode, payload })
    } catch {
      /* BroadcastChannel unsupported */
    }
  }, [routines, tasks, roomCode, buildPayload, applyPayload])

  // Supabase: fetch + realtime + poll
  const pushToSupabase = useCallback(
    async (payload) => {
      setSyncStatus('syncing')
      try {
        const { error } = await supabase.from('household_sync').upsert(
          {
            room_code: roomCode,
            payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_code' },
        )
        if (error) throw error
        setSyncStatus('ok')
        setLastSynced(payload.updatedAt)
      } catch (err) {
        console.error('supabase upsert', err)
        setSyncStatus('error')
      }
    },
    [roomCode],
  )

  const pullFromSupabase = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('household_sync')
        .select('payload, updated_at')
        .eq('room_code', roomCode)
        .maybeSingle()
      if (error) throw error
      if (data?.payload) {
        applyPayload(
          {
            ...data.payload,
            updatedAt: data.updated_at || data.payload.updatedAt,
          },
          { fromRemote: true },
        )
        setSyncStatus('ok')
        setLastSynced(data.updated_at || data.payload.updatedAt)
        return true
      }
      // Seed remote with local sample
      const seed = {
        routines: SAMPLE_ROUTINES,
        tasks: SAMPLE_TASKS,
        updatedAt: new Date().toISOString(),
      }
      await pushToSupabase(seed)
      return false
    } catch (err) {
      console.error('supabase pull', err)
      setSyncStatus('error')
      return false
    }
  }, [roomCode, applyPayload, pushToSupabase])

  useEffect(() => {
    pullFromSupabase()
    const channel = supabase
      .channel(`household_sync:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_sync',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new
          if (row?.payload) {
            applyPayload(
              {
                ...row.payload,
                updatedAt: row.updated_at || row.payload.updatedAt,
              },
              { fromRemote: true },
            )
            setSyncStatus('ok')
          }
        },
      )
      .subscribe()

    const poll = setInterval(() => {
      pullFromSupabase()
    }, 4000)

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [roomCode, pullFromSupabase, applyPayload])

  // Push local changes (debounced) unless just applied from remote
  useEffect(() => {
    if (skipPushRef.current) {
      skipPushRef.current = false
      return
    }
    const t = setTimeout(() => {
      pushToSupabase(buildPayload())
    }, 600)
    return () => clearTimeout(t)
  }, [routines, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = () => {
    const code = (roomInput || '').trim().toUpperCase() || DEFAULT_ROOM
    setRoomCode(code)
    const url = new URL(window.location.href)
    url.searchParams.set('room', code)
    if (mode === 'helper') url.searchParams.set('mode', 'kakak')
    else url.searchParams.delete('mode')
    window.history.replaceState({}, '', url.toString())
    showToast(isHelper ? `Masuk kamar: ${code}` : `已加入房間：${code}`)
  }

  const helperLink = useMemo(() => {
    const url = new URL(window.location.origin + window.location.pathname)
    url.searchParams.set('room', roomCode)
    url.searchParams.set('mode', 'kakak')
    return url.toString()
  }, [roomCode])

  const copyHelperLink = async () => {
    try {
      await navigator.clipboard.writeText(helperLink)
      setCopied(true)
      showToast('已複製姐姐連結 / Link Kakak disalin')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast(helperLink)
    }
  }

  const toggleRoutine = (id) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
    )
  }

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const done = !t.done
        return {
          ...t,
          done,
          doneAt: done ? new Date().toISOString() : null,
        }
      }),
    )
  }

  const resetRoutines = () => {
    if (!isHelper && !window.confirm('重置今日所有固定工作打勾？')) return
    setRoutines((prev) => prev.map((r) => ({ ...r, done: false })))
    showToast(isHelper ? 'Jadwal direset' : '已重置固定工作')
  }

  const deleteRoutine = (id) => {
    if (isHelper) return
    setRoutines((prev) => prev.filter((r) => r.id !== id))
  }

  const deleteTask = (id) => {
    if (isHelper) return
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const runTranslate = async (text) => {
    setTranslating(true)
    try {
      const id = await translateToIndonesian(text)
      setFormId(id)
    } finally {
      setTranslating(false)
    }
  }

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      showToast('呢個瀏覽器唔支援語音輸入／Browser tidak mendukung suara')
      return
    }
    try {
      const rec = new SR()
      recognitionRef.current = rec
      rec.lang = 'zh-HK'
      rec.continuous = false
      rec.interimResults = false
      rec.onstart = () => setListening(true)
      rec.onend = () => setListening(false)
      rec.onerror = () => {
        setListening(false)
        showToast('語音識別失敗／Gagal mengenali suara')
      }
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript || ''
        if (transcript) {
          setFormZh(transcript)
          runTranslate(transcript)
        }
      }
      rec.start()
    } catch {
      showToast('無法啟動麥克風／Tidak bisa mulai mikrofon')
    }
  }

  const stopListening = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }

  const submitAdd = async () => {
    const zh = formZh.trim()
    if (!zh) return
    let idText = formId.trim()
    if (!idText) {
      setTranslating(true)
      idText = await translateToIndonesian(zh)
      setTranslating(false)
      setFormId(idText)
    }
    if (showAdd === 'routine') {
      setRoutines((prev) =>
        [...prev, { id: createId('r'), time: formTime, zh, idText, done: false }].sort(
          (a, b) => a.time.localeCompare(b.time),
        ),
      )
    } else {
      setTasks((prev) => [
        {
          id: createId('t'),
          zh,
          idText,
          urgent: formUrgent,
          done: false,
          doneAt: null,
        },
        ...prev,
      ])
    }
    setFormZh('')
    setFormId('')
    setFormUrgent(false)
    setShowAdd(null)
    showToast(isHelper ? 'Ditambahkan' : '已新增')
  }

  const quickPhrases = Object.keys(HK_DICT).slice(0, 8)

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => a.time.localeCompare(b.time)),
    [routines],
  )

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-teal-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg text-white shadow-sm">
              🏠
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                {isHelper ? 'Halo Kakak!' : '屋企家務通'}
              </h1>
              <p className="text-xs text-slate-500">
                {isHelper
                  ? 'Manajer Rumah Tangga Dwibahasa'
                  : 'Halo Kakak · 中印雙語家務管理'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                syncStatus === 'ok'
                  ? 'bg-emerald-50 text-emerald-700'
                  : syncStatus === 'error'
                    ? 'bg-rose-50 text-rose-700'
                    : syncStatus === 'syncing'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
              }`}
              title={SUPABASE_URL}
            >
              {syncStatus === 'error' ? (
                <WifiOff className="h-3.5 w-3.5" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {syncStatus === 'ok'
                ? isHelper
                  ? 'Tersinkron'
                  : '已同步'
                : syncStatus === 'error'
                  ? isHelper
                    ? 'Offline'
                    : '同步失敗'
                  : syncStatus === 'syncing'
                    ? '…'
                    : '—'}
            </span>

            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode('employer')
                  const url = new URL(window.location.href)
                  url.searchParams.delete('mode')
                  window.history.replaceState({}, '', url.toString())
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  !isHelper
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                僱主
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('helper')
                  const url = new URL(window.location.href)
                  url.searchParams.set('mode', 'kakak')
                  window.history.replaceState({}, '', url.toString())
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  isHelper
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Kakak
              </button>
            </div>
          </div>
        </div>

        {/* Room bar */}
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 border-t border-teal-50 px-4 py-2">
          <label className="text-xs font-medium text-slate-500">
            {isHelper ? 'Kode Kamar' : '房間碼'}
          </label>
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-mono font-semibold tracking-wide text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            placeholder="HOME-888"
          />
          <button
            type="button"
            onClick={joinRoom}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <Link2 className="h-3.5 w-3.5" />
            {isHelper ? 'Gabung' : '加入'}
          </button>
          {!isHelper && (
            <button
              type="button"
              onClick={copyHelperLink}
              className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? '已複製' : '複製姐姐連結'}
            </button>
          )}
          {lastSynced && (
            <span className="ml-auto text-[10px] text-slate-400">
              {isHelper ? 'Update' : '更新'}{' '}
              {formatDoneAt(lastSynced) || lastSynced}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        {/* Routines */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-700" />
              <div>
                <h2
                  className={`font-bold text-slate-900 ${isHelper ? 'text-lg' : 'text-base'}`}
                >
                  {isHelper ? 'Jadwal Harian' : '每日固定工作'}
                </h2>
                {!isHelper && (
                  <p className="text-xs text-slate-500">Jadwal Harian</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {!isHelper && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd('routine')
                    setFormZh('')
                    setFormId('')
                    setFormTime('09:00')
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> 新增
                </button>
              )}
              <button
                type="button"
                onClick={resetRoutines}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isHelper ? 'Reset' : '重置'}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-slate-100">
            {sortedRoutines.map((r) => (
              <li
                key={r.id}
                className={`flex items-start gap-3 px-4 py-3.5 transition ${
                  r.done ? 'bg-emerald-50/40' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleRoutine(r.id)}
                  className="mt-0.5 shrink-0 text-teal-700"
                  aria-label="toggle"
                >
                  {r.done ? (
                    <CheckCircle2 className={`${isHelper ? 'h-8 w-8' : 'h-6 w-6'}`} />
                  ) : (
                    <Circle className={`${isHelper ? 'h-8 w-8' : 'h-6 w-6'} text-slate-300`} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 font-mono text-xs font-bold text-teal-700">
                    {r.time}
                  </div>
                  {isHelper ? (
                    <>
                      <p
                        className={`font-semibold text-slate-900 ${isHelper ? 'text-lg leading-snug' : 'text-sm'} ${r.done ? 'line-through opacity-60' : ''}`}
                      >
                        {r.idText}
                      </p>
                      <p className="text-xs text-slate-400">{r.zh}</p>
                    </>
                  ) : (
                    <>
                      <p
                        className={`text-sm font-semibold text-slate-900 ${r.done ? 'line-through opacity-60' : ''}`}
                      >
                        {r.zh}
                      </p>
                      <p className="text-xs text-slate-500">{r.idText}</p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakIndonesian(r.idText)}
                    className="rounded-lg p-2 text-teal-700 hover:bg-teal-50"
                    title="🔊 Bahasa Indonesia"
                  >
                    <Volume2 className={isHelper ? 'h-6 w-6' : 'h-4 w-4'} />
                  </button>
                  {!isHelper && (
                    <button
                      type="button"
                      onClick={() => deleteRoutine(r.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Tasks */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-amber-700" />
              <div>
                <h2
                  className={`font-bold text-slate-900 ${isHelper ? 'text-lg' : 'text-base'}`}
                >
                  {isHelper ? 'Tugas Khusus Hari Ini' : '今日特別任務'}
                </h2>
                {!isHelper && (
                  <p className="text-xs text-slate-500">Tugas Khusus Hari Ini</p>
                )}
              </div>
            </div>
            {!isHelper && (
              <button
                type="button"
                onClick={() => {
                  setShowAdd('task')
                  setFormZh('')
                  setFormId('')
                  setFormUrgent(false)
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> 新增
              </button>
            )}
          </div>

          <ul className="divide-y divide-slate-100">
            {tasks.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                {isHelper ? 'Belum ada tugas' : '暫無特別任務'}
              </li>
            )}
            {tasks.map((t) => (
              <li
                key={t.id}
                className={`flex items-start gap-3 px-4 py-3.5 ${t.done ? 'bg-emerald-50/40' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  className="mt-0.5 shrink-0 text-amber-600"
                >
                  {t.done ? (
                    <CheckCircle2 className={`${isHelper ? 'h-8 w-8' : 'h-6 w-6'}`} />
                  ) : (
                    <Circle className={`${isHelper ? 'h-8 w-8' : 'h-6 w-6'} text-slate-300`} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  {t.urgent && !t.done && (
                    <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                      <AlertTriangle className="h-3 w-3" />
                      {isHelper ? 'Urgent' : '緊急'}
                    </span>
                  )}
                  {isHelper ? (
                    <>
                      <p
                        className={`font-semibold text-slate-900 ${isHelper ? 'text-lg leading-snug' : ''} ${t.done ? 'line-through opacity-60' : ''}`}
                      >
                        {t.idText}
                      </p>
                      <p className="text-xs text-slate-400">{t.zh}</p>
                    </>
                  ) : (
                    <>
                      <p
                        className={`text-sm font-semibold text-slate-900 ${t.done ? 'line-through opacity-60' : ''}`}
                      >
                        {t.zh}
                      </p>
                      <p className="text-xs text-slate-500">{t.idText}</p>
                    </>
                  )}
                  {t.done && t.doneAt && (
                    <p className="mt-1 text-[10px] text-emerald-600">
                      ✓ {formatDoneAt(t.doneAt)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakIndonesian(t.idText)}
                    className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"
                  >
                    <Volume2 className={isHelper ? 'h-6 w-6' : 'h-4 w-4'} />
                  </button>
                  {!isHelper && (
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400">
          {isHelper
            ? 'Data disinkronkan lewat Supabase (room code). Simpan link ini di layar utama HP.'
            : '資料經 Supabase 以房間碼即時同步。可將姐姐連結經 WhatsApp 傳送。Anon key 僅供公開前端使用。'}
        </p>
      </main>

      {/* Add modal */}
      {showAdd && !isHelper && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-slate-900">
              {showAdd === 'routine' ? '新增固定工作' : '新增今日任務'}
            </h3>

            {showAdd === 'routine' && (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  時間
                </span>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            )}

            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                中文／廣東話
              </span>
              <div className="flex gap-2">
                <input
                  value={formZh}
                  onChange={(e) => setFormZh(e.target.value)}
                  onBlur={() => formZh.trim() && runTranslate(formZh)}
                  placeholder="例如：買餸、煲湯、抹地…"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={`rounded-xl px-3 ${
                    listening
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="廣東話語音輸入 zh-HK"
                >
                  {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              </div>
            </label>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {quickPhrases.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setFormZh(p)
                    runTranslate(p)
                  }}
                  className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-100"
                >
                  {p}
                </button>
              ))}
            </div>

            <label className="mb-3 block">
              <span className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                Bahasa Indonesia
                {translating && (
                  <span className="text-amber-600">翻譯中…</span>
                )}
                {formId && (
                  <button
                    type="button"
                    onClick={() => speakIndonesian(formId)}
                    className="text-teal-700"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
              <textarea
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                placeholder="Auto-translate…"
              />
            </label>

            {showAdd === 'task' && (
              <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formUrgent}
                  onChange={(e) => setFormUrgent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600"
                />
                標為緊急 / Urgent
              </label>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitAdd}
                disabled={!formZh.trim() || translating}
                className="flex-1 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Helper FAB hint */}
      {isHelper && (
        <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-teal-200 bg-white/95 px-4 py-2 text-xs text-teal-800 shadow-md backdrop-blur">
          <Home className="h-4 w-4" />
          Ketuk lingkaran untuk selesai · 🔊 untuk dengar
        </div>
      )}
    </div>
  )
}

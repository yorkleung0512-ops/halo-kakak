import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal'
import {
  deepLinkForNotification,
  notificationCopy,
  NOTIF_LABELS,
  occurrenceExists,
  templateExists,
} from '../../lib/notifications'
import { useNotifications } from '../../lib/notificationsContext'

function formatWhen(iso, isHelper) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(isHelper ? 'id-ID' : 'zh-HK', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Hong_Kong',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function NotificationCentre() {
  const {
    centreOpen,
    closeCentre,
    items,
    loading,
    error,
    offline,
    isHelper,
    markRead,
    markUnread,
    markAll,
    refreshAll,
  } = useNotifications()
  const [tab, setTab] = useState('all') // all | unread
  const [busyId, setBusyId] = useState(null)
  const [goneMsg, setGoneMsg] = useState('')
  const navigate = useNavigate()
  const L = isHelper ? NOTIF_LABELS.id : NOTIF_LABELS.zh

  const filtered = useMemo(() => {
    if (tab === 'unread') return items.filter((n) => !n.read_at)
    return items
  }, [items, tab])

  async function onOpen(n) {
    setBusyId(n.id)
    setGoneMsg('')
    try {
      await markRead([n.id])
      let ok = true
      if (n.task_occurrence_id) {
        ok = await occurrenceExists(n.task_occurrence_id)
      } else if (n.task_template_id) {
        ok = await templateExists(n.task_template_id)
      }
      if (!ok) {
        setGoneMsg(L.gone)
        return
      }
      closeCentre()
      navigate(deepLinkForNotification(n))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      open={centreOpen}
      onClose={closeCentre}
      title={L.centre}
      labelledBy="notif-centre-title"
    >
      <div lang={isHelper ? 'id' : 'zh-Hant'}>
        {(offline || error) && (
          <div
            role="status"
            className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {offline ? L.syncOffline : L.syncError}
            <button
              type="button"
              onClick={refreshAll}
              className="ml-2 min-h-[44px] underline"
            >
              {isHelper ? 'Coba lagi' : '重試'}
            </button>
          </div>
        )}

        <div className="mb-3 flex gap-2" role="tablist" aria-label={L.centre}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            onClick={() => setTab('all')}
            className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
              tab === 'all'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {L.all}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'unread'}
            onClick={() => setTab('unread')}
            className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
              tab === 'unread'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {L.unread}
          </button>
        </div>

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAll}
            className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {L.markAll}
          </button>
        </div>

        {goneMsg && (
          <p role="alert" className="mb-2 text-sm text-rose-700">
            {goneMsg}
          </p>
        )}

        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-slate-500">…</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            {tab === 'unread' ? L.emptyUnread : L.empty}
          </p>
        ) : (
          <ul className="space-y-2" aria-label={L.centre}>
            {filtered.map((n) => {
              const copy = notificationCopy(n, isHelper)
              const unread = !n.read_at
              return (
                <li
                  key={n.id}
                  className={`rounded-2xl border p-3 ${
                    unread
                      ? 'border-teal-300 bg-teal-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {unread && (
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-600" aria-hidden />
                        )}
                        {copy.title}
                      </p>
                      {copy.body && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                          {copy.body}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {formatWhen(n.created_at, isHelper)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === n.id}
                      onClick={() => onOpen(n)}
                      className="min-h-[44px] rounded-xl bg-teal-700 px-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-60"
                    >
                      {L.open}
                    </button>
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => markRead([n.id])}
                        className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        {L.markRead}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markUnread(n.id)}
                        className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        {L.markUnread}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

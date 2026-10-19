import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deepLinkForNotification,
  notificationCopy,
  NOTIF_LABELS,
} from '../../lib/notifications'
import { useNotifications } from '../../lib/notificationsContext'

const AUTO_MS = 6000

export default function NotificationToast() {
  const { toast, dismissToast, markRead, isHelper } = useNotifications()
  const navigate = useNavigate()
  const L = isHelper ? NOTIF_LABELS.id : NOTIF_LABELS.zh
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)
  const remainingRef = useRef(AUTO_MS)
  const startedRef = useRef(0)

  useEffect(() => {
    if (!toast) return
    remainingRef.current = AUTO_MS
    startedRef.current = Date.now()
    setPaused(false)
  }, [toast?.id])

  useEffect(() => {
    if (!toast || paused) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    startedRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      dismissToast()
    }, remainingRef.current)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedRef.current),
      )
    }
  }, [toast, paused, dismissToast])

  if (!toast?.notification) return null
  const n = toast.notification
  const copy = notificationCopy(n, isHelper)

  async function onView() {
    await markRead([n.id])
    dismissToast()
    navigate(deepLinkForNotification(n))
  }

  return (
    <div
      role="status"
      aria-live="polite"
      lang={isHelper ? 'id' : 'zh-Hant'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
      className="fixed bottom-24 left-1/2 z-[60] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-teal-200 bg-white p-3 shadow-xl"
    >
      <p className="text-xs font-semibold text-teal-800">{L.newTask}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{copy.title}</p>
      {copy.body && (
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{copy.body}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onView}
          className="min-h-[44px] flex-1 rounded-xl bg-teal-700 px-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          {L.view}
        </button>
        <button
          type="button"
          onClick={dismissToast}
          className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          {L.dismiss}
        </button>
      </div>
    </div>
  )
}

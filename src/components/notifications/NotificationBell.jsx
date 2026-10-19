import { Bell } from 'lucide-react'
import { formatUnreadBadge, NOTIF_LABELS } from '../../lib/notifications'
import { useNotifications } from '../../lib/notificationsContext'

export default function NotificationBell() {
  const { unreadCount, openCentre, centreOpen, bellRef, isHelper } =
    useNotifications()
  const L = isHelper ? NOTIF_LABELS.id : NOTIF_LABELS.zh
  const badge = formatUnreadBadge(unreadCount)
  const label =
    badge == null
      ? L.bell
      : isHelper
        ? `${L.bell}, ${unreadCount} belum dibaca`
        : `${L.bell}，${unreadCount} 則未讀`

  return (
    <button
      ref={bellRef}
      type="button"
      onClick={() => (centreOpen ? null : openCentre())}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={centreOpen}
      className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-teal-800 transition hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {badge && (
        <span
          aria-hidden
          className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white"
        >
          {badge}
        </span>
      )}
    </button>
  )
}

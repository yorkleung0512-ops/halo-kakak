import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchNotificationById,
  occurrenceExists,
  templateExists,
  NOTIF_LABELS,
} from '../../lib/notifications'
import { useNotifications } from '../../lib/notificationsContext'

/**
 * Handles ?n= notification id and validates ?task= / ?template= targets.
 * Safe after refresh; shows toast if target gone.
 */
export default function NotificationDeepLink() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { markRead, setToast, isHelper } = useNotifications()
  const handled = useRef(new Set())
  const L = isHelper ? NOTIF_LABELS.id : NOTIF_LABELS.zh

  useEffect(() => {
    const nId = params.get('n')
    const taskId = params.get('task')
    const templateId = params.get('template')
    const key = `${nId || ''}|${taskId || ''}|${templateId || ''}|${location.pathname}`
    if (!nId && !taskId && !templateId) return
    if (handled.current.has(key)) return
    handled.current.add(key)

    let cancelled = false
    ;(async () => {
      try {
        if (nId) {
          const row = await fetchNotificationById(nId)
          if (row && !row.read_at) await markRead([nId])
        }
        if (taskId) {
          const ok = await occurrenceExists(taskId)
          if (!ok && !cancelled) {
            setToast({
              id: `gone-task-${taskId}`,
              notification: {
                id: `gone-task-${taskId}`,
                title_zh: L.gone,
                title_id: L.gone,
                body_zh: '',
                body_id: '',
              },
              at: Date.now(),
            })
            const next = new URLSearchParams(params)
            next.delete('task')
            next.delete('n')
            navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
          }
        } else if (templateId) {
          const ok = await templateExists(templateId)
          if (!ok && !cancelled) {
            setToast({
              id: `gone-tpl-${templateId}`,
              notification: {
                id: `gone-tpl-${templateId}`,
                title_zh: L.gone,
                title_id: L.gone,
                body_zh: '',
                body_id: '',
              },
              at: Date.now(),
            })
            const next = new URLSearchParams(params)
            next.delete('template')
            next.delete('n')
            navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
          }
        }
      } catch {
        /* fail safely */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, location.pathname, markRead, setToast, navigate, L.gone])

  return null
}

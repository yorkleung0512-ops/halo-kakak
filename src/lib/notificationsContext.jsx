import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import { supabase } from './supabase'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationUnread,
  markNotificationsRead,
  softDeleteNotification,
} from './notifications'

const NotificationsContext = createContext(null)

const CHANNEL_PREFIX = 'halo-kakak-notif-'

export function NotificationsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const { household, effectiveIsHelper } = useHousehold()
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState([])
  const [centreOpen, setCentreOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [toast, setToast] = useState(null)
  const channelRef = useRef(null)
  const bellRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const initialLoadDone = useRef(false)

  const clearLocal = useCallback(() => {
    setUnreadCount(0)
    setItems([])
    setToast(null)
    setError(null)
    setCentreOpen(false)
    seenIdsRef.current = new Set()
    initialLoadDone.current = false
  }, [])

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUnreadCount(0)
      return 0
    }
    try {
      const n = await fetchUnreadCount()
      setUnreadCount(n)
      setError(null)
      return n
    } catch (e) {
      setError(e?.message || 'sync')
      return 0
    }
  }, [isAuthenticated, user])

  const refreshList = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const rows = await fetchNotifications({ limit: 50 })
      setItems(rows)
      rows.forEach((r) => seenIdsRef.current.add(r.id))
      setError(null)
    } catch (e) {
      setError(e?.message || 'sync')
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }, [isAuthenticated, user])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshUnread(), refreshList()])
  }, [refreshUnread, refreshList])

  // Online / visibility refetch
  useEffect(() => {
    function onOnline() {
      setOffline(false)
      refreshAll()
    }
    function onOffline() {
      setOffline(true)
    }
    function onVis() {
      if (document.visibilityState === 'visible') refreshAll()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshAll])

  // Initial + household / auth change
  useEffect(() => {
    if (!isAuthenticated || !user) {
      clearLocal()
      return
    }
    refreshAll()
  }, [isAuthenticated, user?.id, household?.id, clearLocal, refreshAll])

  // Realtime subscription — one channel per user, cleaned on logout/unmount/user change
  useEffect(() => {
    let cancelled = false
    async function setup() {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (!isAuthenticated || !user?.id || cancelled) return

      const name = `${CHANNEL_PREFIX}${user.id}`
      const channel = supabase
        .channel(name)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new
            if (!row?.id) return
            if (seenIdsRef.current.has(row.id)) return
            seenIdsRef.current.add(row.id)
            setItems((prev) => {
              if (prev.some((p) => p.id === row.id)) return prev
              return [row, ...prev].slice(0, 50)
            })
            setUnreadCount((c) => c + (row.read_at ? 0 : 1))
            // Toast only for realtime after initial load
            if (initialLoadDone.current) {
              setToast({
                id: row.id,
                notification: row,
                at: Date.now(),
              })
            }
            // Reconcile from DB shortly (authoritative unread)
            setTimeout(() => {
              refreshUnread()
            }, 400)
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${user.id}`,
          },
          () => {
            refreshUnread()
            refreshList()
          },
        )
        .subscribe()

      channelRef.current = channel
    }
    setup()
    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isAuthenticated, user?.id, refreshUnread, refreshList])

  // Sign-out cleanup already via isAuthenticated flip → clearLocal + channel teardown

  const openCentre = useCallback(() => {
    setCentreOpen(true)
    refreshAll()
  }, [refreshAll])

  const closeCentre = useCallback(() => {
    setCentreOpen(false)
    queueMicrotask(() => bellRef.current?.focus?.())
  }, [])

  const markRead = useCallback(
    async (ids) => {
      await markNotificationsRead(ids)
      setItems((prev) =>
        prev.map((n) =>
          ids.includes(n.id) ? { ...n, read_at: n.read_at || new Date().toISOString() } : n,
        ),
      )
      await refreshUnread()
    },
    [refreshUnread],
  )

  const markUnread = useCallback(
    async (id) => {
      await markNotificationUnread(id)
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
      )
      await refreshUnread()
    },
    [refreshUnread],
  )

  const markAll = useCallback(async () => {
    await markAllNotificationsRead()
    setItems((prev) =>
      prev.map((n) => ({
        ...n,
        read_at: n.read_at || new Date().toISOString(),
      })),
    )
    await refreshUnread()
  }, [refreshUnread])

  const dismissToast = useCallback(() => setToast(null), [])

  const removeLocal = useCallback(
    async (id) => {
      await softDeleteNotification(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
      await refreshUnread()
    },
    [refreshUnread],
  )

  const value = useMemo(
    () => ({
      unreadCount,
      items,
      centreOpen,
      loading,
      error,
      offline,
      toast,
      isHelper: effectiveIsHelper,
      bellRef,
      openCentre,
      closeCentre,
      refreshAll,
      markRead,
      markUnread,
      markAll,
      dismissToast,
      setToast,
      removeLocal,
    }),
    [
      unreadCount,
      items,
      centreOpen,
      loading,
      error,
      offline,
      toast,
      effectiveIsHelper,
      openCentre,
      closeCentre,
      refreshAll,
      markRead,
      markUnread,
      markAll,
      dismissToast,
      removeLocal,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}

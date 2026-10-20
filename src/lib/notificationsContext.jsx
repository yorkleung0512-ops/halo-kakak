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
import { getSessionEpoch, subscribeSessionEpoch } from './sessionEpoch'

const NotificationsContext = createContext(null)

const CHANNEL_PREFIX = 'hola-kakak-notif-'

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
  const userIdRef = useRef(user?.id || null)
  const refreshGenRef = useRef(0)
  const epochAtClearRef = useRef(getSessionEpoch())

  useEffect(() => {
    userIdRef.current = user?.id || null
  }, [user?.id])

  const clearLocal = useCallback(() => {
    refreshGenRef.current += 1
    epochAtClearRef.current = getSessionEpoch()
    setUnreadCount(0)
    setItems([])
    setToast(null)
    setError(null)
    setCentreOpen(false)
    setLoading(false)
    seenIdsRef.current = new Set()
    initialLoadDone.current = false
  }, [])

  // Epoch bumps (sign-out / user / household) invalidate in-flight refresh
  useEffect(() => {
    return subscribeSessionEpoch(() => {
      clearLocal()
    })
  }, [clearLocal])

  const refreshUnread = useCallback(async () => {
    const gen = ++refreshGenRef.current
    const expectedUser = userIdRef.current
    if (!isAuthenticated || !expectedUser) {
      setUnreadCount(0)
      return 0
    }
    try {
      const n = await fetchUnreadCount()
      if (gen !== refreshGenRef.current) return 0
      if (userIdRef.current !== expectedUser) return 0
      setUnreadCount(n)
      setError(null)
      return n
    } catch (e) {
      if (gen !== refreshGenRef.current) return 0
      if (userIdRef.current !== expectedUser) return 0
      setError(e?.message || 'sync')
      return 0
    }
  }, [isAuthenticated])

  const refreshList = useCallback(async () => {
    const gen = ++refreshGenRef.current
    const expectedUser = userIdRef.current
    if (!isAuthenticated || !expectedUser) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const rows = await fetchNotifications({ limit: 50 })
      if (gen !== refreshGenRef.current) return
      if (userIdRef.current !== expectedUser) return
      setItems(rows)
      rows.forEach((r) => seenIdsRef.current.add(r.id))
      setError(null)
    } catch (e) {
      if (gen !== refreshGenRef.current) return
      if (userIdRef.current !== expectedUser) return
      setError(e?.message || 'sync')
    } finally {
      if (gen === refreshGenRef.current && userIdRef.current === expectedUser) {
        setLoading(false)
        initialLoadDone.current = true
      }
    }
  }, [isAuthenticated])

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
    const boundUserId = user?.id || null
    const boundEpoch = getSessionEpoch()
    async function setup() {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (!isAuthenticated || !boundUserId || cancelled) return

      const name = `${CHANNEL_PREFIX}${boundUserId}`
      const channel = supabase
        .channel(name)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${boundUserId}`,
          },
          (payload) => {
            if (cancelled) return
            if (userIdRef.current !== boundUserId) return
            if (getSessionEpoch() !== boundEpoch) return
            const row = payload.new
            if (!row?.id) return
            if (seenIdsRef.current.has(row.id)) return
            seenIdsRef.current.add(row.id)
            setItems((prev) => {
              if (prev.some((p) => p.id === row.id)) return prev
              return [row, ...prev].slice(0, 50)
            })
            setUnreadCount((c) => c + (row.read_at ? 0 : 1))
            if (initialLoadDone.current) {
              setToast({
                id: row.id,
                notification: row,
                at: Date.now(),
              })
            }
            setTimeout(() => {
              if (userIdRef.current !== boundUserId) return
              if (getSessionEpoch() !== boundEpoch) return
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
            filter: `recipient_user_id=eq.${boundUserId}`,
          },
          () => {
            if (cancelled) return
            if (userIdRef.current !== boundUserId) return
            if (getSessionEpoch() !== boundEpoch) return
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
      if (!userIdRef.current) return
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
      if (!userIdRef.current) return
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
      )
      await refreshUnread()
    },
    [refreshUnread],
  )

  const markAll = useCallback(async () => {
    await markAllNotificationsRead()
    if (!userIdRef.current) return
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
      if (!userIdRef.current) return
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
      clearLocal,
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
      clearLocal,
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

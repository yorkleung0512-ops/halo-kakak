import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase } from './supabase'
import { mapAuthError } from './constants'
import {
  clearSessionLocalState,
  countPendingForUser,
  countQuarantined,
  discardQuarantined,
} from './sessionLocalState'
import { bumpSessionEpoch } from './sessionEpoch'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const lastUserIdRef = useRef(undefined)
  const explicitSignOutRef = useRef(false)

  const refreshProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    setProfile(data || null)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      lastUserIdRef.current = data.session?.user?.id ?? null
      setLoading(false)
      if (data.session?.user) refreshProfile(data.session.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      const nextUser = next?.user ?? null
      const nextId = nextUser?.id ?? null
      const prevId = lastUserIdRef.current

      setSession(next)
      setUser(nextUser)

      if (event === 'SIGNED_OUT' || (!nextUser && prevId)) {
        // Cover Settings signOut and external session loss (expired / other tab).
        // explicitSignOut already cleared queue+prefs; still bump/clear idempotently.
        if (!explicitSignOutRef.current) {
          clearSessionLocalState(prevId || null, { discardQueue: true })
        } else {
          bumpSessionEpoch('SIGNED_OUT')
        }
        explicitSignOutRef.current = false
        setProfile(null)
      } else if (nextUser && prevId && nextId !== prevId) {
        // Account switch without an intervening SIGNED_OUT (rare) — isolate.
        clearSessionLocalState(prevId, { discardQueue: true })
        refreshProfile(nextId)
      } else if (nextUser) {
        if (prevId !== nextId) bumpSessionEpoch('user_change')
        refreshProfile(nextId)
      }

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setAuthError(null)
      }

      lastUserIdRef.current = nextId
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [refreshProfile])

  const signInWithMagicLink = useCallback(async (email, { lang = 'zh', redirectTo } = {}) => {
    setAuthError(null)
    const redirect =
      redirectTo ||
      `${window.location.origin}/auth/callback${window.location.search || ''}`
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirect,
        shouldCreateUser: true,
      },
    })
    if (error) {
      const msg = mapAuthError(error, lang)
      setAuthError(msg)
      throw new Error(msg)
    }
    return true
  }, [])

  /**
   * @param {{ discardPending?: boolean }} [opts]
   * discardPending defaults true — call sites should confirm when count > 0.
   */
  const signOut = useCallback(async (opts = {}) => {
    const { discardPending = true } = opts
    const uid = user?.id || null
    explicitSignOutRef.current = true
    clearSessionLocalState(uid, { discardQueue: discardPending })
    await supabase.auth.signOut()
    setProfile(null)
  }, [user?.id])

  const pendingQueueCount = useCallback(() => {
    return countPendingForUser(user?.id || null)
  }, [user?.id])

  const quarantinedQueueCount = useCallback(() => countQuarantined(), [])

  const discardQuarantinedQueue = useCallback(() => discardQuarantined(), [])

  const updateProfile = useCallback(
    async (patch) => {
      if (!user) return
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      setProfile(data)
      return data
    },
    [user],
  )

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      authError,
      setAuthError,
      signInWithMagicLink,
      signOut,
      pendingQueueCount,
      quarantinedQueueCount,
      discardQuarantinedQueue,
      updateProfile,
      refreshProfile,
      isAuthenticated: !!session?.user,
    }),
    [
      session,
      user,
      profile,
      loading,
      authError,
      signInWithMagicLink,
      signOut,
      pendingQueueCount,
      quarantinedQueueCount,
      discardQuarantinedQueue,
      updateProfile,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

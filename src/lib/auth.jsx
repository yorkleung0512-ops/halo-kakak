import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from './supabase'
import { mapAuthError } from './constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

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
      setLoading(false)
      if (data.session?.user) refreshProfile(data.session.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
      } else if (next?.user) {
        refreshProfile(next.user.id)
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setAuthError(null)
      }
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

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

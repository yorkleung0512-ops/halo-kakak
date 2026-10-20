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
import { useAuth } from './auth'
import { todayHK } from './constants'
import {
  STORAGE_ACTIVE_HOUSEHOLD,
  STORAGE_PREVIEW_HELPER,
} from './sessionLocalState'
import { bumpSessionEpoch, getSessionEpoch } from './sessionEpoch'

const HouseholdContext = createContext(null)

export function HouseholdProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [household, setHousehold] = useState(null)
  const [role, setRole] = useState(null)
  const [glossary, setGlossary] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewHelper, setPreviewHelper] = useState(false)
  const loadGenRef = useRef(0)

  const loadMemberships = useCallback(async () => {
    const gen = ++loadGenRef.current
    if (!user) {
      setMemberships([])
      setHousehold(null)
      setRole(null)
      setGlossary([])
      setPreviewHelper(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('household_members')
      .select('role, status, household_id, households(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (gen !== loadGenRef.current) return

    if (error) {
      console.warn('memberships', error.message)
      setMemberships([])
      setHousehold(null)
      setRole(null)
      setLoading(false)
      return
    }

    const rows = (data || [])
      .filter((r) => r.households && !r.households.deleted_at)
      .map((r) => ({
        role: r.role,
        householdId: r.household_id,
        household: r.households,
      }))
    setMemberships(rows)

    let saved = null
    try {
      saved = localStorage.getItem(STORAGE_ACTIVE_HOUSEHOLD)
    } catch {
      /* ignore */
    }
    // Only restore saved household if still an active membership for this user.
    const pick =
      rows.find((r) => r.householdId === saved) || rows[0] || null
    if (pick) {
      setHousehold(pick.household)
      setRole(pick.role)
      try {
        localStorage.setItem(STORAGE_ACTIVE_HOUSEHOLD, pick.householdId)
      } catch {
        /* ignore */
      }
    } else {
      setHousehold(null)
      setRole(null)
      try {
        localStorage.removeItem(STORAGE_ACTIVE_HOUSEHOLD)
      } catch {
        /* ignore */
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

  // OFF-1: refetch memberships on reconnect / foreground without full reload
  useEffect(() => {
    function onOnline() {
      if (user) loadMemberships()
    }
    function onVis() {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        user
      ) {
        loadMemberships()
      }
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, loadMemberships])

  const loadGlossary = useCallback(async (hhId) => {
    const gen = loadGenRef.current
    const epoch = getSessionEpoch()
    if (!hhId) {
      setGlossary([])
      return
    }
    const { data } = await supabase
      .from('household_glossary')
      .select('*')
      .eq('household_id', hhId)
      .order('chinese_term')
    if (gen !== loadGenRef.current) return
    if (getSessionEpoch() !== epoch) return
    setGlossary(data || [])
  }, [])

  useEffect(() => {
    if (household?.id) loadGlossary(household.id)
    else setGlossary([])
  }, [household?.id, loadGlossary])

  const selectHousehold = useCallback(
    (householdId) => {
      const m = memberships.find((r) => r.householdId === householdId)
      if (!m) return
      if (household?.id && household.id !== householdId) {
        bumpSessionEpoch('household_switch')
        loadGenRef.current += 1
        setGlossary([])
      } else if (!household?.id) {
        bumpSessionEpoch('household_select')
      }
      setHousehold(m.household)
      setRole(m.role)
      try {
        localStorage.setItem(STORAGE_ACTIVE_HOUSEHOLD, householdId)
      } catch {
        /* ignore */
      }
    },
    [memberships, household?.id],
  )

  const createHousehold = useCallback(
    async (name, timezone = 'Asia/Hong_Kong') => {
      const { data, error } = await supabase.rpc('create_household', {
        p_name: name,
        p_timezone: timezone,
      })
      if (error) throw error
      await loadMemberships()
      if (data?.id) {
        try {
          localStorage.setItem(STORAGE_ACTIVE_HOUSEHOLD, data.id)
        } catch {
          /* ignore */
        }
      }
      return data
    },
    [loadMemberships],
  )

  const ensureToday = useCallback(async () => {
    if (!household?.id) return 0
    const { data, error } = await supabase.rpc('ensure_today_occurrences', {
      p_household_id: household.id,
      p_date: todayHK(),
    })
    if (error) {
      console.warn('ensure_today', error.message)
      return 0
    }
    return data || 0
  }, [household?.id])

  const setPreview = useCallback((on) => {
    // Preview never changes real role — employers only; session-local only
    setPreviewHelper(!!on)
    try {
      if (on) localStorage.setItem(STORAGE_PREVIEW_HELPER, '1')
      else localStorage.removeItem(STORAGE_PREVIEW_HELPER)
    } catch {
      /* ignore */
    }
  }, [])

  // Preview flag is UI-only; do not restore across accounts after sign-out
  // (cleared in clearSessionLocalState). Re-read only when employer signs in.
  useEffect(() => {
    if (!user) {
      setPreviewHelper(false)
      return
    }
    try {
      setPreviewHelper(localStorage.getItem(STORAGE_PREVIEW_HELPER) === '1')
    } catch {
      setPreviewHelper(false)
    }
  }, [user?.id])

  /**
   * Server-path check: is the authenticated user an active member of householdId?
   * Used before offline queue replay. RLS remains authoritative on writes.
   */
  const verifyActiveMembership = useCallback(
    async (householdId, expectedUserId) => {
      if (!householdId || !expectedUserId) {
        return { ok: false, reason: 'missing_ids' }
      }
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authData?.user) {
        return { ok: false, reason: 'auth_unavailable' }
      }
      if (authData.user.id !== expectedUserId) {
        return { ok: false, reason: 'auth_mismatch' }
      }
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, status')
        .eq('user_id', expectedUserId)
        .eq('household_id', householdId)
        .eq('status', 'active')
        .maybeSingle()
      if (error) {
        return { ok: false, reason: 'membership_query_failed' }
      }
      if (!data) {
        return { ok: false, reason: 'not_active_member' }
      }
      return { ok: true }
    },
    [],
  )

  const isEmployerSide = role === 'owner' || role === 'employer'
  const effectiveIsHelper = role === 'helper' || (isEmployerSide && previewHelper)

  const value = useMemo(
    () => ({
      memberships,
      household,
      role,
      glossary,
      loading: loading || !isAuthenticated ? loading : loading,
      selectHousehold,
      createHousehold,
      reload: loadMemberships,
      reloadGlossary: () => loadGlossary(household?.id),
      ensureToday,
      previewHelper: isEmployerSide && previewHelper,
      setPreview,
      isEmployerSide,
      isHelper: role === 'helper',
      effectiveIsHelper,
      canManageMembers: role === 'owner',
      canEditTasks: isEmployerSide,
      verifyActiveMembership,
    }),
    [
      memberships,
      household,
      role,
      glossary,
      loading,
      isAuthenticated,
      selectHousehold,
      createHousehold,
      loadMemberships,
      loadGlossary,
      ensureToday,
      previewHelper,
      setPreview,
      isEmployerSide,
      effectiveIsHelper,
      verifyActiveMembership,
    ],
  )

  return (
    <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}

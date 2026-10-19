import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { todayHK } from './constants'

const HouseholdContext = createContext(null)
const STORAGE_HH = 'halo-kakak-active-household'
const STORAGE_PREVIEW = 'halo-kakak-preview-helper'

export function HouseholdProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [household, setHousehold] = useState(null)
  const [role, setRole] = useState(null)
  const [glossary, setGlossary] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewHelper, setPreviewHelper] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_PREVIEW) === '1'
    } catch {
      return false
    }
  })

  const loadMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setHousehold(null)
      setRole(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('household_members')
      .select('role, status, household_id, households(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (error) {
      console.warn('memberships', error.message)
      setMemberships([])
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
      saved = localStorage.getItem(STORAGE_HH)
    } catch {
      /* ignore */
    }
    const pick =
      rows.find((r) => r.householdId === saved) || rows[0] || null
    if (pick) {
      setHousehold(pick.household)
      setRole(pick.role)
      try {
        localStorage.setItem(STORAGE_HH, pick.householdId)
      } catch {
        /* ignore */
      }
    } else {
      setHousehold(null)
      setRole(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

  const loadGlossary = useCallback(async (hhId) => {
    if (!hhId) {
      setGlossary([])
      return
    }
    const { data } = await supabase
      .from('household_glossary')
      .select('*')
      .eq('household_id', hhId)
      .order('chinese_term')
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
      setHousehold(m.household)
      setRole(m.role)
      try {
        localStorage.setItem(STORAGE_HH, householdId)
      } catch {
        /* ignore */
      }
    },
    [memberships],
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
          localStorage.setItem(STORAGE_HH, data.id)
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
    // Preview never changes real role — employers only
    setPreviewHelper(!!on)
    try {
      localStorage.setItem(STORAGE_PREVIEW, on ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

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

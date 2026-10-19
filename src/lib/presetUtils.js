/**
 * Pure preset helpers (no Supabase / browser deps) — safe for Node unit tests.
 */

/** Map suggested_recurrence jsonb → existing recurrence_rule / weekdays */
export function mapRecurrence(suggested) {
  if (!suggested || typeof suggested !== 'object') {
    return { recurrence_rule: 'none', recurrence_weekdays: null }
  }
  const rule = suggested.rule || 'none'
  if (rule === 'selected_weekdays' || rule === 'custom') {
    const days = Array.isArray(suggested.weekdays) ? suggested.weekdays : null
    if (days?.length) {
      return { recurrence_rule: 'weekly', recurrence_weekdays: days }
    }
    return { recurrence_rule: 'weekdays', recurrence_weekdays: null }
  }
  if (rule === 'biweekly') {
    return { recurrence_rule: 'weekly', recurrence_weekdays: null }
  }
  if (['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(rule)) {
    return {
      recurrence_rule: rule,
      recurrence_weekdays: Array.isArray(suggested.weekdays)
        ? suggested.weekdays
        : null,
    }
  }
  return { recurrence_rule: 'none', recurrence_weekdays: null }
}

/** Detect phone / address / door code / ID / bank / medical in free text */
export function detectSensitiveContent(text) {
  if (!text || typeof text !== 'string') return { sensitive: false, kinds: [] }
  const kinds = []
  const checks = [
    { kind: 'phone', re: /(?:\+?852[\s-]?)?(?:[456789]\d{3}[\s-]?\d{4}|\d{8})\b/ },
    {
      kind: 'door_code',
      re: /(?:大門|門鎖|密碼|門禁|kunci|password|pin)\s*[:：]?\s*\d{4,}/i,
    },
    { kind: 'id', re: /(?:身份證|身分證|HKID|[A-Z]\d{6}\(?\d\)?)/i },
    {
      kind: 'bank',
      re: /(?:銀行|戶口|卡號|account|bank|visa|mastercard)\s*[:：]?\s*\d{4,}/i,
    },
    {
      kind: 'medical',
      re: /(?:病歷|診斷|處方|allerg(?:y|i)|diagnosis|prescription)/i,
    },
    {
      kind: 'address',
      re: /(?:室|樓|座|大廈|街|道|村|Flat|Floor|Block|Street|Road)\s*\d/i,
    },
  ]
  for (const c of checks) {
    if (c.re.test(text)) kinds.push(c.kind)
  }
  return { sensitive: kinds.length > 0, kinds }
}

export function filterPresets(
  presets,
  { query = '', categoryKey = null, source = null } = {},
) {
  const q = query.trim().toLowerCase()
  return presets.filter((p) => {
    if (source === 'household' && p.source !== 'household') return false
    if (source === 'system' && p.source !== 'system') return false
    if (categoryKey && categoryKey !== 'mine' && categoryKey !== 'all') {
      const ck = p.category_key || p.category?.key
      if (ck !== categoryKey) return false
    }
    if (categoryKey === 'mine' && p.source !== 'household') return false
    if (!q) return true
    const hay = [
      p.title_zh,
      p.title_id,
      p.instructions_zh,
      p.instructions_id,
      ...(p.keywords || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function recurrenceLabel(rec) {
  const rule = rec?.rule || rec
  const map = {
    none: '單次',
    daily: '每日',
    weekdays: '平日',
    weekly: '每週',
    monthly: '每月',
  }
  return map[rule] || '自訂'
}

/** Hong Kong hour 0–23 for time-of-day ranking */
export function hourHK(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now)
    return Number(parts.find((p) => p.type === 'hour')?.value || 12)
  } catch {
    return now.getHours()
  }
}

/**
 * Score a preset for Quick Add ranking.
 * Higher = better. Favourites → recent → time-of-day → defaults.
 */
export function scoreQuickAddPreset(preset, ctx) {
  const {
    favouriteIds = new Set(),
    recentIds = [],
    hour = 12,
  } = ctx
  let score = 0
  if (favouriteIds.has(preset.id)) score += 1000
  const recentIdx = recentIds.indexOf(preset.id)
  if (recentIdx >= 0) score += 500 - recentIdx * 10

  const time = (preset.suggested_time || '').toString().slice(0, 5)
  if (time) {
    const [h] = time.split(':').map(Number)
    const dist = Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour))
    score += Math.max(0, 80 - dist * 8)
  }

  if (preset.source === 'household') score += 40
  const cat = preset.category_key || preset.category?.key
  // Morning: cooking / transport / baby; afternoon: cleaning / laundry; evening: cooking / childcare
  const morning = new Set(['cooking', 'transport', 'baby', 'pets'])
  const afternoon = new Set(['cleaning', 'laundry', 'shopping', 'maintenance'])
  const evening = new Set(['cooking', 'childcare', 'elderly', 'special'])
  if (hour < 11 && morning.has(cat)) score += 25
  else if (hour < 17 && afternoon.has(cat)) score += 25
  else if (evening.has(cat)) score += 25

  score += Math.max(0, 20 - (preset.sort_order || 0) / 5)
  return score
}

/**
 * Build Quick Add list: favourites → recent → time-of-day → popularity/defaults.
 * @returns up to `limit` presets (default 16, max 20)
 */
export function buildQuickAddList(
  { favourites = [], recent = [], all = [] },
  { limit = 16, max = 20 } = {},
) {
  const cap = Math.min(Math.max(limit, 10), max)
  const favouriteIds = new Set(favourites.map((p) => p.id))
  const recentIds = recent.map((p) => p.id)
  const hour = hourHK()
  const byId = new Map()
  for (const p of [...favourites, ...recent, ...all]) {
    if (!p?.id || byId.has(p.id)) continue
    if (p.archived_at) continue
    byId.set(p.id, p)
  }
  const ranked = [...byId.values()].sort(
    (a, b) =>
      scoreQuickAddPreset(b, { favouriteIds, recentIds, hour }) -
      scoreQuickAddPreset(a, { favouriteIds, recentIds, hour }),
  )
  return ranked.slice(0, cap)
}

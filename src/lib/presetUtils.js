/**
 * Pure preset helpers (no Supabase / browser deps) — safe for Node unit tests.
 */

/** ISO weekday 1=Mon .. 7=Sun (matches PostgreSQL extract(isodow)) */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export const WEEKDAY_LABELS = {
  zh: { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' },
  id: {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
    7: 'Minggu',
  },
}

export const RECURRENCE_RULES = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'custom',
]

/**
 * Map suggested_recurrence jsonb → recurrence_rule / weekdays / interval.
 * Weekdays are ISO 1–7. Backward compatible with Phase 1 callers.
 */
export function mapRecurrence(suggested) {
  if (!suggested || typeof suggested !== 'object') {
    return {
      recurrence_rule: 'none',
      recurrence_weekdays: null,
      recurrence_interval: 1,
    }
  }
  const rule = suggested.rule || 'none'
  const interval = Math.min(
    365,
    Math.max(1, Number(suggested.interval) || Number(suggested.recurrence_interval) || 1),
  )
  const days = Array.isArray(suggested.weekdays)
    ? suggested.weekdays.map(Number).filter((d) => d >= 1 && d <= 7)
    : null

  if (rule === 'selected_weekdays') {
    if (days?.length) {
      return {
        recurrence_rule: 'weekly',
        recurrence_weekdays: days,
        recurrence_interval: interval,
      }
    }
    return {
      recurrence_rule: 'weekdays',
      recurrence_weekdays: null,
      recurrence_interval: 1,
    }
  }
  if (rule === 'biweekly') {
    return {
      recurrence_rule: 'biweekly',
      recurrence_weekdays: days?.length ? days : null,
      recurrence_interval: Math.max(interval, 2),
    }
  }
  if (rule === 'custom') {
    return {
      recurrence_rule: 'custom',
      recurrence_weekdays: days?.length ? days : null,
      recurrence_interval: interval,
    }
  }
  if (['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(rule)) {
    return {
      recurrence_rule: rule,
      recurrence_weekdays: days?.length ? days : null,
      recurrence_interval: interval,
    }
  }
  return {
    recurrence_rule: 'none',
    recurrence_weekdays: null,
    recurrence_interval: 1,
  }
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

const RULE_LABEL_ZH = {
  none: '單次',
  daily: '每日',
  weekdays: '平日',
  weekly: '每週',
  biweekly: '每兩週',
  monthly: '每月',
  custom: '自訂間隔',
}

const RULE_LABEL_ID = {
  none: 'Sekali',
  daily: 'Setiap hari',
  weekdays: 'Hari kerja',
  weekly: 'Mingguan',
  biweekly: 'Dua minggu sekali',
  monthly: 'Bulanan',
  custom: 'Interval kustom',
}

/** Bilingual recurrence label. Pass { rule, weekdays, interval } or a rule string. */
export function recurrenceLabel(rec, lang = 'zh') {
  const rule = typeof rec === 'string' ? rec : rec?.rule || rec?.recurrence_rule
  const weekdays =
    typeof rec === 'object' ? rec?.weekdays || rec?.recurrence_weekdays : null
  const interval =
    typeof rec === 'object'
      ? Number(rec?.interval || rec?.recurrence_interval || 1)
      : 1
  const map = lang === 'id' ? RULE_LABEL_ID : RULE_LABEL_ZH
  let base = map[rule] || (lang === 'id' ? 'Kustom' : '自訂')
  if (rule === 'custom' && interval > 1) {
    base =
      lang === 'id' ? `Setiap ${interval} hari` : `每 ${interval} 日`
  }
  if (rule === 'daily' && interval > 1) {
    base =
      lang === 'id' ? `Setiap ${interval} hari` : `每 ${interval} 日`
  }
  if (
    (rule === 'weekly' || rule === 'biweekly') &&
    Array.isArray(weekdays) &&
    weekdays.length
  ) {
    const labels = WEEKDAY_LABELS[lang === 'id' ? 'id' : 'zh']
    const days = weekdays
      .map((d) => labels[d] || d)
      .join(lang === 'id' ? ', ' : '')
    base = `${base}（${days}）`
  }
  return base
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
 * Higher = better. Favourites → recent → time-of-day → usage/defaults.
 */
export function scoreQuickAddPreset(preset, ctx) {
  const {
    favouriteIds = new Set(),
    recentIds = [],
    hour = 12,
    usageCounts = {},
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

  const uses = usageCounts[preset.id] || 0
  score += Math.min(60, uses * 5)

  if (preset.source === 'household') score += 40
  const cat = preset.category_key || preset.category?.key
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
 * Build Quick Add list: favourites → recent → time-of-day → usage.
 * @returns up to `limit` presets (default 6 visible; pass higher for "view all")
 */
export function buildQuickAddList(
  { favourites = [], recent = [], all = [], usageCounts = {} },
  { limit = 6, max = 40 } = {},
) {
  const cap = Math.min(Math.max(limit, 1), max)
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
      scoreQuickAddPreset(b, { favouriteIds, recentIds, hour, usageCounts }) -
      scoreQuickAddPreset(a, { favouriteIds, recentIds, hour, usageCounts }),
  )
  return ranked.slice(0, cap)
}

/** Edit scope labels for recurring tasks */
export const EDIT_SCOPES = [
  {
    value: 'this_only',
    zh: '只修改今次',
    id: 'Hanya kali ini',
  },
  {
    value: 'this_and_future',
    zh: '今次及之後',
    id: 'Kali ini dan seterusnya',
  },
  {
    value: 'entire_series',
    zh: '整個排程',
    id: 'Seluruh jadwal',
  },
]


export const OFFLINE_PRESET_MSG = {
  zh: '離線：顯示已緩存嘅系統範本。家庭範本要連線先睇到。',
  id: 'Luring: menampilkan templat sistem tersimpan. Templat rumah tangga perlu koneksi.',
}

export const UNAVAILABLE_PRESET_MSG = {
  zh: '暫時無法載入範本庫，顯示本地備份。',
  id: 'Tidak dapat memuat pustaka templat; menampilkan cadangan lokal.',
}

export const CLIENT_SEED_VERSION = '2026.10.19'

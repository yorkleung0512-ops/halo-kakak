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

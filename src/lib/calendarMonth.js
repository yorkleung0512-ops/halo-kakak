/**
 * Hong Kong calendar helpers (YYYY-MM-DD dates, Monday-first week).
 */

const WEEKDAY_ZH = ['一', '二', '三', '四', '五', '六', '日']
const WEEKDAY_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/** Parse YYYY-MM-DD as local calendar parts (no TZ shift). */
export function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''))
  if (!m) return null
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  }
}

export function formatYmd(year, month, day) {
  const y = String(year)
  const mo = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function addMonths(ymd, delta) {
  const p = parseYmd(ymd)
  if (!p) return ymd
  const d = new Date(p.year, p.month - 1 + delta, 1)
  return formatYmd(d.getFullYear(), d.getMonth() + 1, 1)
}

/** First / last day of the month containing ymd. */
export function monthBounds(ymd) {
  const p = parseYmd(ymd)
  if (!p) return { start: ymd, end: ymd }
  const last = new Date(p.year, p.month, 0).getDate()
  return {
    start: formatYmd(p.year, p.month, 1),
    end: formatYmd(p.year, p.month, last),
  }
}

/**
 * Monday-first month grid cells for the month of `anchorYmd`.
 * Leading/trailing days from adjacent months included so weeks are complete.
 */
export function buildMonthGrid(anchorYmd) {
  const p = parseYmd(anchorYmd)
  if (!p) return []
  const first = new Date(p.year, p.month - 1, 1)
  // JS: 0=Sun … 6=Sat → Monday-first index 0..6
  const mondayIndex = (first.getDay() + 6) % 7
  const daysInMonth = new Date(p.year, p.month, 0).getDate()
  const cells = []
  const total = Math.ceil((mondayIndex + daysInMonth) / 7) * 7
  for (let i = 0; i < total; i++) {
    const dayNum = i - mondayIndex + 1
    const date = new Date(p.year, p.month - 1, dayNum)
    const ymd = formatYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
    cells.push({
      ymd,
      day: date.getDate(),
      inMonth: date.getMonth() === p.month - 1,
    })
  }
  return cells
}

export function weekdayLabels(lang = 'zh') {
  return lang === 'id' ? WEEKDAY_ID : WEEKDAY_ZH
}

export function monthTitle(ymd, lang = 'zh') {
  const p = parseYmd(ymd)
  if (!p) return ymd
  if (lang === 'id') {
    const name = new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(p.year, p.month - 1, 1))
    return name
  }
  return `${p.year}年${p.month}月`
}

/** Count tasks per YYYY-MM-DD from rows with task_date. */
export function countsByDate(rows) {
  const map = {}
  for (const row of rows || []) {
    const d = row?.task_date
    if (!d) continue
    map[d] = (map[d] || 0) + 1
  }
  return map
}

/**
 * Lightweight unit tests for preset helpers (no Vitest required).
 * Run: node scripts/presets-unit.mjs
 */
import {
  mapRecurrence,
  detectSensitiveContent,
  filterPresets,
  recurrenceLabel,
} from '../src/lib/presetUtils.js'

let failed = 0
function assert(name, cond, detail = '') {
  if (cond) console.log(`PASS: ${name}`)
  else {
    failed++
    console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`)
  }
}

assert('map daily', mapRecurrence({ rule: 'daily' }).recurrence_rule === 'daily')
assert('map none', mapRecurrence({ rule: 'none' }).recurrence_rule === 'none')
assert(
  'map biweekly→weekly',
  mapRecurrence({ rule: 'biweekly' }).recurrence_rule === 'weekly',
)
assert(
  'map selected_weekdays',
  mapRecurrence({ rule: 'selected_weekdays', weekdays: [1, 3, 5] })
    .recurrence_rule === 'weekly' &&
    mapRecurrence({ rule: 'selected_weekdays', weekdays: [1, 3, 5] })
      .recurrence_weekdays.length === 3,
)
assert('map null→none', mapRecurrence(null).recurrence_rule === 'none')

assert(
  'sensitive phone',
  detectSensitiveContent('請打 9123 4567').sensitive,
)
assert(
  'sensitive door',
  detectSensitiveContent('大門密碼: 123456').kinds.includes('door_code'),
)
assert(
  'clean text',
  !detectSensitiveContent('請拖地同洗碗').sensitive,
)

const sample = [
  {
    id: '1',
    source: 'system',
    category_key: 'cooking',
    title_zh: '準備早餐',
    title_id: 'Siapkan sarapan',
    keywords: ['早餐'],
  },
  {
    id: '2',
    source: 'household',
    category_key: 'cleaning',
    title_zh: '清潔客廳',
    title_id: 'Bersihkan',
    keywords: [],
  },
]
assert(
  'filter search zh',
  filterPresets(sample, { query: '早餐' }).length === 1,
)
assert(
  'filter category',
  filterPresets(sample, { categoryKey: 'cleaning' })[0].id === '2',
)
assert(
  'filter mine',
  filterPresets(sample, { categoryKey: 'mine' }).every(
    (p) => p.source === 'household',
  ),
)
assert('label daily', recurrenceLabel({ rule: 'daily' }) === '每日')

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)

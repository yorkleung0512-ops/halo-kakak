/**
 * Lightweight unit tests for preset helpers (no Vitest required).
 * Run: node scripts/presets-unit.mjs
 */
import {
  mapRecurrence,
  detectSensitiveContent,
  filterPresets,
  recurrenceLabel,
  buildQuickAddList,
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

const qa = buildQuickAddList(
  {
    favourites: [{ id: 'f1', title_zh: 'fav', source: 'household', category_key: 'cooking' }],
    recent: [{ id: 'r1', title_zh: 'recent', source: 'system', category_key: 'cleaning' }],
    all: Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      title_zh: `sys${i}`,
      source: 'system',
      category_key: 'cleaning',
      sort_order: i,
      suggested_time: '10:00',
    })),
  },
  { limit: 16, max: 20 },
)
assert('quick add size 10-20', qa.length >= 10 && qa.length <= 20, `n=${qa.length}`)
assert('quick add fav first', qa[0].id === 'f1')
assert('quick add cap 20', buildQuickAddList({ all: Array.from({length:40},(_,i)=>({id:`x${i}`,source:'system',category_key:'pets',sort_order:i})) }, { limit: 16, max: 20 }).length <= 20)



import { mapBatchError } from '../src/lib/batchErrors.js'
assert('mapBatchError INVALID_ASSIGNEE', mapBatchError({ message: 'INVALID_ASSIGNEE' }).includes('指派'))
assert('mapBatchError BATCH_LIMIT', mapBatchError({ message: 'BATCH_LIMIT_EXCEEDED' }).includes('20'))
assert('mapBatchError fallback', mapBatchError({ message: 'weird' }) === 'weird')

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)

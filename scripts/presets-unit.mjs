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
  EDIT_SCOPES,
  ISO_WEEKDAYS,
  WEEKDAY_LABELS,
  CLIENT_SEED_VERSION,
  OFFLINE_PRESET_MSG,
  UNAVAILABLE_PRESET_MSG,
} from '../src/lib/presetUtils.js'
import { mapBatchError } from '../src/lib/batchErrors.js'
import { draftToPayload } from '../src/lib/taskPayload.js'


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
  'map biweekly keeps biweekly',
  mapRecurrence({ rule: 'biweekly' }).recurrence_rule === 'biweekly',
)
assert(
  'map biweekly interval >=2',
  mapRecurrence({ rule: 'biweekly', interval: 1 }).recurrence_interval >= 2,
)
assert(
  'map custom interval',
  mapRecurrence({ rule: 'custom', interval: 3 }).recurrence_rule === 'custom' &&
    mapRecurrence({ rule: 'custom', interval: 3 }).recurrence_interval === 3,
)
assert(
  'map selected_weekdays',
  mapRecurrence({ rule: 'selected_weekdays', weekdays: [1, 3, 5] })
    .recurrence_rule === 'weekly' &&
    mapRecurrence({ rule: 'selected_weekdays', weekdays: [1, 3, 5] })
      .recurrence_weekdays.length === 3,
)
assert(
  'map weekdays ISO 1-7 only',
  mapRecurrence({ rule: 'weekly', weekdays: [0, 1, 8, 7] }).recurrence_weekdays
    .join(',') === '1,7',
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
assert('label daily zh', recurrenceLabel({ rule: 'daily' }) === '每日')
assert(
  'label biweekly id',
  recurrenceLabel({ rule: 'biweekly' }, 'id').includes('minggu'),
)
assert(
  'label weekly with days',
  recurrenceLabel({ rule: 'weekly', weekdays: [1, 7] }, 'zh').includes('一'),
)

assert('ISO weekdays 1-7', ISO_WEEKDAYS.join(',') === '1,2,3,4,5,6,7')
assert('weekday zh Sun', WEEKDAY_LABELS.zh[7] === '日')
assert('weekday id Mon', WEEKDAY_LABELS.id[1] === 'Senin')

assert(
  'edit scopes 3',
  EDIT_SCOPES.length === 3 &&
    EDIT_SCOPES.map((s) => s.value).join(',') ===
      'this_only,this_and_future,entire_series',
)
assert(
  'edit scope zh labels',
  EDIT_SCOPES[0].zh.includes('今次') &&
    EDIT_SCOPES[2].zh.includes('整個') &&
    EDIT_SCOPES[1].id.length > 0,
)

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
  { limit: 6, max: 40 },
)
assert('quick add visible max 6', qa.length === 6, `n=${qa.length}`)
assert('quick add fav first', qa[0].id === 'f1')
assert(
  'quick add pool larger',
  buildQuickAddList(
    {
      all: Array.from({ length: 40 }, (_, i) => ({
        id: `x${i}`,
        source: 'system',
        category_key: 'pets',
        sort_order: i,
      })),
    },
    { limit: 20, max: 40 },
  ).length === 20,
)

assert('mapBatchError INVALID_ASSIGNEE', mapBatchError({ message: 'INVALID_ASSIGNEE' }).includes('指派'))
assert('mapBatchError BATCH_LIMIT', mapBatchError({ message: 'BATCH_LIMIT_EXCEEDED' }).includes('20'))
assert('mapBatchError INVALID_SCOPE', mapBatchError({ message: 'INVALID_SCOPE' }).includes('範圍'))
assert('mapBatchError INVALID_RECURRENCE', mapBatchError({ message: 'INVALID_RECURRENCE' }).includes('重複'))
assert('mapBatchError fallback', mapBatchError({ message: 'weird' }) === 'weird')

assert('seed version set', !!CLIENT_SEED_VERSION && CLIENT_SEED_VERSION.includes('2026'))
assert('offline msg bilingual', OFFLINE_PRESET_MSG.zh.includes('離線') && OFFLINE_PRESET_MSG.id.length > 5)
assert('unavail msg bilingual', UNAVAILABLE_PRESET_MSG.zh.includes('無法') && UNAVAILABLE_PRESET_MSG.id.length > 5)
assert(
  'sensitive before save kinds',
  detectSensitiveContent('請打 91234567 同銀行戶口 12345678').kinds.length >= 1,
)


const customPayload = draftToPayload(
  {
    title_zh: '自訂拖地',
    title_id: 'Pel lantai',
    additional_instructions_zh: '門口',
    additional_instructions_id: 'Pintu',
    time: '10:00',
    date: '2026-10-19',
    recurrence_rule: 'none',
    priority: 'urgent',
    assigned_to: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    translation_approved: true,
  },
  null,
  0,
)
assert('custom payload null preset_id', customPayload.preset_id === null)
assert('custom payload adhoc', customPayload.mode === 'adhoc')
assert('custom payload keeps addl', customPayload.additional_instructions_zh === '門口')
assert('custom payload assignee', customPayload.assigned_to?.startsWith('aaaa'))

const schedPayload = draftToPayload(
  {
    title_zh: '每週清潔',
    title_id: 'Bersih mingguan',
    recurrence_rule: 'weekly',
    mode: 'scheduled',
    time: '09:00',
  },
  null,
  1,
)
assert('custom scheduled mode', schedPayload.mode === 'scheduled')
assert('custom scheduled rule', schedPayload.recurrence_rule === 'weekly')
assert('custom scheduled null preset', schedPayload.preset_id === null)

const presetPayload = draftToPayload(
  { title_zh: '覆寫', recurrence_rule: 'none' },
  {
    id: 'p1',
    title_zh: '原',
    title_id: 'Asli',
    suggested_priority: 'normal',
    translation_approved: true,
  },
  0,
)
assert('preset payload keeps id', presetPayload.preset_id === 'p1')

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)

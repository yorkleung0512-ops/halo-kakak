import assert from 'node:assert/strict'
import {
  addMonths,
  buildMonthGrid,
  countsByDate,
  formatYmd,
  monthBounds,
  monthTitle,
  parseYmd,
  weekdayLabels,
} from '../src/lib/calendarMonth.js'

assert.deepEqual(parseYmd('2026-10-26'), { year: 2026, month: 10, day: 26 })
assert.equal(parseYmd('bad'), null)
assert.equal(formatYmd(2026, 3, 5), '2026-03-05')

assert.equal(addMonths('2026-10-01', 1), '2026-11-01')
assert.equal(addMonths('2026-01-15', -1), '2025-12-01')

assert.deepEqual(monthBounds('2026-02-10'), {
  start: '2026-02-01',
  end: '2026-02-28',
})
assert.deepEqual(monthBounds('2024-02-01'), {
  start: '2024-02-01',
  end: '2024-02-29',
})

const oct = buildMonthGrid('2026-10-01')
assert.ok(oct.length % 7 === 0)
assert.ok(oct.length >= 28)
// 2026-10-01 is Thursday → Monday-first leading cells from Sep
assert.equal(oct[0].inMonth, false)
const firstInMonth = oct.find((c) => c.inMonth)
assert.equal(firstInMonth.ymd, '2026-10-01')
assert.equal(firstInMonth.day, 1)
const lastInMonth = [...oct].reverse().find((c) => c.inMonth)
assert.equal(lastInMonth.ymd, '2026-10-31')

assert.deepEqual(weekdayLabels('zh'), ['一', '二', '三', '四', '五', '六', '日'])
assert.deepEqual(weekdayLabels('id'), [
  'Sen',
  'Sel',
  'Rab',
  'Kam',
  'Jum',
  'Sab',
  'Min',
])

assert.equal(monthTitle('2026-10-01', 'zh'), '2026年10月')
assert.match(monthTitle('2026-10-01', 'id'), /2026/)

assert.deepEqual(
  countsByDate([
    { task_date: '2026-10-01' },
    { task_date: '2026-10-01' },
    { task_date: '2026-10-02' },
    { task_date: null },
  ]),
  { '2026-10-01': 2, '2026-10-02': 1 },
)

console.log('calendar-month-unit: all passed')

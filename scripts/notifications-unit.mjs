import assert from 'node:assert/strict'
import {
  formatUnreadBadge,
  notificationCopy,
  deepLinkForNotification,
} from '../src/lib/notificationUtils.js'

assert.equal(formatUnreadBadge(0), null)
assert.equal(formatUnreadBadge(1), '1')
assert.equal(formatUnreadBadge(99), '99')
assert.equal(formatUnreadBadge(100), '99+')
assert.equal(formatUnreadBadge(999), '99+')

const n = {
  id: 'nid',
  title_zh: '新任務',
  title_id: 'Tugas baru',
  body_zh: '洗衫',
  body_id: 'Cuci',
  task_occurrence_id: 'occ-1',
  task_template_id: null,
}
assert.deepEqual(notificationCopy(n, false), { title: '新任務', body: '洗衫' })
assert.deepEqual(notificationCopy(n, true), { title: 'Tugas baru', body: 'Cuci' })
assert.equal(deepLinkForNotification(n), '/?task=occ-1&n=nid')
assert.equal(
  deepLinkForNotification({ id: 'x', task_template_id: 'tpl-1' }),
  '/calendar?template=tpl-1&n=x',
)

console.log('All notification unit tests passed')

import assert from 'node:assert/strict'
import {
  unreadCommentTaskIdsFromSummary,
  unreadCountsByTask,
  otherUsersCommentIds,
  buildMarkCommentsReadMutation,
} from '../src/lib/commentReadUtils.js'
import { needsAttention, classifyPrimary, PRIMARY } from '../src/lib/todayClassify.js'
import { deepLinkForNotification } from '../src/lib/notificationUtils.js'

// Summary → Set
{
  const set = unreadCommentTaskIdsFromSummary([
    { task_occurrence_id: 'a', unread_count: 2 },
    { task_occurrence_id: 'b', unread_count: 0 },
    { task_occurrence_id: 'c', unread_count: 1 },
    { task_occurrence_id: null, unread_count: 5 },
  ])
  assert.equal(set.has('a'), true)
  assert.equal(set.has('b'), false)
  assert.equal(set.has('c'), true)
  assert.equal(set.size, 2)
}

assert.equal(unreadCommentTaskIdsFromSummary(null).size, 0)
assert.equal(unreadCommentTaskIdsFromSummary([]).size, 0)

{
  const map = unreadCountsByTask([
    { task_occurrence_id: 'a', unread_count: 3 },
    { task_occurrence_id: 'b', unread_count: 0 },
  ])
  assert.equal(map.a, 3)
  assert.equal(map.b, 0)
}

// Own comments excluded from mark list
{
  const ids = otherUsersCommentIds(
    [
      { id: 'c1', user_id: 'me' },
      { id: 'c2', user_id: 'other' },
      { id: 'c3', user_id: 'other2' },
    ],
    'me',
  )
  assert.deepEqual(ids, ['c2', 'c3'])
  assert.deepEqual(otherUsersCommentIds([{ id: 'c1', user_id: 'me' }], 'me'), [])
  assert.deepEqual(otherUsersCommentIds([{ id: 'c1', user_id: 'other' }], null), [])
}

// Offline mutation shape
{
  const m = buildMarkCommentsReadMutation('task-1', ['c1', 'c2'], 'hh-1')
  assert.equal(m.type, 'mark_comments_read')
  assert.equal(m.payload.task_occurrence_id, 'task-1')
  assert.deepEqual(m.payload.comment_ids, ['c1', 'c2'])
  assert.equal(m.payload.household_id, 'hh-1')
  const all = buildMarkCommentsReadMutation('task-1', null, 'hh-1')
  assert.equal(all.payload.comment_ids, null)
}

// Classification uses real unread set (not inference)
{
  const task = {
    id: 't1',
    status: 'acknowledged',
    template_id: null,
    due_at: '2026-10-19T10:00:00.000Z',
    assigned_to: 'helper-a',
  }
  const without = {
    now: new Date('2026-10-19T04:00:00.000Z'),
    unreadCommentTaskIds: new Set(),
  }
  assert.equal(needsAttention(task, without), false)
  const withUnread = {
    now: new Date('2026-10-19T04:00:00.000Z'),
    unreadCommentTaskIds: new Set(['t1']),
  }
  assert.equal(needsAttention(task, withUnread), true)
  assert.equal(classifyPrimary(task, withUnread), PRIMARY.NEEDS_ATTENTION)
}

// Deep link keeps notification id and optional comment id separate
{
  const base = deepLinkForNotification({
    id: 'nid',
    task_occurrence_id: 'occ-1',
  })
  assert.equal(base, '/?task=occ-1&n=nid')
  assert.ok(!base.includes('comment='))

  const withComment = deepLinkForNotification({
    id: 'nid',
    task_occurrence_id: 'occ-1',
    metadata: { comment_id: 'cmt-9' },
  })
  assert.equal(withComment, '/?task=occ-1&n=nid&comment=cmt-9')
}

console.log('All comment-reads unit tests passed')

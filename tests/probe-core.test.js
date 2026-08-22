'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const core = require('../probe-core.js')

function makeComment() {
  return {
    id: 'outer-1',
    service: 'twitcasting',
    data: {
      id: 'comment-1',
      liveId: 'live-1',
      userId: 'user-1',
      name: 'name-value',
      displayName: 'display-value',
      screenName: 'screen-value',
      isFirstTime: false,
      isRepeater: true,
      meta: {
        anonymity: 'observed-value',
        unknownNestedField: { keep: 'all-data' },
      },
      isAnonymous: false,
      comment: 'raw comment text',
      unknownTopLevelField: ['keep', 'this'],
    },
  }
}

test('createSnapshot returns a detached copy containing unknown fields', () => {
  const original = makeComment()

  const snapshot = core.createSnapshot(original)
  original.data.meta.unknownNestedField.keep = 'changed'
  original.data.unknownTopLevelField.push('later')

  assert.equal(snapshot.data.meta.unknownNestedField.keep, 'all-data')
  assert.deepEqual(snapshot.data.unknownTopLevelField, ['keep', 'this'])
  assert.notStrictEqual(snapshot, original)
  assert.notStrictEqual(snapshot.data, original.data)
})

test('createSnapshot makes circular, BigInt, undefined, and throwing values JSON-safe', () => {
  const original = {
    amount: 42n,
    missing: undefined,
  }
  original.self = original
  Object.defineProperty(original, 'broken', {
    enumerable: true,
    get() {
      throw new Error('getter failed')
    },
  })

  const snapshot = core.createSnapshot(original)

  assert.equal(snapshot.amount, '[BigInt: 42]')
  assert.equal(snapshot.missing, '[Undefined]')
  assert.equal(snapshot.self, '[Circular]')
  assert.equal(snapshot.broken, '[Unserializable property: getter failed]')
  assert.doesNotThrow(() => JSON.stringify(snapshot))
})

test('createSummary exposes every requested comparison path without interpreting it', () => {
  const summary = core.createSummary(makeComment())

  assert.deepEqual(summary, {
    service: 'twitcasting',
    'comment.id': 'outer-1',
    'comment.data.id': 'comment-1',
    'comment.data.liveId': 'live-1',
    'comment.data.userId': 'user-1',
    'comment.data.name': 'name-value',
    'comment.data.displayName': 'display-value',
    'comment.data.screenName': 'screen-value',
    'comment.data.isFirstTime': false,
    'comment.data.isRepeater': true,
    'comment.data.meta': {
      anonymity: 'observed-value',
      unknownNestedField: { keep: 'all-data' },
    },
    'comment.data.meta.anonymity': 'observed-value',
    'comment.data.isAnonymous': false,
    'comment.data.comment': 'raw comment text',
  })
})

test('createSummary distinguishes missing paths from false and empty values', () => {
  const summary = core.createSummary({
    service: '',
    data: { isAnonymous: false, comment: '' },
  })

  assert.equal(summary.service, '')
  assert.equal(summary['comment.id'], core.MISSING_VALUE)
  assert.equal(summary['comment.data.userId'], core.MISSING_VALUE)
  assert.equal(summary['comment.data.isAnonymous'], false)
  assert.equal(summary['comment.data.comment'], '')
})

test('appendCapped evicts oldest entries and keeps the requested limit', () => {
  const entries = Array.from({ length: 100 }, (_, index) => index)

  core.appendCapped(entries, 100, 100)

  assert.equal(entries.length, 100)
  assert.equal(entries[0], 1)
  assert.equal(entries[99], 100)
})

test('formatJson produces readable JSON even when given a circular value', () => {
  const value = { label: 'root' }
  value.self = value

  const json = core.formatJson(value)

  assert.match(json, /"label": "root"/)
  assert.match(json, /"self": "\[Circular\]"/)
  assert.doesNotThrow(() => JSON.parse(json))
})

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('../plugin/first-comment-big-settings/settings-core.js')

test('既定設定を公開し入力を変更せず完全設定を返す', () => {
  const input = {
    theme: 'dark',
    commentFontSize: 32,
    firstCommentFontSize: 64,
    unknown: 'drop-me',
  }
  const before = structuredClone(input)
  assert.deepEqual(core.normalizeSettings(input), {
    theme: 'dark',
    commentFontSize: 32,
    firstCommentFontSize: 64,
  })
  assert.deepEqual(input, before)
  assert.deepEqual(core.DEFAULT_SETTINGS, {
    theme: 'light',
    commentFontSize: 32,
    firstCommentFontSize: 64,
  })
  assert.equal(Object.isFrozen(core.DEFAULT_SETTINGS), true)
})

test('themeはlightとdarkだけを受理する', () => {
  for (const [value, expected] of [
    ['light', 'light'],
    ['dark', 'dark'],
    ['LIGHT', 'light'],
    ['unknown', 'light'],
    [null, 'light'],
  ]) {
    assert.equal(core.normalizeSettings({ theme: value }).theme, expected)
  }
})

test('通常文字サイズは16から64の有限整数だけを受理する', () => {
  for (const [value, expected] of [
    [16, 16], [32, 32], [64, 64],
    [15, 32], [65, 32], [32.5, 32],
    [NaN, 32], [Infinity, 32], ['32', 32], ['bad', 32],
  ]) {
    assert.equal(core.normalizeSettings({ commentFontSize: value }).commentFontSize, expected)
  }
})

test('初コメ文字サイズは24から128の有限整数だけを受理する', () => {
  for (const [value, expected] of [
    [24, 24], [64, 64], [128, 128],
    [23, 64], [129, 64], [64.5, 64],
    [NaN, 64], [Infinity, 64], ['64', 64], ['bad', 64],
  ]) {
    assert.equal(core.normalizeSettings({ firstCommentFontSize: value }).firstCommentFontSize, expected)
  }
})

test('各項目を独立して正規化し同値性は既知3項目だけで判定する', () => {
  const normalized = core.normalizeSettings({
    theme: 'dark',
    commentFontSize: 100,
    firstCommentFontSize: 24,
  })
  assert.deepEqual(normalized, {
    theme: 'dark',
    commentFontSize: 32,
    firstCommentFontSize: 24,
  })
  assert.equal(core.settingsEqual(normalized, { ...normalized, ignored: true }), true)
  assert.equal(core.settingsEqual(normalized, { ...normalized, theme: 'light' }), false)
  assert.equal(core.settingsEqual(null, normalized), false)
})

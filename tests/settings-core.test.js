'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('../plugin/first-comment-big-settings/settings-core.js')

test('既定設定を公開し入力を変更せず完全設定を返す', () => {
  const input = {
    theme: 'dark',
    fontPreset: 'rounded',
    commentFontSize: 32,
    firstCommentFontSize: 64,
    anonymousFirstCommentBig: true,
    unknown: 'drop-me',
  }
  const before = structuredClone(input)
  assert.deepEqual(core.normalizeSettings(input), {
    theme: 'dark',
    fontPreset: 'rounded',
    commentFontSize: 32,
    firstCommentFontSize: 64,
    anonymousFirstCommentBig: true,
  })
  assert.deepEqual(input, before)
  assert.deepEqual(core.DEFAULT_SETTINGS, {
    theme: 'light',
    fontPreset: 'standard',
    commentFontSize: 32,
    firstCommentFontSize: 64,
    anonymousFirstCommentBig: false,
  })
  assert.equal(Object.isFrozen(core.DEFAULT_SETTINGS), true)
})

test('fontPresetは許可4値だけを受理し不正値をstandardへ戻す', () => {
  for (const [value, expected] of [
    ['standard', 'standard'],
    ['meiryo', 'meiryo'],
    ['biz-ud', 'biz-ud'],
    ['rounded', 'rounded'],
    ['unknown', 'standard'],
    [null, 'standard'],
  ]) {
    assert.equal(core.normalizeSettings({ fontPreset: value }).fontPreset, expected)
  }
})

test('anonymousFirstCommentBigはboolean trueだけを受理する', () => {
  for (const [value, expected] of [
    [true, true], [false, false], [1, false], ['true', false], [null, false],
  ]) {
    assert.equal(
      core.normalizeSettings({ anonymousFirstCommentBig: value }).anonymousFirstCommentBig,
      expected,
    )
  }
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

test('旧3項目設定を補完し同値性は既知5項目で判定する', () => {
  const normalized = core.normalizeSettings({
    theme: 'dark',
    commentFontSize: 100,
    firstCommentFontSize: 24,
  })
  assert.deepEqual(normalized, {
    theme: 'dark',
    fontPreset: 'standard',
    commentFontSize: 32,
    firstCommentFontSize: 24,
    anonymousFirstCommentBig: false,
  })
  assert.equal(core.settingsEqual(normalized, { ...normalized, ignored: true }), true)
  assert.equal(core.settingsEqual(normalized, { ...normalized, theme: 'light' }), false)
  assert.equal(core.settingsEqual(normalized, { ...normalized, fontPreset: 'meiryo' }), false)
  assert.equal(core.settingsEqual(normalized, { ...normalized, anonymousFirstCommentBig: true }), false)
  assert.equal(core.settingsEqual(null, normalized), false)
})

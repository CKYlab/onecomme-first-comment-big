;(function exposeSettingsCore(root, factory) {
  'use strict'
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentBigSettingsCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsCore() {
  'use strict'

  const DEFAULT_SETTINGS = Object.freeze({
    theme: 'light',
    fontPreset: 'standard',
    commentFontSize: 32,
    firstCommentFontSize: 64,
    anonymousFirstCommentBig: false,
  })
  const FONT_PRESETS = Object.freeze(['standard', 'meiryo', 'biz-ud', 'rounded'])

  function validInteger(value, min, max) {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
  }

  function normalizeSettings(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input)
      ? input
      : {}
    return {
      theme: source.theme === 'dark' ? 'dark' : 'light',
      fontPreset: FONT_PRESETS.includes(source.fontPreset)
        ? source.fontPreset
        : 'standard',
      commentFontSize: validInteger(source.commentFontSize, 16, 64)
        ? source.commentFontSize
        : 32,
      firstCommentFontSize: validInteger(source.firstCommentFontSize, 24, 128)
        ? source.firstCommentFontSize
        : 64,
      anonymousFirstCommentBig: source.anonymousFirstCommentBig === true,
    }
  }

  function settingsEqual(a, b) {
    return Boolean(a && b) &&
      a.theme === b.theme &&
      a.fontPreset === b.fontPreset &&
      a.commentFontSize === b.commentFontSize &&
      a.firstCommentFontSize === b.firstCommentFontSize &&
      a.anonymousFirstCommentBig === b.anonymousFirstCommentBig
  }

  return Object.freeze({ DEFAULT_SETTINGS, normalizeSettings, settingsEqual })
})

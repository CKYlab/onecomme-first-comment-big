;(function exposeSettingsCore(root, factory) {
  'use strict'
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentBigSettingsCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsCore() {
  'use strict'

  const DEFAULT_SETTINGS = Object.freeze({
    theme: 'light',
    commentFontSize: 32,
    firstCommentFontSize: 64,
  })

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
      commentFontSize: validInteger(source.commentFontSize, 16, 64)
        ? source.commentFontSize
        : 32,
      firstCommentFontSize: validInteger(source.firstCommentFontSize, 24, 128)
        ? source.firstCommentFontSize
        : 64,
    }
  }

  function settingsEqual(a, b) {
    return Boolean(a && b) &&
      a.theme === b.theme &&
      a.commentFontSize === b.commentFontSize &&
      a.firstCommentFontSize === b.firstCommentFontSize
  }

  return Object.freeze({ DEFAULT_SETTINGS, normalizeSettings, settingsEqual })
})

'use strict'

const {
  DEFAULT_SETTINGS,
  normalizeSettings,
  settingsEqual,
} = require('./settings-core.js')

function isCanonicalSettings(value, normalized) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 5 &&
    Object.hasOwn(value, 'theme') &&
    Object.hasOwn(value, 'fontPreset') &&
    Object.hasOwn(value, 'commentFontSize') &&
    Object.hasOwn(value, 'firstCommentFontSize') &&
    Object.hasOwn(value, 'anonymousFirstCommentBig') &&
    settingsEqual(value, normalized)
}

function persistIfChanged(plugin, next) {
  if (!plugin.store || isCanonicalSettings(plugin.store.store, next)) return false
  plugin.store.store = next
  return true
}

const plugin = {
  name: '初コメBIG 設定',
  uid: 'com.ckylab.first-comment-big-settings',
  version: '1.0.0',
  author: 'CKY Lab',
  url: 'http://localhost:11180/plugins/com.ckylab.first-comment-big-settings/index.html',
  permissions: [],
  defaultState: { ...DEFAULT_SETTINGS },

  init({ store }) {
    this.store = store
    const normalized = normalizeSettings(store.store)
    persistIfChanged(this, normalized)
  },

  async request(req) {
    if (req.method === 'GET') {
      const normalized = normalizeSettings(this.store && this.store.store)
      persistIfChanged(this, normalized)
      return { code: 200, response: normalized }
    }
    if (req.method === 'PUT') {
      let parsed = req.body
      if (typeof req.body === 'string') {
        try {
          parsed = JSON.parse(req.body)
        } catch {
          return { code: 400, response: { message: 'Invalid JSON' } }
        }
      }
      const normalized = normalizeSettings(parsed)
      persistIfChanged(this, normalized)
      return { code: 200, response: normalized }
    }
    return { code: 404, response: { message: 'Not Found' } }
  },
}

module.exports = plugin

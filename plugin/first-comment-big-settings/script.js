;(function exposeSettingsPage(root, factory) {
  'use strict'
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentBigSettingsPage = api

  if (
    root &&
    root.document &&
    typeof root.fetch === 'function' &&
    root.FirstCommentBigSettingsCore
  ) {
    api.startSettingsPage({
      document: root.document,
      fetchImpl: root.fetch.bind(root),
      settingsCore: root.FirstCommentBigSettingsCore,
    })
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsPage() {
  'use strict'

  const DEFAULT_ENDPOINT =
    'http://localhost:11180/api/plugins/com.ckylab.first-comment-big-settings'
  const ELEMENT_IDS = [
    'settings-form',
    'theme',
    'comment-font-size',
    'first-comment-font-size',
    'save',
    'status',
  ]

  function readElements(document) {
    if (!document || typeof document.getElementById !== 'function') return null
    const elements = Object.fromEntries(
      ELEMENT_IDS.map((id) => [id, document.getElementById(id)]),
    )
    return ELEMENT_IDS.every((id) => elements[id]) ? elements : null
  }

  function createSettingsPageController(options) {
    const {
      document,
      fetchImpl,
      settingsCore,
      endpoint = DEFAULT_ENDPOINT,
    } = options || {}
    const elements = readElements(document)
    if (!elements) throw new TypeError('Required settings form elements are missing')
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required')
    if (!settingsCore || typeof settingsCore.normalizeSettings !== 'function') {
      throw new TypeError('settingsCore is required')
    }

    const theme = elements.theme
    const commentFontSize = elements['comment-font-size']
    const firstCommentFontSize = elements['first-comment-font-size']
    const saveButton = elements.save
    const status = elements.status

    function applySettings(value) {
      const normalized = settingsCore.normalizeSettings(value)
      theme.value = normalized.theme
      commentFontSize.value = String(normalized.commentFontSize)
      firstCommentFontSize.value = String(normalized.firstCommentFontSize)
    }

    async function load() {
      try {
        const response = await fetchImpl(endpoint, { method: 'GET' })
        if (!response || !response.ok) throw new Error('GET settings failed')
        applySettings(await response.json())
        status.textContent = ''
      } catch {
        applySettings(settingsCore.DEFAULT_SETTINGS)
        status.textContent = '設定を取得できませんでした。'
      }
    }

    async function save(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      saveButton.disabled = true
      try {
        const settings = settingsCore.normalizeSettings({
          theme: theme.value,
          commentFontSize: commentFontSize.valueAsNumber,
          firstCommentFontSize: firstCommentFontSize.valueAsNumber,
        })
        const response = await fetchImpl(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        })
        if (!response || !response.ok) throw new Error('PUT settings failed')
        applySettings(await response.json())
        status.textContent = '保存しました。'
      } catch {
        status.textContent = '設定を保存できませんでした。'
      } finally {
        saveButton.disabled = false
      }
    }

    return Object.freeze({ load, save })
  }

  function startSettingsPage(options) {
    const elements = readElements(options && options.document)
    if (!elements) return null
    const controller = createSettingsPageController(options)
    elements['settings-form'].addEventListener('submit', controller.save)
    void controller.load()
    return controller
  }

  return Object.freeze({ createSettingsPageController, startSettingsPage })
})

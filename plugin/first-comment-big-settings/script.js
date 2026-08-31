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
    'font-preset',
    'comment-font-size',
    'first-comment-font-size',
    'anonymous-first-comment-big',
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
    const fontPreset = elements['font-preset']
    const commentFontSize = elements['comment-font-size']
    const firstCommentFontSize = elements['first-comment-font-size']
    const anonymousFirstCommentBig = elements['anonymous-first-comment-big']
    const saveButton = elements.save
    const status = elements.status
    let pendingRequestCount = 0
    let saveGeneration = 0

    function beginRequest() {
      pendingRequestCount += 1
      saveButton.disabled = true
    }

    function finishRequest() {
      pendingRequestCount -= 1
      saveButton.disabled = pendingRequestCount > 0
    }

    function applySettings(value) {
      const normalized = settingsCore.normalizeSettings(value)
      theme.value = normalized.theme
      fontPreset.value = normalized.fontPreset
      commentFontSize.value = String(normalized.commentFontSize)
      firstCommentFontSize.value = String(normalized.firstCommentFontSize)
      anonymousFirstCommentBig.checked = normalized.anonymousFirstCommentBig
    }

    async function readResponseSettings(response) {
      if (!response || !response.ok) throw new Error('Settings request failed')
      const payload = await response.json()
      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        payload.code !== 200 ||
        !payload.response ||
        typeof payload.response !== 'object' ||
        Array.isArray(payload.response)
      ) {
        throw new Error('Invalid settings response')
      }
      return payload.response
    }

    async function load() {
      const startingSaveGeneration = saveGeneration
      beginRequest()
      try {
        const response = await fetchImpl(endpoint, { method: 'GET' })
        const responseSettings = await readResponseSettings(response)
        if (startingSaveGeneration !== saveGeneration) return
        applySettings(responseSettings)
        status.textContent = ''
      } catch {
        if (startingSaveGeneration !== saveGeneration) return
        applySettings(settingsCore.DEFAULT_SETTINGS)
        status.textContent = '設定を取得できませんでした。'
      } finally {
        finishRequest()
      }
    }

    async function save(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      saveGeneration += 1
      const currentSaveGeneration = saveGeneration
      beginRequest()
      try {
        const settings = settingsCore.normalizeSettings({
          theme: theme.value,
          fontPreset: fontPreset.value,
          commentFontSize: commentFontSize.valueAsNumber,
          firstCommentFontSize: firstCommentFontSize.valueAsNumber,
          anonymousFirstCommentBig: anonymousFirstCommentBig.checked,
        })
        const response = await fetchImpl(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        })
        const responseSettings = await readResponseSettings(response)
        if (currentSaveGeneration !== saveGeneration) return
        applySettings(responseSettings)
        status.textContent = '保存しました。'
      } catch {
        if (currentSaveGeneration !== saveGeneration) return
        status.textContent = '設定を保存できませんでした。'
      } finally {
        finishRequest()
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

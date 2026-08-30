;(function exposeSettingsClient(root, factory) {
  'use strict'
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentBigSettingsClient = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsClientModule() {
  'use strict'

  const DEFAULT_SETTINGS = Object.freeze({
    theme: 'light',
    commentFontSize: 32,
    firstCommentFontSize: 64,
  })

  const THEME_COLORS = Object.freeze({
    light: Object.freeze({
      panelBackground: '#ffffff',
      commentTextColor: '#000000',
      commentBorderColor: '#d8d8d8',
    }),
    dark: Object.freeze({
      panelBackground: '#0b0b0b',
      commentTextColor: '#ffffff',
      commentBorderColor: '#333333',
    }),
  })

  const DEFAULT_ENDPOINT = 'http://localhost:11180/api/plugins/com.ckylab.first-comment-big-settings'
  const DEFAULT_POLL_INTERVAL_MS = 500

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

  function isSettingsResponse(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  function createSettingsClient(options) {
    const {
      rootElement,
      fitCommentsToViewport,
      fetchImpl = globalThis.fetch.bind(globalThis),
      setIntervalImpl = globalThis.setInterval.bind(globalThis),
      clearIntervalImpl = globalThis.clearInterval.bind(globalThis),
      AbortControllerImpl = globalThis.AbortController,
      warn = globalThis.console.warn.bind(globalThis.console),
      endpoint = DEFAULT_ENDPOINT,
      pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    } = options

    let stopped = false
    let started = false
    let inFlight = false
    let intervalId = null
    let controller = null
    let failureActive = false
    let startPromise = null
    let lastApplied = { ...DEFAULT_SETTINGS }

    function applySettings(next) {
      let changed = false

      if (next.theme !== lastApplied.theme) {
        const colors = THEME_COLORS[next.theme]
        rootElement.style.setProperty('--panel-background', colors.panelBackground)
        rootElement.style.setProperty('--comment-text-color', colors.commentTextColor)
        rootElement.style.setProperty('--comment-border-color', colors.commentBorderColor)
        changed = true
      }
      if (next.commentFontSize !== lastApplied.commentFontSize) {
        rootElement.style.setProperty('--comment-font-size', `${next.commentFontSize}px`)
        changed = true
      }
      if (next.firstCommentFontSize !== lastApplied.firstCommentFontSize) {
        rootElement.style.setProperty('--first-comment-font-size', `${next.firstCommentFontSize}px`)
        changed = true
      }

      if (!changed) return
      lastApplied = { ...next }
      fitCommentsToViewport()
    }

    function handleFailure(error) {
      try {
        applySettings(DEFAULT_SETTINGS)
      } catch {
        // Setting failures must not escape into the OneSDK initialization path.
      }
      if (failureActive) return
      failureActive = true
      try {
        warn('[初コメBIG] 設定を取得できないため既定表示を使用します。', error)
      } catch {
        // A custom logger must not turn a settings failure into an application failure.
      }
    }

    async function pollOnce() {
      if (stopped || inFlight) return
      inFlight = true
      const requestController = new AbortControllerImpl()
      controller = requestController

      try {
        const response = await fetchImpl(endpoint, {
          method: 'GET',
          cache: 'no-store',
          signal: requestController.signal,
        })
        if (stopped || requestController.signal.aborted) return
        if (!response || response.ok !== true) throw new Error('Settings API returned an HTTP error')

        const payload = await response.json()
        if (stopped || requestController.signal.aborted) return
        if (
          !isSettingsResponse(payload) ||
          payload.code !== 200 ||
          !isSettingsResponse(payload.response)
        ) {
          throw new Error('Settings API returned an invalid response')
        }

        applySettings(normalizeSettings(payload.response))
        failureActive = false
      } catch (error) {
        if (stopped || requestController.signal.aborted || (error && error.name === 'AbortError')) return
        handleFailure(error)
      } finally {
        if (controller === requestController) controller = null
        inFlight = false
      }
    }

    function start() {
      if (stopped) return Promise.resolve()
      if (started) return startPromise
      started = true
      intervalId = setIntervalImpl(() => pollOnce(), pollIntervalMs)
      startPromise = pollOnce()
      return startPromise
    }

    function stop() {
      if (stopped) return
      stopped = true
      if (intervalId !== null) {
        clearIntervalImpl(intervalId)
        intervalId = null
      }
      if (controller) controller.abort()
    }

    return Object.freeze({ start, stop })
  }

  return Object.freeze({
    DEFAULT_SETTINGS,
    normalizeSettings,
    settingsEqual,
    createSettingsClient,
  })
})

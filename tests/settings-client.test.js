'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const clientModule = require('../template/first-comment-big/settings-client.js')

const LIVE_TEMPLATE_SCRIPT = fs.readFileSync(
  path.join(__dirname, '../template/first-comment-big/script.js'),
  'utf8',
)

const DEFAULT_SETTINGS = {
  theme: 'light',
  fontPreset: 'standard',
  commentFontSize: 32,
  firstCommentFontSize: 64,
  anonymousFirstCommentBig: false,
}

const FONT_FAMILIES = {
  standard: '"Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
  meiryo: 'Meiryo, "Yu Gothic UI", "Yu Gothic", sans-serif',
  'biz-ud': '"BIZ UDPGothic", "Yu Gothic UI", Meiryo, sans-serif',
  rounded: '"M PLUS Rounded 1c", "BIZ UDPGothic", "Yu Gothic UI", Meiryo, sans-serif',
}

const ROUNDED_FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700&display=swap'

function responseWith(body, { ok = true } = {}) {
  return {
    ok,
    async json() {
      if (body instanceof Error) throw body
      return structuredClone(body)
    },
  }
}

function settingsResponse(settings) {
  return responseWith({ code: 200, response: settings })
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve))
}

function makeLiveTemplateHarness({
  settingsStart,
  settingsStop,
  oneSDKReady,
  oneSDKUnsubscribe,
  containerClientHeight = 0,
  createDisplayModel = () => null,
  normalCommentHeight = 20,
  firstCommentHeight = 60,
} = {}) {
  const pagehideListeners = new Set()
  const warnings = []
  const calls = {
    connect: 0,
    createSettingsClient: [],
    settingsStart: 0,
    settingsStop: 0,
    unsubscribe: 0,
  }
  const rootElement = {}
  const children = []
  const container = {
    children,
    get childElementCount() {
      return children.length
    },
    clientHeight: containerClientHeight,
    get lastElementChild() {
      return children.at(-1) || null
    },
    prepend(element) {
      element.parentElement = container
      children.unshift(element)
    },
    get scrollHeight() {
      return children.reduce((total, element) => total + element.offsetHeight, 0)
    },
    scrollTop: 0,
  }
  function createElement() {
    let className = ''
    const element = {
      parentElement: null,
      style: {},
      textContent: '',
      get className() {
        return className
      },
      set className(value) {
        className = value
      },
      classList: {
        add(...names) {
          const classes = new Set(className.split(/\s+/u).filter(Boolean))
          for (const name of names) classes.add(name)
          className = Array.from(classes).join(' ')
        },
        contains(name) {
          return className.split(/\s+/u).includes(name)
        },
      },
      get offsetHeight() {
        return element.classList.contains('comment--first')
          ? firstCommentHeight
          : normalCommentHeight
      },
      addEventListener() {},
      append() {},
      remove() {
        if (!element.parentElement) return
        const index = element.parentElement.children.indexOf(element)
        if (index >= 0) element.parentElement.children.splice(index, 1)
        element.parentElement = null
      },
    }
    return element
  }
  const document = {
    body: { removeAttribute() {} },
    documentElement: rootElement,
    createElement,
    createTextNode(value) {
      return { textContent: value }
    },
    getElementById(id) {
      return id === 'comments' ? container : null
    },
  }
  let commentsCallback = null
  const window = {
    FirstCommentBigCore: {
      createAnonymousHistory() {
        return {}
      },
      createDisplayModel(comment, history, options) {
        return createDisplayModel(comment, history, options)
      },
      decodeHtmlEntitiesOnce(value) {
        return value
      },
    },
    FirstCommentGiftPresentation: { createGiftPresentation() { return null } },
    FirstCommentKickGiftPresentation: { createKickGiftPresentation() { return null } },
    FirstCommentKickEmotePresentation: {
      buildKickEmoteUrl() { return null },
      createKickPresentation() { return null },
    },
    FirstCommentBigSettingsClient: {
      DEFAULT_SETTINGS,
      createSettingsClient(options) {
        calls.createSettingsClient.push(options)
        return {
          start() {
            calls.settingsStart += 1
            return settingsStart ? settingsStart() : Promise.resolve()
          },
          stop() {
            calls.settingsStop += 1
            if (settingsStop) return settingsStop()
          },
        }
      },
    },
    OneSDK: {
      ready() {
        return oneSDKReady ? oneSDKReady() : Promise.resolve()
      },
      async setup() {},
      subscribe({ callback }) {
        commentsCallback = callback
        return 'subscriber-id'
      },
      async connect() {
        calls.connect += 1
      },
      unsubscribe() {
        calls.unsubscribe += 1
        if (oneSDKUnsubscribe) return oneSDKUnsubscribe()
      },
    },
    addEventListener(type, listener) {
      if (type === 'pagehide') pagehideListeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'pagehide') pagehideListeners.delete(listener)
    },
  }
  const context = vm.createContext({
    Promise,
    console: { error() {}, warn(...args) { warnings.push(args) } },
    document,
    window,
  })

  return {
    calls,
    container,
    rootElement,
    warnings,
    emitComments(comments) {
      if (!commentsCallback) throw new Error('comments subscription is not ready')
      commentsCallback(comments)
    },
    emitPagehide() {
      for (const listener of pagehideListeners) listener()
    },
    run() {
      vm.runInContext(LIVE_TEMPLATE_SCRIPT, context)
    },
  }
}

function makeHarness(queue = [], { onSettingsChanged } = {}) {
  const styleCalls = []
  const events = []
  const fetchCalls = []
  const warnings = []
  const intervals = []
  const cleared = []
  const controllers = []
  let fitCalls = 0
  const documentElements = new Map()
  const fontLinks = []

  const ownerDocument = {
    head: {
      append(element) {
        fontLinks.push(element)
        if (element.id) documentElements.set(element.id, element)
      },
    },
    createElement(tagName) {
      const listeners = new Map()
      return {
        tagName: String(tagName).toUpperCase(),
        addEventListener(type, listener) {
          const callbacks = listeners.get(type) || []
          callbacks.push(listener)
          listeners.set(type, callbacks)
        },
        dispatchEvent(event) {
          for (const listener of listeners.get(event.type) || []) listener.call(this, event)
          return true
        },
      }
    },
    getElementById(id) {
      return documentElements.get(id) || null
    },
  }

  class FakeAbortController {
    constructor() {
      this.signal = { aborted: false }
      this.abortCalls = 0
      controllers.push(this)
    }

    abort() {
      this.abortCalls += 1
      this.signal.aborted = true
    }
  }

  const rootElement = {
    ownerDocument,
    style: {
      setProperty(name, value) {
        styleCalls.push([name, value])
        events.push(['set', name, value])
      },
    },
  }

  async function fetchImpl(url, options) {
    fetchCalls.push({ url, options })
    if (queue.length === 0) throw new Error('unexpected fetch')
    const next = queue.shift()
    if (typeof next === 'function') return next(url, options)
    if (next instanceof Error) throw next
    return next
  }

  function setIntervalImpl(callback, milliseconds) {
    const id = { callback, milliseconds }
    intervals.push(id)
    return id
  }

  function clearIntervalImpl(id) {
    cleared.push(id)
  }

  const client = clientModule.createSettingsClient({
    rootElement,
    fitCommentsToViewport() {
      fitCalls += 1
      events.push(['fit'])
    },
    fetchImpl,
    setIntervalImpl,
    clearIntervalImpl,
    AbortControllerImpl: FakeAbortController,
    warn(...args) {
      warnings.push(args)
    },
    onSettingsChanged,
  })

  return {
    client,
    styleCalls,
    events,
    fetchCalls,
    warnings,
    intervals,
    cleared,
    controllers,
    fontLinks,
    fitCalls: () => fitCalls,
    tick: () => intervals[0].callback(),
  }
}

test('既定値と正規化規則をプラグインcoreへ依存せず公開する', () => {
  assert.deepEqual(clientModule.DEFAULT_SETTINGS, DEFAULT_SETTINGS)
  assert.equal(Object.isFrozen(clientModule.DEFAULT_SETTINGS), true)

  for (const [value, expected] of [
    ['light', 'light'],
    ['dark', 'dark'],
    ['LIGHT', 'light'],
    ['unknown', 'light'],
    [null, 'light'],
  ]) {
    assert.equal(clientModule.normalizeSettings({ theme: value }).theme, expected)
  }

  for (const [value, expected] of [
    ['standard', 'standard'],
    ['meiryo', 'meiryo'],
    ['biz-ud', 'biz-ud'],
    ['rounded', 'rounded'],
    ['unknown', 'standard'],
    [null, 'standard'],
  ]) {
    assert.equal(clientModule.normalizeSettings({ fontPreset: value }).fontPreset, expected)
  }

  assert.equal(
    clientModule.normalizeSettings({ anonymousFirstCommentBig: true }).anonymousFirstCommentBig,
    true,
  )
  for (const value of [false, 1, 'true', null, undefined]) {
    assert.equal(
      clientModule.normalizeSettings({ anonymousFirstCommentBig: value }).anonymousFirstCommentBig,
      false,
    )
  }

  for (const [value, expected] of [
    [16, 16], [32, 32], [64, 64],
    [15, 32], [65, 32], [32.5, 32],
    [NaN, 32], [Infinity, 32], ['32', 32], ['bad', 32],
  ]) {
    assert.equal(clientModule.normalizeSettings({ commentFontSize: value }).commentFontSize, expected)
  }

  for (const [value, expected] of [
    [24, 24], [64, 64], [128, 128],
    [23, 64], [129, 64], [64.5, 64],
    [NaN, 64], [Infinity, 64], ['64', 64], ['bad', 64],
  ]) {
    assert.equal(clientModule.normalizeSettings({ firstCommentFontSize: value }).firstCommentFontSize, expected)
  }

  assert.deepEqual(clientModule.normalizeSettings(null), DEFAULT_SETTINGS)
  assert.deepEqual(clientModule.normalizeSettings([]), DEFAULT_SETTINGS)
  assert.equal(clientModule.settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, ignored: true }), true)
  assert.equal(clientModule.settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, theme: 'dark' }), false)
  assert.equal(clientModule.settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, fontPreset: 'meiryo' }), false)
  assert.equal(clientModule.settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, anonymousFirstCommentBig: true }), false)
  assert.equal(clientModule.settingsEqual(null, DEFAULT_SETTINGS), false)
})

test('fontPreset変更はfont変数とfitを一度だけ更新し同値再取得はno-opにする', async () => {
  const rounded = { ...DEFAULT_SETTINGS, fontPreset: 'rounded' }
  const harness = makeHarness([
    settingsResponse(rounded),
    settingsResponse(rounded),
    settingsResponse({ ...rounded, fontPreset: 'meiryo' }),
  ])

  await harness.client.start()
  assert.deepEqual(harness.styleCalls, [
    ['--comment-font-family', FONT_FAMILIES.rounded],
  ])
  assert.equal(harness.fitCalls(), 1)

  await harness.tick()
  assert.equal(harness.styleCalls.length, 1)
  assert.equal(harness.fitCalls(), 1)

  await harness.tick()
  assert.deepEqual(harness.styleCalls.at(-1), [
    '--comment-font-family',
    FONT_FAMILIES.meiryo,
  ])
  assert.equal(harness.fitCalls(), 2)
})

test('roundedだけがweight 700のGoogle Fonts stylesheetを1個追加する', async () => {
  for (const fontPreset of ['standard', 'meiryo', 'biz-ud']) {
    const localHarness = makeHarness([
      settingsResponse({ ...DEFAULT_SETTINGS, fontPreset }),
    ])
    await localHarness.client.start()
    assert.deepEqual(localHarness.fontLinks, [], fontPreset)
  }

  const roundedHarness = makeHarness([
    settingsResponse({ ...DEFAULT_SETTINGS, fontPreset: 'rounded' }),
  ])
  await roundedHarness.client.start()

  assert.equal(roundedHarness.fontLinks.length, 1)
  assert.equal(roundedHarness.fontLinks[0].id, 'first-comment-big-rounded-font')
  assert.equal(roundedHarness.fontLinks[0].rel, 'stylesheet')
  assert.equal(roundedHarness.fontLinks[0].href, ROUNDED_FONT_STYLESHEET_URL)
  assert.deepEqual(roundedHarness.styleCalls, [
    ['--comment-font-family', FONT_FAMILIES.rounded],
  ])
  assert.equal(roundedHarness.fitCalls(), 1)
})

test('roundedの同値pollとrounded→standard→roundedでstylesheetを重複追加しない', async () => {
  const rounded = { ...DEFAULT_SETTINGS, fontPreset: 'rounded' }
  const harness = makeHarness([
    settingsResponse(rounded),
    settingsResponse(rounded),
    settingsResponse(DEFAULT_SETTINGS),
    settingsResponse(rounded),
  ])

  await harness.client.start()
  await harness.tick()
  await harness.tick()
  await harness.tick()

  assert.equal(harness.fontLinks.length, 1)
  assert.equal(harness.fitCalls(), 3)
})

test('rounded stylesheetのerror後もpollをrejectせず後続設定を適用する', async () => {
  const harness = makeHarness([
    settingsResponse({ ...DEFAULT_SETTINGS, fontPreset: 'rounded' }),
    settingsResponse({ ...DEFAULT_SETTINGS, fontPreset: 'meiryo' }),
  ])

  await assert.doesNotReject(harness.client.start())
  assert.equal(harness.fontLinks.length, 1)
  assert.doesNotThrow(() => harness.fontLinks[0].dispatchEvent({ type: 'error' }))
  await assert.doesNotReject(harness.tick())

  assert.equal(harness.fetchCalls.length, 2)
  assert.deepEqual(harness.styleCalls.at(-1), [
    '--comment-font-family',
    FONT_FAMILIES.meiryo,
  ])
  assert.equal(harness.fitCalls(), 2)
})

test('匿名設定だけの変更はCSSとfitを更新せず完全設定をcallbackへ渡す', async () => {
  const received = []
  const enabled = { ...DEFAULT_SETTINGS, anonymousFirstCommentBig: true }
  const harness = makeHarness(
    [settingsResponse(enabled), settingsResponse(enabled)],
    { onSettingsChanged(settings) { received.push(settings) } },
  )

  await harness.client.start()
  assert.deepEqual(harness.styleCalls, [])
  assert.deepEqual(harness.fontLinks, [])
  assert.equal(harness.fitCalls(), 0)
  assert.deepEqual(received, [enabled])
  assert.notEqual(received[0], enabled)

  await harness.tick()
  assert.deepEqual(received, [enabled])
  assert.deepEqual(harness.styleCalls, [])
  assert.equal(harness.fitCalls(), 0)
})

test('設定callback例外をpollから漏らさず後続pollを継続する', async () => {
  let callbackCalls = 0
  const harness = makeHarness(
    [
      settingsResponse({ ...DEFAULT_SETTINGS, anonymousFirstCommentBig: true }),
      settingsResponse({ ...DEFAULT_SETTINGS, fontPreset: 'biz-ud' }),
    ],
    {
      onSettingsChanged() {
        callbackCalls += 1
        throw new Error('callback failure')
      },
    },
  )

  await assert.doesNotReject(harness.client.start())
  await assert.doesNotReject(harness.tick())
  assert.equal(callbackCalls, 2)
  assert.deepEqual(harness.styleCalls, [
    ['--comment-font-family', FONT_FAMILIES['biz-ud']],
  ])
  assert.equal(harness.fitCalls(), 1)
})

test('既定応答はCSSとfitを再適用しない', async () => {
  const harness = makeHarness([settingsResponse(DEFAULT_SETTINGS)])

  await harness.client.start()

  assert.deepEqual(harness.styleCalls, [])
  assert.equal(harness.fitCalls(), 0)
})

test('変更された設定に対応するCSS変数だけを更新し各応答の最後にfitを一度呼ぶ', async () => {
  const dark = { theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }
  const comment44 = { ...dark, commentFontSize: 44 }
  const first84 = { ...comment44, firstCommentFontSize: 84 }
  const light = { ...first84, theme: 'light' }
  const harness = makeHarness([
    settingsResponse(dark),
    settingsResponse(dark),
    settingsResponse(comment44),
    settingsResponse(first84),
    settingsResponse(light),
  ])

  await harness.client.start()
  assert.deepEqual(harness.styleCalls, [
    ['--panel-background', '#0b0b0b'],
    ['--comment-text-color', '#ffffff'],
    ['--comment-border-color', '#333333'],
    ['--gift-neutral-background', '#222222'],
    ['--gift-neutral-text-color', '#ffffff'],
    ['--comment-font-size', '40px'],
    ['--first-comment-font-size', '80px'],
  ])
  assert.equal(harness.fitCalls(), 1)

  const callsBeforeSameValue = harness.styleCalls.length
  await harness.tick()
  assert.equal(harness.styleCalls.length, callsBeforeSameValue)
  assert.equal(harness.fitCalls(), 1)

  await harness.tick()
  assert.deepEqual(harness.styleCalls.at(-1), ['--comment-font-size', '44px'])
  assert.equal(harness.fitCalls(), 2)

  await harness.tick()
  assert.deepEqual(harness.styleCalls.at(-1), ['--first-comment-font-size', '84px'])
  assert.equal(harness.fitCalls(), 3)

  const eventOffset = harness.events.length
  await harness.tick()
  assert.deepEqual(harness.events.slice(eventOffset), [
    ['set', '--panel-background', '#ffffff'],
    ['set', '--comment-text-color', '#000000'],
    ['set', '--comment-border-color', '#d8d8d8'],
    ['set', '--gift-neutral-background', '#ffffff'],
    ['set', '--gift-neutral-text-color', '#000000'],
    ['fit'],
  ])
  assert.equal(harness.fitCalls(), 4)
})

test('startは公式endpointへ即時GETし500msタイマーとno-storeとAbort signalを使う', async () => {
  const harness = makeHarness([settingsResponse(DEFAULT_SETTINGS)])

  await harness.client.start()

  assert.equal(harness.intervals.length, 1)
  assert.equal(harness.intervals[0].milliseconds, 500)
  assert.equal(harness.fetchCalls.length, 1)
  assert.equal(
    harness.fetchCalls[0].url,
    'http://localhost:11180/api/plugins/com.ckylab.first-comment-big-settings',
  )
  assert.deepEqual({
    method: harness.fetchCalls[0].options.method,
    cache: harness.fetchCalls[0].options.cache,
  }, { method: 'GET', cache: 'no-store' })
  assert.equal(harness.fetchCalls[0].options.signal, harness.controllers[0].signal)
})

test('endpointと間隔を注入でき、開始を重ねてもタイマーと即時GETを増やさない', async () => {
  const pending = deferred()
  const harness = makeHarness([() => pending.promise])
  const customClient = clientModule.createSettingsClient({
    rootElement: { style: { setProperty() {} } },
    fitCommentsToViewport() {},
    fetchImpl: async (url, options) => {
      harness.fetchCalls.push({ url, options })
      return pending.promise
    },
    setIntervalImpl: (callback, milliseconds) => {
      const id = { callback, milliseconds }
      harness.intervals.push(id)
      return id
    },
    clearIntervalImpl() {},
    AbortControllerImpl: AbortController,
    warn() {},
    endpoint: 'http://localhost/custom',
    pollIntervalMs: 750,
  })

  const firstStart = customClient.start()
  const secondStart = customClient.start()
  assert.equal(harness.fetchCalls.length, 1)
  assert.equal(harness.intervals.length, 1)
  assert.equal(harness.intervals[0].milliseconds, 750)
  assert.equal(harness.fetchCalls[0].url, 'http://localhost/custom')

  pending.resolve(settingsResponse(DEFAULT_SETTINGS))
  await Promise.all([firstStart, secondStart])
})

test('GET中のtickをスキップし完了後のtickでは次のGETを開始する', async () => {
  const pending = deferred()
  const harness = makeHarness([
    () => pending.promise,
    settingsResponse(DEFAULT_SETTINGS),
  ])

  const starting = harness.client.start()
  await harness.tick()
  assert.equal(harness.fetchCalls.length, 1)

  pending.resolve(settingsResponse(DEFAULT_SETTINGS))
  await starting
  await harness.tick()
  assert.equal(harness.fetchCalls.length, 2)
})

test('HTTP・fetch・JSON・応答構造の失敗は既定値へ戻りPromiseをrejectしない', async () => {
  const failureFactories = [
    () => responseWith(null, { ok: false }),
    () => new Error('network unavailable'),
    () => responseWith(new Error('invalid json')),
    () => responseWith(null),
    () => responseWith([]),
    () => responseWith({ code: 400, response: { message: 'error' } }),
    () => responseWith({ code: 200 }),
    () => responseWith({ code: 200, response: null }),
    () => responseWith({ code: 200, response: [] }),
  ]

  for (const makeFailure of failureFactories) {
    const failure = makeFailure()
    const harness = makeHarness([
      settingsResponse({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }),
      failure,
    ])
    await assert.doesNotReject(harness.client.start())
    await assert.doesNotReject(harness.tick())

    assert.deepEqual(harness.styleCalls.slice(-7), [
      ['--panel-background', '#ffffff'],
      ['--comment-text-color', '#000000'],
      ['--comment-border-color', '#d8d8d8'],
      ['--gift-neutral-background', '#ffffff'],
      ['--gift-neutral-text-color', '#000000'],
      ['--comment-font-size', '32px'],
      ['--first-comment-font-size', '64px'],
    ])
    assert.equal(harness.fitCalls(), 2)
    assert.equal(harness.warnings.length, 1)
  }
})

test('妥当なenvelopeのresponse内にある不正項目だけを既定値へ正規化する', async () => {
  const harness = makeHarness([
    settingsResponse({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }),
    settingsResponse({ theme: 'dark', commentFontSize: '48', firstCommentFontSize: 96 }),
  ])

  await harness.client.start()
  const callOffset = harness.styleCalls.length
  await harness.tick()

  assert.deepEqual(harness.styleCalls.slice(callOffset), [
    ['--comment-font-size', '32px'],
    ['--first-comment-font-size', '96px'],
  ])
  assert.equal(harness.warnings.length, 0)
})

test('同じ失敗期間は一度だけ警告し正常復帰後の再失敗で再度警告する', async () => {
  const harness = makeHarness([
    new Error('offline 1'),
    new Error('offline 2'),
    settingsResponse({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }),
    new Error('offline again'),
  ])

  await assert.doesNotReject(harness.client.start())
  await assert.doesNotReject(harness.tick())
  assert.equal(harness.warnings.length, 1)

  await harness.tick()
  await assert.doesNotReject(harness.tick())
  assert.equal(harness.warnings.length, 2)
})

test('stopはタイマーを一度だけ解除し進行中GETを一度だけabortする', async () => {
  const pending = deferred()
  const harness = makeHarness([() => pending.promise])
  const starting = harness.client.start()

  harness.client.stop()
  harness.client.stop()

  assert.deepEqual(harness.cleared, [harness.intervals[0]])
  assert.equal(harness.controllers[0].abortCalls, 1)
  assert.equal(harness.controllers[0].signal.aborted, true)

  pending.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
  await assert.doesNotReject(starting)
  assert.equal(harness.warnings.length, 0)
})

test('stop後に遅延応答が完了してもCSS・fit・警告を発生させない', async () => {
  const pending = deferred()
  const harness = makeHarness([() => pending.promise])
  const starting = harness.client.start()

  harness.client.stop()
  pending.resolve(settingsResponse({
    theme: 'dark',
    commentFontSize: 40,
    firstCommentFontSize: 80,
  }))
  await assert.doesNotReject(starting)

  assert.deepEqual(harness.styleCalls, [])
  assert.equal(harness.fitCalls(), 0)
  assert.equal(harness.warnings.length, 0)
  assert.equal(harness.fetchCalls.length, 1)
  await harness.tick()
  assert.equal(harness.fetchCalls.length, 1)
})

test('開始前のstopと重複stopは例外にせず、その後startしても通信を開始しない', async () => {
  const harness = makeHarness([])

  assert.doesNotThrow(() => harness.client.stop())
  assert.doesNotThrow(() => harness.client.stop())
  await assert.doesNotReject(harness.client.start())

  assert.equal(harness.intervals.length, 0)
  assert.equal(harness.fetchCalls.length, 0)
  assert.deepEqual(harness.cleared, [])
})

test('ライブテンプレートはOneSDKの初期化を待たず設定クライアントへ表示要素とfit関数を渡して開始する', async () => {
  const ready = deferred()
  const harness = makeLiveTemplateHarness({
    oneSDKReady() {
      return ready.promise
    },
  })
  harness.run()

  assert.equal(harness.calls.createSettingsClient.length, 1)
  assert.equal(harness.calls.settingsStart, 1)
  assert.deepEqual(
    Object.keys(harness.calls.createSettingsClient[0]).sort(),
    ['fitCommentsToViewport', 'onSettingsChanged', 'rootElement'],
  )
  assert.equal(harness.calls.createSettingsClient[0].rootElement, harness.rootElement)
  assert.equal(typeof harness.calls.createSettingsClient[0].fitCommentsToViewport, 'function')
  assert.equal(typeof harness.calls.createSettingsClient[0].onSettingsChanged, 'function')
  assert.equal(harness.calls.connect, 0)

  ready.resolve()
  await flushAsyncWork()
  await flushAsyncWork()
  assert.equal(harness.calls.connect, 1)
})

test('ライブテンプレートは匿名BIG設定の現在値だけを判定optionsへ渡す', async () => {
  const receivedOptions = []
  const harness = makeLiveTemplateHarness({
    createDisplayModel(comment, history, options) {
      receivedOptions.push({ ...options })
      return { text: comment.text, isFirstComment: false, isOwner: false }
    },
  })

  harness.run()
  await flushAsyncWork()
  await flushAsyncWork()
  harness.emitComments([{ text: 'OFF' }])
  harness.calls.createSettingsClient[0].onSettingsChanged({
    ...DEFAULT_SETTINGS,
    anonymousFirstCommentBig: true,
  })
  harness.emitComments([{ text: 'ON' }])

  assert.deepEqual(receivedOptions, [
    { anonymousFirstCommentBig: false },
    { anonymousFirstCommentBig: true },
  ])
})

test('BIGが下端を通過しても過去コメントを失わず表示領域を埋められる', async () => {
  const harness = makeLiveTemplateHarness({
    containerClientHeight: 100,
    createDisplayModel(comment) {
      return {
        text: comment.text,
        isFirstComment: comment.isFirstComment,
        isOwner: false,
      }
    },
  })
  const normal = (text) => ({ text, isFirstComment: false })

  harness.run()
  await flushAsyncWork()
  await flushAsyncWork()

  harness.emitComments(Array.from({ length: 5 }, (_, index) => normal(`normal-${index + 1}`)))
  assert.equal(harness.container.scrollHeight, 100)

  harness.emitComments([{ text: 'BIG', isFirstComment: true }])
  const countAfterBig = harness.container.childElementCount
  harness.emitComments([normal('after-1'), normal('after-2'), normal('after-3')])

  assert.deepEqual({
    countAfterBig,
    finalCount: harness.container.childElementCount,
    finalHeight: harness.container.scrollHeight,
    order: harness.container.children.map((element) => element.textContent),
  }, {
    countAfterBig: 6,
    finalCount: 9,
    finalHeight: 220,
    order: [
      'after-3',
      'after-2',
      'after-1',
      'BIG',
      'normal-5',
      'normal-4',
      'normal-3',
      'normal-2',
      'normal-1',
    ],
  })
})

test('新着順を維持してDOMを最大100件に制限する', async () => {
  const harness = makeLiveTemplateHarness({
    containerClientHeight: 2000,
    createDisplayModel(comment) {
      return { text: comment.text, isFirstComment: false, isOwner: false }
    },
  })

  harness.run()
  await flushAsyncWork()
  await flushAsyncWork()
  harness.emitComments(Array.from({ length: 101 }, (_, index) => ({
    text: `normal-${index + 1}`,
  })))

  assert.equal(harness.container.childElementCount, 100)
  assert.equal(harness.container.children[0].textContent, 'normal-101')
  assert.equal(harness.container.lastElementChild.textContent, 'normal-2')
})

test('表示領域より高いコメントが1件だけでも削除しない', async () => {
  const harness = makeLiveTemplateHarness({
    containerClientHeight: 100,
    firstCommentHeight: 120,
    createDisplayModel(comment) {
      return { text: comment.text, isFirstComment: true, isOwner: false }
    },
  })

  harness.run()
  await flushAsyncWork()
  await flushAsyncWork()
  harness.emitComments([{ text: 'giant BIG' }])

  assert.equal(harness.container.childElementCount, 1)
  assert.equal(harness.container.scrollHeight, 120)
})

test('ライブテンプレートは予期しない設定開始のrejectを警告へ収容しOneSDK接続を継続する', async () => {
  const unexpectedFailure = new Error('unexpected settings start failure')
  const harness = makeLiveTemplateHarness({
    settingsStart() {
      return Promise.reject(unexpectedFailure)
    },
  })
  const unhandledRejections = []
  const onUnhandledRejection = (error) => {
    if (error === unexpectedFailure) unhandledRejections.push(error)
  }
  process.on('unhandledRejection', onUnhandledRejection)

  try {
    harness.run()
    await flushAsyncWork()
    await flushAsyncWork()

    assert.equal(harness.calls.connect, 1)
    assert.equal(harness.warnings.length, 1)
    assert.equal(harness.warnings[0][1], unexpectedFailure)
    assert.deepEqual(unhandledRejections, [])
  } finally {
    process.off('unhandledRejection', onUnhandledRejection)
  }
})

test('ライブテンプレートは設定停止とOneSDK購読解除をpagehideで互いの失敗から隔離する', async () => {
  for (const { settingsStop, oneSDKUnsubscribe } of [
    { settingsStop() { throw new Error('settings stop failure') } },
    { oneSDKUnsubscribe() { throw new Error('unsubscribe failure') } },
  ]) {
    const harness = makeLiveTemplateHarness({ settingsStop, oneSDKUnsubscribe })
    harness.run()
    await flushAsyncWork()

    harness.emitPagehide()

    assert.equal(harness.calls.settingsStop, 1)
    assert.equal(harness.calls.unsubscribe, 1)
  }
})

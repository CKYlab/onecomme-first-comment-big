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
  commentFontSize: 32,
  firstCommentFontSize: 64,
}

function responseWith(body, { ok = true } = {}) {
  return {
    ok,
    async json() {
      if (body instanceof Error) throw body
      return structuredClone(body)
    },
  }
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
  const container = {
    childElementCount: 0,
    clientHeight: 0,
    lastElementChild: null,
    prepend() {},
    scrollHeight: 0,
    scrollTop: 0,
  }
  const document = {
    body: { removeAttribute() {} },
    documentElement: rootElement,
    getElementById(id) {
      return id === 'comments' ? container : null
    },
  }
  const window = {
    FirstCommentBigCore: {
      createAnonymousHistory() {
        return {}
      },
      createDisplayModel() {
        return null
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
      subscribe() {
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
    rootElement,
    warnings,
    emitPagehide() {
      for (const listener of pagehideListeners) listener()
    },
    run() {
      vm.runInContext(LIVE_TEMPLATE_SCRIPT, context)
    },
  }
}

function makeHarness(queue = []) {
  const styleCalls = []
  const events = []
  const fetchCalls = []
  const warnings = []
  const intervals = []
  const cleared = []
  const controllers = []
  let fitCalls = 0

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
  assert.equal(clientModule.settingsEqual(null, DEFAULT_SETTINGS), false)
})

test('既定応答はCSSとfitを再適用しない', async () => {
  const harness = makeHarness([responseWith(DEFAULT_SETTINGS)])

  await harness.client.start()

  assert.deepEqual(harness.styleCalls, [])
  assert.equal(harness.fitCalls(), 0)
})

test('変更された設定に対応するCSS変数だけを更新し各応答の最後にfitを一度呼ぶ', async () => {
  const dark = { theme: 'dark', commentFontSize: 32, firstCommentFontSize: 64 }
  const comment40 = { ...dark, commentFontSize: 40 }
  const first80 = { ...comment40, firstCommentFontSize: 80 }
  const allChanged = { theme: 'light', commentFontSize: 44, firstCommentFontSize: 84 }
  const harness = makeHarness([
    responseWith(dark),
    responseWith(comment40),
    responseWith(first80),
    responseWith(first80),
    responseWith(allChanged),
  ])

  await harness.client.start()
  assert.deepEqual(harness.styleCalls, [
    ['--panel-background', '#0b0b0b'],
    ['--comment-text-color', '#ffffff'],
    ['--comment-border-color', '#333333'],
  ])
  assert.equal(harness.fitCalls(), 1)

  await harness.tick()
  assert.deepEqual(harness.styleCalls.at(-1), ['--comment-font-size', '40px'])
  assert.equal(harness.fitCalls(), 2)

  await harness.tick()
  assert.deepEqual(harness.styleCalls.at(-1), ['--first-comment-font-size', '80px'])
  assert.equal(harness.fitCalls(), 3)

  const callsBeforeSameValue = harness.styleCalls.length
  await harness.tick()
  assert.equal(harness.styleCalls.length, callsBeforeSameValue)
  assert.equal(harness.fitCalls(), 3)

  const eventOffset = harness.events.length
  await harness.tick()
  assert.deepEqual(harness.events.slice(eventOffset), [
    ['set', '--panel-background', '#ffffff'],
    ['set', '--comment-text-color', '#000000'],
    ['set', '--comment-border-color', '#d8d8d8'],
    ['set', '--comment-font-size', '44px'],
    ['set', '--first-comment-font-size', '84px'],
    ['fit'],
  ])
  assert.equal(harness.fitCalls(), 4)
})

test('startは公式endpointへ即時GETし500msタイマーとno-storeとAbort signalを使う', async () => {
  const harness = makeHarness([responseWith(DEFAULT_SETTINGS)])

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

  pending.resolve(responseWith(DEFAULT_SETTINGS))
  await Promise.all([firstStart, secondStart])
})

test('GET中のtickをスキップし完了後のtickでは次のGETを開始する', async () => {
  const pending = deferred()
  const harness = makeHarness([
    () => pending.promise,
    responseWith(DEFAULT_SETTINGS),
  ])

  const starting = harness.client.start()
  await harness.tick()
  assert.equal(harness.fetchCalls.length, 1)

  pending.resolve(responseWith(DEFAULT_SETTINGS))
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
  ]

  for (const makeFailure of failureFactories) {
    const failure = makeFailure()
    const harness = makeHarness([
      responseWith({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }),
      failure,
    ])
    await assert.doesNotReject(harness.client.start())
    await assert.doesNotReject(harness.tick())

    assert.deepEqual(harness.styleCalls.slice(-5), [
      ['--panel-background', '#ffffff'],
      ['--comment-text-color', '#000000'],
      ['--comment-border-color', '#d8d8d8'],
      ['--comment-font-size', '32px'],
      ['--first-comment-font-size', '64px'],
    ])
    assert.equal(harness.fitCalls(), 2)
    assert.equal(harness.warnings.length, 1)
  }
})

test('妥当な応答objectの不正項目だけを既定値へ正規化する', async () => {
  const harness = makeHarness([
    responseWith({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }),
    responseWith({ theme: 'dark', commentFontSize: '48', firstCommentFontSize: 96 }),
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
    responseWith({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }),
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
  pending.resolve(responseWith({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }))
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
    ['fitCommentsToViewport', 'rootElement'],
  )
  assert.equal(harness.calls.createSettingsClient[0].rootElement, harness.rootElement)
  assert.equal(typeof harness.calls.createSettingsClient[0].fitCommentsToViewport, 'function')
  assert.equal(harness.calls.connect, 0)

  ready.resolve()
  await flushAsyncWork()
  await flushAsyncWork()
  assert.equal(harness.calls.connect, 1)
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

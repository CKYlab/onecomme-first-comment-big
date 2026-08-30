'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const settingsCore = require('../plugin/first-comment-big-settings/settings-core.js')
const {
  createSettingsPageController,
} = require('../plugin/first-comment-big-settings/script.js')

function createElement(initial = {}) {
  return {
    value: '',
    valueAsNumber: NaN,
    disabled: false,
    textContent: '',
    listeners: new Map(),
    addEventListener(type, listener) {
      this.listeners.set(type, listener)
    },
    ...initial,
  }
}

function createFakeDocument() {
  const elements = new Map([
    ['settings-form', createElement()],
    ['theme', createElement({ value: 'light' })],
    ['comment-font-size', createElement({ value: '32', valueAsNumber: 32 })],
    ['first-comment-font-size', createElement({ value: '64', valueAsNumber: 64 })],
    ['save', createElement()],
    ['status', createElement()],
  ])

  return {
    elements,
    getElementById(id) {
      return elements.get(id) || null
    },
  }
}

function jsonResponse(body, ok = true) {
  return {
    ok,
    async json() {
      return body
    },
  }
}

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('loadはGET応答を正規化して3入力へ反映する', async () => {
  const document = createFakeDocument()
  const calls = []
  const controller = createSettingsPageController({
    document,
    settingsCore,
    endpoint: 'http://example.test/settings',
    async fetchImpl(url, options) {
      calls.push({ url, options })
      return jsonResponse({
        theme: 'dark',
        commentFontSize: 40,
        firstCommentFontSize: 80,
        ignored: true,
      })
    },
  })

  await controller.load()

  assert.deepEqual(calls, [{
    url: 'http://example.test/settings',
    options: { method: 'GET' },
  }])
  assert.equal(document.elements.get('theme').value, 'dark')
  assert.equal(document.elements.get('comment-font-size').value, '40')
  assert.equal(document.elements.get('first-comment-font-size').value, '80')
  assert.equal(document.elements.get('status').textContent, '')
})

test('load失敗時は既定値と固定の取得失敗文を表示する', async () => {
  const document = createFakeDocument()
  const controller = createSettingsPageController({
    document,
    settingsCore,
    async fetchImpl() {
      throw new Error('offline')
    },
  })

  await controller.load()

  assert.equal(document.elements.get('theme').value, 'light')
  assert.equal(document.elements.get('comment-font-size').value, '32')
  assert.equal(document.elements.get('first-comment-font-size').value, '64')
  assert.equal(
    document.elements.get('status').textContent,
    '設定を取得できませんでした。',
  )
})

test('saveはvalueAsNumberから完全設定をPUTして応答を再反映する', async () => {
  const document = createFakeDocument()
  document.elements.get('theme').value = 'dark'
  document.elements.get('comment-font-size').value = 'string-must-not-be-used'
  document.elements.get('comment-font-size').valueAsNumber = 40
  document.elements.get('first-comment-font-size').value = 'string-must-not-be-used'
  document.elements.get('first-comment-font-size').valueAsNumber = 80
  const calls = []
  const controller = createSettingsPageController({
    document,
    settingsCore,
    endpoint: 'http://example.test/settings',
    async fetchImpl(url, options) {
      calls.push({ url, options })
      return jsonResponse({
        theme: 'dark',
        commentFontSize: 41,
        firstCommentFontSize: 81,
      })
    },
  })
  let prevented = 0

  await controller.save({ preventDefault() { prevented += 1 } })

  assert.equal(prevented, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://example.test/settings')
  assert.equal(calls[0].options.method, 'PUT')
  assert.deepEqual(calls[0].options.headers, { 'Content-Type': 'application/json' })
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    theme: 'dark',
    commentFontSize: 40,
    firstCommentFontSize: 80,
  })
  assert.equal(document.elements.get('theme').value, 'dark')
  assert.equal(document.elements.get('comment-font-size').value, '41')
  assert.equal(document.elements.get('first-comment-font-size').value, '81')
  assert.equal(document.elements.get('status').textContent, '保存しました。')
})

test('save中だけ保存ボタンを無効化する', async () => {
  const document = createFakeDocument()
  const response = deferred()
  const controller = createSettingsPageController({
    document,
    settingsCore,
    fetchImpl() {
      return response.promise
    },
  })

  const saving = controller.save()
  assert.equal(document.elements.get('save').disabled, true)

  response.resolve(jsonResponse(settingsCore.DEFAULT_SETTINGS))
  await saving

  assert.equal(document.elements.get('save').disabled, false)
})

test('save失敗時は入力を保持して固定の保存失敗文を表示する', async () => {
  const document = createFakeDocument()
  document.elements.get('theme').value = 'dark'
  document.elements.get('comment-font-size').value = '40'
  document.elements.get('comment-font-size').valueAsNumber = 40
  document.elements.get('first-comment-font-size').value = '80'
  document.elements.get('first-comment-font-size').valueAsNumber = 80
  const controller = createSettingsPageController({
    document,
    settingsCore,
    async fetchImpl() {
      return jsonResponse({}, false)
    },
  })

  await controller.save()

  assert.equal(document.elements.get('theme').value, 'dark')
  assert.equal(document.elements.get('comment-font-size').value, '40')
  assert.equal(document.elements.get('first-comment-font-size').value, '80')
  assert.equal(
    document.elements.get('status').textContent,
    '設定を保存できませんでした。',
  )
  assert.equal(document.elements.get('save').disabled, false)
})

test('設定画面はinnerHTMLを使用しない', () => {
  const pluginDirectory = path.join(__dirname, '..', 'plugin', 'first-comment-big-settings')
  for (const file of ['index.html', 'script.js']) {
    const source = fs.readFileSync(path.join(pluginDirectory, file), 'utf8')
    assert.doesNotMatch(source, /innerHTML/)
  }
})

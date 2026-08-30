'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

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
        code: 200,
        response: {
          theme: 'dark',
          commentFontSize: 40,
          firstCommentFontSize: 80,
          ignored: true,
        },
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

test('loadはHTTP成功でもplugin codeが200以外なら取得失敗として扱う', async () => {
  const document = createFakeDocument()
  document.elements.get('theme').value = 'dark'
  document.elements.get('comment-font-size').value = '40'
  document.elements.get('first-comment-font-size').value = '80'
  const controller = createSettingsPageController({
    document,
    settingsCore,
    async fetchImpl() {
      return jsonResponse({ code: 400, response: { message: 'error' } })
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

test('loadはGETの非ok応答を失敗として既定値へ戻す', async () => {
  const document = createFakeDocument()
  document.elements.get('theme').value = 'dark'
  document.elements.get('comment-font-size').value = '40'
  document.elements.get('first-comment-font-size').value = '80'
  const controller = createSettingsPageController({
    document,
    settingsCore,
    async fetchImpl() {
      return jsonResponse({
        theme: 'dark',
        commentFontSize: 40,
        firstCommentFontSize: 80,
      }, false)
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

test('初期load中は保存ボタンを無効化し完了後に戻す', async () => {
  const document = createFakeDocument()
  const response = deferred()
  const controller = createSettingsPageController({
    document,
    settingsCore,
    fetchImpl() {
      return response.promise
    },
  })

  const loading = controller.load()

  assert.equal(document.elements.get('save').disabled, true)

  response.resolve(jsonResponse({
    code: 200,
    response: settingsCore.DEFAULT_SETTINGS,
  }))
  await loading

  assert.equal(document.elements.get('save').disabled, false)
})

test('新しいsave完了後に初期GET成功が遅れても保存結果を上書きしない', async () => {
  const document = createFakeDocument()
  const getResponse = deferred()
  const putResponse = deferred()
  const controller = createSettingsPageController({
    document,
    settingsCore,
    fetchImpl(_url, options) {
      return options.method === 'GET' ? getResponse.promise : putResponse.promise
    },
  })

  const loading = controller.load()
  document.elements.get('theme').value = 'dark'
  document.elements.get('comment-font-size').valueAsNumber = 40
  document.elements.get('first-comment-font-size').valueAsNumber = 80
  const saving = controller.save()

  putResponse.resolve(jsonResponse({
    code: 200,
    response: {
      theme: 'dark',
      commentFontSize: 41,
      firstCommentFontSize: 81,
    },
  }))
  await saving
  getResponse.resolve(jsonResponse({
    code: 200,
    response: {
      theme: 'light',
      commentFontSize: 20,
      firstCommentFontSize: 30,
    },
  }))
  await loading

  assert.equal(document.elements.get('theme').value, 'dark')
  assert.equal(document.elements.get('comment-font-size').value, '41')
  assert.equal(document.elements.get('first-comment-font-size').value, '81')
  assert.equal(document.elements.get('status').textContent, '保存しました。')
  assert.equal(document.elements.get('save').disabled, false)
})

test('新しいsave中に初期GET失敗が先に完了しても入力と状態を上書きしない', async () => {
  const document = createFakeDocument()
  const getResponse = deferred()
  const putResponse = deferred()
  const controller = createSettingsPageController({
    document,
    settingsCore,
    fetchImpl(_url, options) {
      return options.method === 'GET' ? getResponse.promise : putResponse.promise
    },
  })

  const loading = controller.load()
  document.elements.get('theme').value = 'dark'
  document.elements.get('comment-font-size').value = '40'
  document.elements.get('comment-font-size').valueAsNumber = 40
  document.elements.get('first-comment-font-size').value = '80'
  document.elements.get('first-comment-font-size').valueAsNumber = 80
  const saving = controller.save()

  getResponse.resolve(jsonResponse({}, false))
  await loading
  const stateWhileSavePending = {
    theme: document.elements.get('theme').value,
    commentFontSize: document.elements.get('comment-font-size').value,
    firstCommentFontSize: document.elements.get('first-comment-font-size').value,
    status: document.elements.get('status').textContent,
    saveDisabled: document.elements.get('save').disabled,
  }
  putResponse.resolve(jsonResponse({
    code: 200,
    response: {
      theme: 'dark',
      commentFontSize: 40,
      firstCommentFontSize: 80,
    },
  }))
  await saving

  assert.deepEqual(stateWhileSavePending, {
    theme: 'dark',
    commentFontSize: '40',
    firstCommentFontSize: '80',
    status: '',
    saveDisabled: true,
  })
  assert.equal(document.elements.get('status').textContent, '保存しました。')
  assert.equal(document.elements.get('save').disabled, false)
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
        code: 200,
        response: {
          theme: 'dark',
          commentFontSize: 40,
          firstCommentFontSize: 80,
        },
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
  assert.equal(document.elements.get('comment-font-size').value, '40')
  assert.equal(document.elements.get('first-comment-font-size').value, '80')
  assert.equal(document.elements.get('status').textContent, '保存しました。')
})

test('saveはHTTP成功でもplugin codeが200以外なら入力を保持して失敗表示する', async () => {
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
      return jsonResponse({ code: 400, response: { message: 'error' } })
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

  response.resolve(jsonResponse({
    code: 200,
    response: settingsCore.DEFAULT_SETTINGS,
  }))
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

test('ブラウザ起動時に必須DOMを確認してsubmit登録と初期GETを行う', async () => {
  const document = createFakeDocument()
  const lookedUpIds = []
  const getElementById = document.getElementById.bind(document)
  document.getElementById = (id) => {
    lookedUpIds.push(id)
    return getElementById(id)
  }
  const calls = []
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'plugin', 'first-comment-big-settings', 'script.js'),
    'utf8',
  )
  const context = {
    document,
    FirstCommentBigSettingsCore: settingsCore,
    async fetch(url, options) {
      calls.push({ url, options })
      return jsonResponse({
        code: 200,
        response: {
          theme: 'dark',
          commentFontSize: 40,
          firstCommentFontSize: 80,
        },
      })
    },
  }

  vm.runInNewContext(source, context, { filename: 'settings-page-script.js' })
  await new Promise((resolve) => setImmediate(resolve))

  for (const id of [
    'settings-form',
    'theme',
    'comment-font-size',
    'first-comment-font-size',
    'save',
    'status',
  ]) {
    assert.equal(lookedUpIds.includes(id), true, `${id} must be looked up`)
  }
  assert.equal(
    typeof document.elements.get('settings-form').listeners.get('submit'),
    'function',
  )
  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    'http://localhost:11180/api/plugins/com.ckylab.first-comment-big-settings',
  )
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(document.elements.get('theme').value, 'dark')
  assert.equal(document.elements.get('comment-font-size').value, '40')
  assert.equal(document.elements.get('first-comment-font-size').value, '80')
})

test('設定画面はinnerHTMLを使用しない', () => {
  const pluginDirectory = path.join(__dirname, '..', 'plugin', 'first-comment-big-settings')
  for (const file of ['index.html', 'script.js']) {
    const source = fs.readFileSync(path.join(pluginDirectory, file), 'utf8')
    assert.doesNotMatch(source, /innerHTML/)
  }
})

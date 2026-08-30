'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

function makeStore(initial) {
  let value = initial
  let writes = 0
  return {
    get store() { return value },
    set store(next) { value = next; writes += 1 },
    snapshot: () => structuredClone(value),
    writes: () => writes,
  }
}

function loadPlugin() {
  const path = require.resolve('../plugin/first-comment-big-settings/plugin.js')
  delete require.cache[path]
  return require(path)
}

const defaults = {
  theme: 'light',
  commentFontSize: 32,
  firstCommentFontSize: 64,
}

test('メタデータが設計値と一致しpermissionsが空である', () => {
  const plugin = loadPlugin()

  assert.deepEqual({
    name: plugin.name,
    uid: plugin.uid,
    version: plugin.version,
    author: plugin.author,
    url: plugin.url,
    permissions: plugin.permissions,
  }, {
    name: '初コメBIG 設定',
    uid: 'com.ckylab.first-comment-big-settings',
    version: '1.0.0',
    author: 'CKY Lab',
    url: 'http://localhost:11180/plugins/com.ckylab.first-comment-big-settings/index.html',
    permissions: [],
  })
  assert.equal(typeof plugin.init, 'function')
  assert.equal(typeof plugin.request, 'function')
  assert.equal(Object.hasOwn(plugin, 'subscribe'), false)
})

test('defaultStateが完全な既定設定である', () => {
  assert.deepEqual(loadPlugin().defaultState, defaults)
})

test('initがstore.storeの保存済み設定を正規化し既に正規形なら書き込まない', () => {
  const saved = { theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }
  const store = makeStore(saved)

  loadPlugin().init({ store })

  assert.deepEqual(store.snapshot(), saved)
  assert.equal(store.writes(), 0)
})

test('initialDataを永続設定へ使用せずstoreの保存済み設定を維持する', () => {
  for (const initialData of [{}, { waitingList: ['unrelated'] }]) {
    const plugin = loadPlugin()
    const saved = { theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }
    const store = makeStore(saved)

    plugin.init({ store }, initialData)

    assert.deepEqual(store.snapshot(), saved)
    assert.equal(store.writes(), 0)
  }
})

test('GETが完全な正規化設定を返し不正なstoreを一度だけ修復する', async () => {
  const store = makeStore({ theme: 'neon', commentFontSize: 12, unknown: true })
  const plugin = loadPlugin()
  plugin.init({ store })
  const writesAfterInit = store.writes()

  const result = await plugin.request({ method: 'GET' })

  assert.deepEqual(result, { code: 200, response: defaults })
  assert.deepEqual(store.snapshot(), defaults)
  assert.equal(writesAfterInit, 1)
  assert.equal(store.writes(), 1)
})

test('同一状態の連続GETがstore setterを増やさない', async () => {
  const store = makeStore({ ...defaults })
  const plugin = loadPlugin()
  plugin.init({ store })

  await plugin.request({ method: 'GET' })
  await plugin.request({ method: 'GET' })

  assert.equal(store.writes(), 0)
})

test('PUTがJSON解析と項目別正規化を行い完全設定を保存して返す', async () => {
  const store = makeStore({ ...defaults })
  const plugin = loadPlugin()
  plugin.init({ store })

  const result = await plugin.request({
    method: 'PUT',
    body: JSON.stringify({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 999, extra: true }),
  })

  const expected = { theme: 'dark', commentFontSize: 40, firstCommentFontSize: 64 }
  assert.deepEqual(result, { code: 200, response: expected })
  assert.deepEqual(store.snapshot(), expected)
  assert.equal(store.writes(), 1)
})

test('同一設定のPUTがstore setterを増やさない', async () => {
  const store = makeStore({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 })
  const plugin = loadPlugin()
  plugin.init({ store })

  await plugin.request({ method: 'PUT', body: JSON.stringify(store.snapshot()) })

  assert.equal(store.writes(), 0)
})

test('構文不正JSONがcode 400で直前状態を維持する', async () => {
  const saved = { theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }
  const store = makeStore(saved)
  const plugin = loadPlugin()
  plugin.init({ store })

  const result = await plugin.request({ method: 'PUT', body: '{invalid' })

  assert.deepEqual(result, { code: 400, response: { message: 'Invalid JSON' } })
  assert.deepEqual(store.snapshot(), saved)
  assert.equal(store.writes(), 0)
})

test('PUTのnull、配列、文字列は全項目を既定値へ正規化する', async () => {
  for (const body of ['null', '[]', '"string"']) {
    const store = makeStore({ theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 })
    const plugin = loadPlugin()
    plugin.init({ store })

    const result = await plugin.request({ method: 'PUT', body })

    assert.deepEqual(result, { code: 200, response: defaults })
    assert.deepEqual(store.snapshot(), defaults)
    assert.equal(store.writes(), 1)
  }
})

test('GETとPUT以外のPOSTとDELETEは404で状態を変更しない', async () => {
  for (const method of ['POST', 'DELETE']) {
    const saved = { theme: 'dark', commentFontSize: 40, firstCommentFontSize: 80 }
    const store = makeStore(saved)
    const plugin = loadPlugin()
    plugin.init({ store })

    const result = await plugin.request({ method, body: '{}' })

    assert.deepEqual(result, { code: 404, response: { message: 'Not Found' } })
    assert.deepEqual(store.snapshot(), saved)
    assert.equal(store.writes(), 0)
  }
})

test('store未注入のGETは完全な既定設定を返す', async () => {
  const result = await loadPlugin().request({ method: 'GET' })

  assert.deepEqual(result, { code: 200, response: defaults })
})

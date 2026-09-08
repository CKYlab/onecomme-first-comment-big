'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('../plugin/first-comment-big-settings/settings-core.js')
const clientModule = require('../template/first-comment-big/settings-client.js')
const pluginDefinition = require('../plugin/first-comment-big-settings/plugin.js')

const oldSettings = { theme: 'dark', fontPreset: 'rounded', commentFontSize: 40, firstCommentFontSize: 80, anonymousFirstCommentBig: true }
const defaults = { theme: 'light', fontPreset: 'standard', commentFontSize: 32, firstCommentFontSize: 64, anonymousFirstCommentBig: false, retroWindowFrame: false }
const palettes = {
  light: ['#ffffff', '#000000', '#d8d8d8', '#ffffff', '#000000', '#000080', '#ffffff'],
  dark: ['#0b0b0b', '#ffffff', '#333333', '#222222', '#ffffff', '#333333', '#ffffff'],
  'classic-gray': ['#c0c0c0', '#000000', '#808080', '#c0c0c0', '#000000', '#000080', '#ffffff'],
  'blue-gray': ['#d4dce4', '#182838', '#8798a8', '#d4dce4', '#182838', '#24486b', '#ffffff'],
  monochrome: ['#181818', '#e0e0e0', '#606060', '#181818', '#e0e0e0', '#404040', '#ffffff'],
  amber: ['#171109', '#ffcc66', '#70552b', '#171109', '#ffcc66', '#3b2b12', '#ffcc66'],
  'green-crt': ['#09130c', '#9be6a8', '#356342', '#09130c', '#9be6a8', '#173823', '#b8f0c2'],
}

test('minchoを全テーマと保存でき既存フォント・他設定も再起動後に維持する', async () => {
  for (const theme of Object.keys(palettes)) {
    for (const fontPreset of ['mincho', 'standard', 'meiryo', 'biz-ud', 'rounded']) {
      const saved = { ...oldSettings, theme, fontPreset, retroWindowFrame: true }
      for (const module of [core, clientModule]) assert.deepEqual(module.normalizeSettings(saved), saved)
      const store = { store: { ...saved } }
      const plugin = { ...pluginDefinition }
      plugin.init({ store })
      for (const body of [saved, JSON.stringify(saved)]) {
        assert.deepEqual(await plugin.request({ method: 'PUT', body }), { code: 200, response: saved })
        const restarted = { ...pluginDefinition }
        restarted.init({ store })
        assert.deepEqual(await restarted.request({ method: 'GET' }), { code: 200, response: saved })
      }
    }
  }
})

test('旧5設定を両側で維持し枠OFFだけを補完する', () => {
  for (const module of [core, clientModule]) {
    assert.deepEqual(module.normalizeSettings(oldSettings), { ...oldSettings, retroWindowFrame: false })
    for (const theme of Object.keys(palettes)) {
      assert.deepEqual(module.normalizeSettings({ ...oldSettings, theme, retroWindowFrame: true }), { ...oldSettings, theme, retroWindowFrame: true })
    }
    for (const value of [undefined, null, 'true', 1, {}, []]) {
      assert.equal(module.normalizeSettings({ retroWindowFrame: value }).retroWindowFrame, false)
    }
    assert.deepEqual(module.normalizeSettings({ theme: 'unknown' }), defaults)
    for (const theme of [['dark'], ['amber'], { toString: () => 'dark' }, null, 1]) {
      assert.deepEqual(module.normalizeSettings({ theme }), defaults)
    }
    assert.equal(module.settingsEqual(defaults, { ...defaults, retroWindowFrame: true }), false)
  }
})

test('旧storeを一度だけ補完し新テーマと枠を再起動後も復元する', async () => {
  let value = { ...oldSettings }
  let writes = 0
  const store = { get store() { return value }, set store(next) { value = next; writes++ } }
  const plugin = { ...pluginDefinition }
  plugin.init({ store, initialData: {} })
  assert.deepEqual(value, { ...oldSettings, retroWindowFrame: false })
  assert.equal(writes, 1)
  await plugin.request({ method: 'GET' })
  assert.equal(writes, 1)
  for (const theme of Object.keys(palettes)) {
    const next = { ...oldSettings, theme, retroWindowFrame: true }
    for (const body of [next, JSON.stringify(next)]) {
      assert.deepEqual(await plugin.request({ method: 'PUT', body }), { code: 200, response: next })
      const before = writes
      const restarted = { ...pluginDefinition }
      restarted.init({ store, initialData: { waitingList: [] } })
      assert.deepEqual(await restarted.request({ method: 'GET' }), { code: 200, response: next })
      assert.equal(writes, before)
    }
  }
})

test('全配色と枠を差分適用し同値no-opと失敗時の枠OFFを維持する', async () => {
  const properties = new Map()
  const attributes = new Map()
  let mutations = 0
  let fits = 0
  let tick
  let payload = { code: 200, response: defaults }
  const rootElement = {
    style: { setProperty(k, v) { properties.set(k, v); mutations++ } },
    setAttribute(k, v) { attributes.set(k, v); mutations++ },
    removeAttribute(k) { attributes.delete(k); mutations++ },
  }
  const client = clientModule.createSettingsClient({
    rootElement,
    fitCommentsToViewport() { fits++ },
    fetchImpl: async () => ({ ok: true, json: async () => payload }),
    setIntervalImpl(fn, ms) { assert.equal(ms, 500); tick = fn; return 1 },
    clearIntervalImpl() {}, warn() {},
  })
  await client.start()
  assert.equal(mutations, 0)
  payload = { code: 200, response: { ...defaults, retroWindowFrame: true } }
  await tick()
  assert.equal(fits, 1)
  assert.equal(mutations, 1, '枠だけの変更で色やフォントを書き換えない')
  payload = { code: 200, response: defaults }
  await tick()
  assert.equal(fits, 2)
  assert.equal(mutations, 2)
  // Begin with dark so that returning to light exercises its palette too.
  for (const theme of ['dark', ...Object.keys(palettes)]) {
    payload = { code: 200, response: { ...defaults, theme, retroWindowFrame: true } }
    const previousFits = fits
    await tick()
    assert.equal(fits, previousFits + 1)
    assert.deepEqual([
      '--panel-background', '--comment-text-color', '--comment-border-color',
      '--gift-neutral-background', '--gift-neutral-text-color',
      '--retro-title-background', '--retro-title-text-color',
    ].map(k => properties.get(k)), palettes[theme])
    assert.equal(attributes.get('data-retro-window-frame'), 'true')
    const before = [mutations, fits]
    await tick()
    assert.deepEqual([mutations, fits], before)
  }
  const before = fits
  payload = { code: 400, response: { message: 'error' } }
  await tick()
  assert.notEqual(attributes.get('data-retro-window-frame'), 'true')
  assert.equal(properties.get('--panel-background'), '#ffffff')
  assert.equal(fits, before + 1)
  client.stop()
})

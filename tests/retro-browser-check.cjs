'use strict'

// Run explicitly with Playwright available via NODE_PATH; no runtime dependency.
const { chromium } = require('playwright')
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const defaults = { theme: 'light', fontPreset: 'standard', commentFontSize: 32, firstCommentFontSize: 64, anonymousFirstCommentBig: false, retroWindowFrame: false }
const themes = ['light', 'dark', 'classic-gray', 'blue-gray', 'monochrome', 'amber', 'green-crt']
let settings = { ...defaults }
let fail = false
const sdk = `window.OneSDK={ready:async()=>{},setup:async()=>{},subscribe:({callback})=>{window.emitComments=callback;return 1},connect:async()=>{},unsubscribe:()=>{}}`

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const relative = decodeURIComponent(url.pathname).slice(1)
      const target = path.resolve(root, relative)
      if (!target.startsWith(root + path.sep)) throw new Error('Invalid path')
      const ext = path.extname(target)
      res.setHeader('Content-Type', ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'application/octet-stream')
      const content = relative.startsWith('baseline/')
        ? execFileSync('git', ['show', `f2a864f:${relative.slice(9)}`], { cwd: root })
        : await fs.readFile(target)
      res.end(content)
    } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) })
    const context = await browser.newContext()
    await context.route('**/__origin/js/onesdk.js', route => route.fulfill({ contentType: 'application/javascript', body: sdk }))
    await context.route('http://localhost:11180/**', route => {
      if (route.request().method() === 'PUT') settings = route.request().postDataJSON()
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(fail ? { code: 400, response: {} } : { code: 200, response: settings }) })
    })
    const base = `http://127.0.0.1:${server.address().port}`
    const page = await context.newPage()
    const previous = await context.newPage()
    const read = p => p.evaluate(() => {
      const el = document.getElementById('comments')
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, background: style.backgroundColor, overflow: style.overflowY }
    })
    for (const theme of ['light', 'dark']) {
      settings = { ...defaults, theme }
      await page.goto(`${base}/template/first-comment-big/index.html`)
      await previous.goto(`${base}/baseline/template/first-comment-big/index.html`)
      await page.waitForTimeout(600)
      assert.deepEqual(await read(page), await read(previous), `${theme} legacy layout/colors`)
    }
    await previous.close()
    await page.evaluate(() => {
      const normal = (comment, isFirstTime = false) => ({ service: 'youtube', data: { comment, isFirstTime } })
      const gift = free => ({ service: 'twicas', data: { hasGift: true, isFirstTime: true, isFreeGift: free, item: { name: free ? 'neutral' : 'paid' }, colors: { bodyBackgroundColor: '#123456', bodyTextColor: '#fedcba' } } })
      window.emitComments([normal('通常'), normal('長い初コメです。'.repeat(12), true), gift(true), gift(false), { service: 'kick', data: { hasGift: true, isFirstTime: true, gift: {}, colors: { bodyBackgroundColor: '#18fbb0', bodyTextColor: '#333333' }, origin: { gift: { amount: 100 }, message: '' } } }])
      window.originalRows = [...document.getElementById('comments').children]
    })
    for (const viewport of [{ width: 390, height: 600 }, { width: 1920, height: 1080 }, { width: 390, height: 120 }]) {
      await page.setViewportSize(viewport)
      for (const theme of themes) {
        settings = { ...defaults, theme, retroWindowFrame: true }
        await page.waitForTimeout(600)
        assert.equal(await page.locator('#retro-window-frame').count(), 1, 'one outer frame')
        assert.equal(await page.locator('#retro-window-frame').isVisible(), true)
        assert.equal((await page.locator('#retro-window-frame').innerText()).trim(), 'コメント')
        const rect = await read(page)
        assert.equal(rect.x, 2)
        assert.equal(rect.y, 24)
        assert.equal(rect.width, viewport.width - 4)
        assert.equal(rect.height, viewport.height - 26)
        assert.equal(rect.overflow, 'hidden')
        const rows = await page.evaluate(() => {
          const elements = [...document.getElementById('comments').children]
          return {
            sameNodes: elements.every((el, i) => el === window.originalRows[i]),
            styles: elements.map(el => { const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.fontSize] }),
            neutral: getComputedStyle(document.documentElement).getPropertyValue('--gift-neutral-background').trim(),
          }
        })
        assert.equal(rows.sameNodes, true, 'theme/frame never recreate or delete comments')
        assert.equal(rows.styles.length, 5)
        assert.deepEqual(rows.styles[0], ['rgb(24, 251, 176)', 'rgb(51, 51, 51)', '32px'])
        assert.deepEqual(rows.styles[1], ['rgb(18, 52, 86)', 'rgb(254, 220, 186)', '32px'])
        const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
        assert.equal(rows.styles[2][0], rgb(rows.neutral))
        assert.equal(rows.styles[3][2], '64px')
        assert.equal(rows.styles[4][2], '32px')
        settings = { ...settings, retroWindowFrame: false }
        await page.waitForTimeout(600)
        assert.equal(await page.locator('#retro-window-frame').isVisible(), false)
        assert.equal((await read(page)).height, viewport.height)
      }
    }
    settings = { ...defaults, theme: 'amber', retroWindowFrame: true }
    await page.setViewportSize({ width: 390, height: 600 })
    await page.waitForTimeout(600)
    if (process.env.RETRO_SCREENSHOT) await page.screenshot({ path: process.env.RETRO_SCREENSHOT })
    fail = true
    await page.waitForTimeout(600)
    assert.equal(await page.locator('#retro-window-frame').isVisible(), false)
    assert.equal((await read(page)).background, 'rgb(255, 255, 255)')
    fail = false
    const ui = await context.newPage()
    await ui.goto(`${base}/plugin/first-comment-big-settings/index.html`)
    assert.deepEqual(await ui.locator('#font-preset option').evaluateAll(options => options.map(option => [option.value, option.textContent])), [
      ['standard', '標準（游ゴシック）'], ['meiryo', 'メイリオ'], ['biz-ud', '太ゴシック（BIZ UDPゴシック）'], ['rounded', '丸ゴシック（M PLUS Rounded 1c）'], ['mincho', '明朝体'],
    ])
    for (const theme of themes) {
      await ui.locator('#save').waitFor({ state: 'visible' })
      await ui.waitForFunction(() => !document.getElementById('save').disabled)
      await ui.selectOption('#theme', theme)
      await ui.selectOption('#font-preset', 'mincho')
      await ui.check('#retro-window-frame')
      await ui.click('#save')
      await ui.waitForFunction(() => !document.getElementById('save').disabled)
      assert.equal(settings.theme, theme)
      assert.equal(settings.retroWindowFrame, true)
      assert.equal(settings.fontPreset, 'mincho')
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#comments .comment')).fontFamily.startsWith('"Yu Mincho"'))
      assert.equal(await page.locator('#first-comment-big-rounded-font').count(), 0)
      await ui.reload()
      await ui.waitForFunction(() => !document.getElementById('save').disabled)
      assert.equal(await ui.locator('#theme').inputValue(), theme)
      assert.equal(await ui.locator('#retro-window-frame').isChecked(), true)
      assert.equal(await ui.locator('#font-preset').inputValue(), 'mincho')
    }
    await ui.close()
    await page.goto(`${base}/tests/first-comment-big-browser-fixture.html`)
    await page.click('#run-settings-checks')
    await page.waitForFunction(() => ['true', 'false'].includes(document.documentElement.dataset.settingsChecksPass), null, { timeout: 60000 })
    assert.equal(await page.evaluate(() => document.documentElement.dataset.settingsChecksPass), 'true', await page.locator('body').innerText())
    console.log('PASS: legacy light/dark; 7 themes × frame ON/OFF × 3 viewports; retained normal/BIG/neutral/paid/Kick rows; UI save/reload; API fallback; existing browser fixture')
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

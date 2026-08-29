# 初コメBIG v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コメント本文だけを表示し、通常ユーザーとTwitCasting匿名ユーザーの初回コメントだけを大きくする、わんコメ本番テンプレートを作る。

**Architecture:** 依存なしUMDコアが表示本文選択、BIG判定、匿名履歴、永続化を担当し、薄いブラウザアダプターがOneSDKライフサイクルと安全なDOM描画を担当する。既存Probeは変更せず、本番テンプレートを `template/first-comment-big/` に分離する。

**Tech Stack:** HTML5、CSS、plain JavaScript、OneSDK、Node.js標準テストランナー、ブラウザfixture

**Spec:** `docs/superpowers/specs/2026-08-26-first-comment-big-v1-design.md`

## Global Constraints

- 既存Probe、調査資料、未追跡 `dist/` を変更・削除しない。
- 外部依存、ビルドツール、設定UI、外部送信、Analyticsを追加しない。
- 通常ユーザーは `data.isFirstTime === true` の場合だけBIGとする。
- `data.hasGift === true` は匿名判定や通常判定より先に通常サイズへ確定する。
- TwitCasting匿名独自判定は `service === 'twicas' && data.isAnonymous === true` の場合だけ行う。
- 匿名識別には `service`、`liveId`、`data.name` だけを使い、数字抽出、`userId`、`screenName` を使わない。
- 匿名履歴だけを `localStorage` に保存し、最大15配信を保持する。
- 受信データの描画は `textContent` を使い、`innerHTML` を使わない。
- ZIP生成、Gitコミット、GitHub公開を行わない。

---

### Task 1: BIG判定と匿名履歴コア

**Files:**
- Create: `tests/first-comment-core.test.js`
- Create: `template/first-comment-big/first-comment-core.js`

**Interfaces:**
- Consumes: storage-like object with `getItem(key)` and `setItem(key, value)`; comment shaped as `{ service, data }`.
- Produces: `FirstCommentBigCore.createAnonymousHistory(options)`, `createDisplayModel(comment, history)`, `STORAGE_KEY`, `MAX_LIVES`.
- `history.remember({ service, liveId, name }) -> boolean`: new key is stored and returns `true`; known key returns `false`.
- `history.toJSON() -> { version: 1, lives: Array<{ service, liveId, names: string[] }> }`.
- `createDisplayModel(comment, history) -> null | { text: string, isFirstComment: boolean }`.

- [ ] **Step 1: Write the required failing classification tests**

Create literal, anonymized fixtures and assertions for all requested cases:

```js
test('normal first comment is BIG only for strict true', () => {
  const history = core.createAnonymousHistory()
  assert.deepEqual(
    core.createDisplayModel({ service: 'youtube', data: { comment: 'hello', isFirstTime: true } }, history),
    { text: 'hello', isFirstComment: true },
  )
  assert.equal(core.createDisplayModel({ service: 'youtube', data: { comment: 'again', isFirstTime: false } }, history).isFirstComment, false)
  assert.equal(core.createDisplayModel({ service: 'youtube', data: { comment: 'unknown' } }, history).isFirstComment, false)
  assert.equal(core.createDisplayModel({ service: 'youtube', data: { comment: 'truthy', isFirstTime: 1 } }, history).isFirstComment, false)
})

test('gift is always normal and does not consume anonymous history', () => {
  const history = core.createAnonymousHistory()
  const identity = { service: 'twicas', liveId: 'live-a', name: '匿名コメント#1000' }
  const gift = { service: 'twicas', data: { hasGift: true, isAnonymous: true, isFirstTime: true, liveId: identity.liveId, name: identity.name, comment: '<img>', speechText: 'アイテム' } }
  assert.deepEqual(core.createDisplayModel(gift, history), { text: 'アイテム', isFirstComment: false })
  assert.equal(history.remember(identity), true)
})
```

Add separate tests for: same anonymous twice; same `screenName: 'c:tw1'` with different names; same name across different `liveId`; missing anonymous `liveId`; missing anonymous `name`; other services with `isFirstTime`; malformed input; empty text; gift text choosing `speechText`, then `item.name`, while ignoring HTML-bearing `comment`.

- [ ] **Step 2: Write failing persistence and fallback tests**

Use an in-memory storage fake and a throwing storage fake:

```js
function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    read: (key) => values.get(key),
  }
}

test('restored anonymous identity is not first', () => {
  const storage = makeStorage()
  const first = core.createAnonymousHistory({ storage })
  assert.equal(first.remember({ service: 'twicas', liveId: 'live-a', name: '匿名コメント#1000' }), true)
  const restored = core.createAnonymousHistory({ storage })
  assert.equal(restored.remember({ service: 'twicas', liveId: 'live-a', name: '匿名コメント#1000' }), false)
})
```

Also assert: throwing `getItem` falls back to memory and warns once; throwing `setItem` still remembers in memory and warns once; stored JSON includes only `version`, `service`, `liveId`, `names`; corrupted/unknown-version data is ignored; 16 live IDs evict the oldest whole live while retaining 15.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --test tests/first-comment-core.test.js`

Expected: FAIL because `template/first-comment-big/first-comment-core.js` does not exist.

- [ ] **Step 4: Implement the minimal UMD core**

Implement constants and functions with these exact decisions:

```js
const STORAGE_KEY = 'onecomme.first-comment-big.anonymous-history.v1'
const MAX_LIVES = 15

function createDisplayModel(comment, history) {
  if (!comment || typeof comment !== 'object' || !comment.data || typeof comment.data !== 'object') return null
  const data = comment.data
  const text = selectText(data)
  if (!text) return null
  if (data.hasGift === true) return { text, isFirstComment: false }
  if (comment.service === 'twicas' && data.isAnonymous === true) {
    const identity = createAnonymousIdentity(comment.service, data.liveId, data.name)
    return { text, isFirstComment: identity ? history.remember(identity) : false }
  }
  return { text, isFirstComment: data.isFirstTime === true }
}
```

For gifts, `selectText` checks nonblank string `speechText`, then nonblank string `item.name`, and never uses `comment`. For non-gifts, it accepts only a nonblank string `comment`. `createAnonymousIdentity` accepts only nonblank strings and preserves the full `name`.

The history loads validated version-1 JSON, keeps lives oldest-to-newest, moves a touched live to the end, caps at 15, updates memory before attempting storage, disables storage after the first exception, and invokes `warn` no more than once.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/first-comment-core.test.js`

Expected: all first-comment core tests PASS with no warnings or failures.

---

### Task 2: OneSDKアダプターと透過表示

**Files:**
- Create: `template/first-comment-big/index.html`
- Create: `template/first-comment-big/style.css`
- Create: `template/first-comment-big/script.js`
- Create: `tests/first-comment-big-browser-fixture.html`

**Interfaces:**
- Consumes: globals `window.FirstCommentBigCore` and `window.OneSDK`; `<main id="comments">`.
- Produces: DOM children `.comment` and `.comment--first`; at most 12 children; idempotent `pagehide` cleanup.

- [ ] **Step 1: Create the fake-OneSDK fixture before the adapter**

The fixture defines `window.OneSDK` before loading production scripts, captures the subscribed callback and subscriber ID, and exposes buttons for normal first, normal repeat, anonymous first/repeat, different anonymous, gift, and restored history. It includes no real usernames, comments, IDs, or profile URLs.

```js
window.OneSDK = {
  PERM: { COMMENT: 'comment' },
  ready: async () => {},
  usePermission: () => ['comments'],
  setup: async (options) => { window.__fixtureSetup = options },
  subscribe: ({ action, callback }) => { window.__fixtureAction = action; window.__fixtureCallback = callback; return 'fixture-subscriber' },
  connect: async () => {},
  unsubscribe: (id) => { window.__fixtureUnsubscribed = id },
}
```

- [ ] **Step 2: Verify the fixture is RED**

Open `tests/first-comment-big-browser-fixture.html` through a local HTTP server.

Expected: production HTML/CSS/adapter references are missing and the target flow cannot render comments.

- [ ] **Step 3: Implement semantic markup and CSS**

`index.html` loads `style.css`, `first-comment-core.js`, `../__origin/js/onesdk.js`, and `script.js` in that order, with `<body hidden><main id="comments" aria-live="polite"></main>`.

`style.css` defines exact variables and safe wrapping:

```css
:root {
  --comment-font-size: 32px;
  --first-comment-font-size: 64px;
  --comment-color: #fff;
}

.comment { max-width: 100%; overflow-wrap: anywhere; white-space: pre-wrap; font-size: var(--comment-font-size); }
.comment--first { font-size: var(--first-comment-font-size); }
```

Add transparent `html/body`, readable shared font, weight, line-height and simple dark text outline. Do not add animation.

- [ ] **Step 4: Implement the OneSDK adapter**

Validate `core`, `OneSDK`, and the `comments` element. Construct history with `window.localStorage` inside a safe boundary. For each array item, call `core.createDisplayModel`; create a `p`, set its class and `textContent`, append it, and remove oldest children above 12.

Initialize using the exact approved OneSDK order and show the body only after connection. Register `pagehide` before initialization. Cleanup must be idempotent and call `OneSDK.unsubscribe(subscriberId)` only when both the ID and function are available.

- [ ] **Step 5: Run syntax and static adapter checks**

Run:

```powershell
node --check template/first-comment-big/first-comment-core.js
node --check template/first-comment-big/script.js
rg -n "innerHTML|fetch\(|XMLHttpRequest|sendBeacon|WebSocket" template/first-comment-big
```

Expected: syntax commands exit 0; the forbidden API scan returns no implementation matches.

- [ ] **Step 6: Exercise the browser fixture**

Verify the flow: fixture loads → fake OneSDK connects → each button emits a comment → only the expected element has `.comment--first`. Verify gift is normal, same anonymous repeat is normal, different anonymous is BIG, restored identity is normal, text wraps on desktop and narrow viewport, no relevant Console errors occur, and dispatching `pagehide` records `fixture-subscriber` as unsubscribed.

---

### Task 3: OneCommeメタデータと本番README

**Files:**
- Create: `template/first-comment-big/template.json`
- Create: `template/first-comment-big/README.md`
- Create: `template/first-comment-big/README.txt`

**Interfaces:**
- Consumes: completed template behavior and CSS variables.
- Produces: OneComme metadata and accurate user-facing operating notes.

- [ ] **Step 1: Add OneComme metadata**

Create `template.json` with name `初コメBIG`, version-facing description, author, official template documentation link, width 1920 and height 1080. Do not add unsupported manifest fields.

- [ ] **Step 2: Document behavior and limitations**

Both README variants must cover: comment-body-only display; normal user reliance on strict `isFirstTime`; TwitCasting anonymous `service + liveId + data.name`; anonymous-only localStorage; 15-live cap; memory fallback; gifts always normal; no names; CSS variable overrides; midstream-first-start limitation; YouTube/Twitch/Kick pending real-device checks; install steps; no ZIP generated yet.

- [ ] **Step 3: Run documentation consistency scans**

Run:

```powershell
rg -n "isFirstTime|localStorage|hasGift|--comment-font-size|--first-comment-font-size|YouTube|Twitch|Kick|配信途中" template/first-comment-big/README.md template/first-comment-big/README.txt
```

Expected: every required topic appears in the documentation.

---

### Task 4: 全体検証とセルフレビュー

**Files:**
- Verify: all new files under `template/first-comment-big/` and `tests/`
- Verify unchanged: existing Probe files and `dist/`

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: evidence for the requested final report; no ZIP and no commit.

- [ ] **Step 1: Run the complete Node test suite**

Run: `npm test`

Expected: Probe tests and all new first-comment tests PASS with zero failures.

- [ ] **Step 2: Check every JavaScript file**

Run a PowerShell loop over `rg --files -g '*.js'` and execute `node --check` on every path.

Expected: every command exits 0.

- [ ] **Step 3: Verify DOM and OneSDK contracts**

Check that every production `getElementById` has a matching HTML ID; the script order is core → OneSDK → adapter; setup uses `mode: 'diff'`, `disabledDelay: true`, comment permissions; subscription action is `comments`; `pagehide` cleanup unsubscribes.

- [ ] **Step 4: Verify security and privacy constraints**

Scan production files for `innerHTML`, network-send APIs, numeric extraction, and anonymous-key use of `userId` or `screenName`. Inspect serialized history assertions to prove normal user fields and comments are absent.

- [ ] **Step 5: Run browser QA at desktop and narrow widths**

Use the available in-app Browser path. Confirm page identity, nonblank DOM, no framework overlay, Console health, screenshot evidence, and fixture interaction proof. Record exact states checked and save no test artifacts into the repository.

- [ ] **Step 6: Run whitespace and repository-state checks**

Run:

```powershell
git diff --check
git diff --stat
git status --short
```

Expected: no whitespace errors; existing `dist/` remains untracked and untouched; all intentional new files are visible; no commit exists.

- [ ] **Step 7: Review requirements line by line**

Compare the implementation and fresh command output against every section of the approved design and original 13 test cases. Report any gap as unverified or incomplete instead of inferring success.

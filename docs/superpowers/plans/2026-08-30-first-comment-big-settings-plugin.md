# First Comment BIG Settings Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** わんコメ公式プラグインのREST APIからテーマ、通常コメント文字サイズ、初コメ文字サイズを取得し、OBSを再読み込みせず初コメBIGへ安全に反映する設定機能をTDDで実装する。

**Architecture:** 設定プラグインは依存なしUMDの正規化コア、公式OnePluginオブジェクト、plain HTML/CSS/JavaScriptの設定画面で構成する。テンプレート側はプラグインが存在しなくても単独動作するUMD設定クライアントを持ち、OneSDKコメント購読とは独立して500msポーリングとCSS変数の差分適用を行う。既存script.jsとの接点はfitCommentsToViewportコールバックの注入とdispose時のstopだけに限定する。

**Tech Stack:** JavaScript（CommonJS／UMD）、HTML5、CSS、わんコメOnePlugin REST API、Fetch API、AbortController、Node.js標準テストランナー、既存ブラウザfixture

**Spec:** docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md at commit c3626aca65bd04fab1c63d85494dfecff1fb73d9

## Global Constraints

- 設定はtheme、commentFontSize、firstCommentFontSizeの3項目だけとする。
- 既定値はlight、32、64。通常文字は16〜64、初コメ文字は24〜128の有限整数だけを受理する。
- 数値文字列、小数、NaN、Infinity、範囲外、未知themeを受理しない。未知キーを正規化結果へ残さない。
- テンプレートは起動直後と500ms間隔でlocalhostのプラグイン専用REST APIをGETする。
- API障害時はlight / 32px / 64pxへ戻し、OneSDKコメント購読と描画を継続する。
- 同じ設定の再取得ではCSS変数を再設定せず、fitCommentsToViewportも呼ばない。
- テーマ適用は5つの既存CSS変数だけを扱い、TwitCasting/Kick giftのインライン背景色・文字色を上書きしない。
- 通常ユーザーのisFirstTime、TwitCasting匿名履歴、gift優先順位、TwitCasting/Kick gift、Kickエモート、owner判定、HTML安全化、prependと高さベース削除を変更しない。
- Probe、RAW、既存ZIP、distを変更・削除しない。
- 外部ランタイム依存、UIフレームワーク、WebSocket、設計書にない設定を追加しない。
- 正式ZIP、tag、Release、pushを行わない。
- Task 1のpermissions型ゲートが成功するまでTask 2以降へ進まない。実機ゲートで空配列が拒否された場合も不要権限を追加しない。
- 各実装タスクはRED確認、最小実装、GREEN確認、既存70テストの回帰確認、意味のある小さなcommitの順に行う。

## File Map

**Create:**

- plugin/first-comment-big-settings/settings-core.js — プラグインと設定画面が共有する既定値、normalizeSettings、settingsEqual。
- plugin/first-comment-big-settings/plugin.js — 公式OnePluginメタデータ、store初期化、GET/PUT request処理。
- plugin/first-comment-big-settings/index.html — 設定フォームの意味構造。
- plugin/first-comment-big-settings/style.css — 設定画面だけのスタイル。
- plugin/first-comment-big-settings/script.js — 設定画面コントローラー、GET、valueAsNumber検証、PUT、状態表示。
- template/first-comment-big/settings-client.js — テンプレート用の独立した正規化、ポーリング、差分CSS適用、停止処理。
- tests/settings-core.test.js — 共通設定コアの境界値・不変性テスト。
- tests/settings-plugin.test.js — store修復とREST API契約テスト。
- tests/settings-page.test.js — plain JavaScript設定画面のDOM/fetch制御テスト。
- tests/settings-client.test.js — ポーリング、フォールバック、差分適用、停止テスト。

**Modify:**

- docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md — Task 1とTask 10でpermissions検証結果だけを記録。
- template/first-comment-big/index.html — settings-client.jsをscript.js直前に読み込む。
- template/first-comment-big/script.js — 設定クライアント生成、start、独立したstopを追加。
- tests/first-comment-big-browser-fixture.html — 偽設定API、設定操作、視覚・回帰チェックを追加。
- template/first-comment-big/README.md — 任意プラグイン、設定値、障害時挙動を説明。
- template/first-comment-big/README.txt — 利用者向けの同内容を配布テキストへ反映。

plugin/settings-core.jsとtemplate/settings-client.jsは別配布単位である。テンプレートがプラグイン未導入時にも起動できるよう、settings-client.jsはpluginディレクトリのスクリプトを読み込まず、同じ3項目の正規化契約を内部に持つ。両者の表形式テストデータを同じ値で固定して仕様のずれを検出する。

---

### Task 1: permissions型・公式資料検証ゲート

**Files:**

- Inspect: 現在利用可能な@onecomme.com/onesdk公式型定義
- Inspect: https://onecomme.com/docs/developer/plugin/
- Inspect: https://github.com/OneComme/OneCommeOrderSpeechPlugin/blob/main/src/index.ts
- Modify on successful type gate only: docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md

**Interfaces:**

- Consumes: 公式OnePlugin型のpermissionsプロパティ宣言、公式ドキュメント、公式サンプル。
- Produces: 「型上[]を受理し、実機受理はTask 10で確認する」という進行許可、または実装停止。
- Hard stop: 型が非空配列を要求する、型定義を公式ソースから確認できない、資料間で矛盾する、のいずれかならTask 2へ進まない。

- [ ] **Step 1: 安定版と既存回帰の基準を確認する**

Run:

    git status --short
    git rev-parse a498a52
    git rev-parse c3626aca65bd04fab1c63d85494dfecff1fb73d9
    node --test --test-reporter=spec

Expected: 作業ツリーは開始時点の意図した状態、両commitが解決可能、既存テストはtests 70 / pass 70 / fail 0。既存変更がある場合は削除・resetせず、実装担当者へ報告して停止する。

- [ ] **Step 2: 公式パッケージの型定義をリポジトリ外の一時領域へ取得する**

PowerShell:

    $settingsPermissionsTemp = Join-Path ([System.IO.Path]::GetTempPath()) ('first-comment-big-permissions-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $settingsPermissionsTemp | Out-Null
    npm view @onecomme.com/onesdk version dist.tarball
    npm pack @onecomme.com/onesdk --pack-destination $settingsPermissionsTemp
    tar -xf (Get-ChildItem -LiteralPath $settingsPermissionsTemp -Filter '*.tgz' | Select-Object -First 1).FullName -C $settingsPermissionsTemp
    rg -n "interface OnePlugin|type OnePlugin|permissions" $settingsPermissionsTemp

Expected: パッケージversionとtarballが公式npmパッケージを示し、package内のPlugin型定義からOnePlugin.permissionsの正確な型が読める。リポジトリ内にpackage.json、lockfile、node_modulesを追加しない。ネットワークまたは公開範囲の都合で取得できない場合は、OneComme実機に同梱された同パッケージの型定義を読み取り専用で探す。それでも公式型を特定できなければ停止し、推測で[]を採用しない。

- [ ] **Step 3: 空配列の型成立性を判定する**

型宣言を次の基準で判定する。

- permissionsがSendType[]、PluginPermission[]、ReadonlyArray型など通常の配列型なら、TypeScript上[]は代入可能であり型ゲートはPASS。
- permissionsがreadonly [SendType, ...SendType[]]など非空tupleなら[]は代入不可でFAIL。
- union、generic制約、条件型などで判定が一意でなければFAIL扱いとして停止する。

Run:

    $settingsPluginTypeFile = Get-ChildItem -LiteralPath $settingsPermissionsTemp -Recurse -Filter 'Plugin.d.ts' | Select-Object -First 1
    if (-not $settingsPluginTypeFile) { throw '公式Plugin.d.tsを特定できませんでした。' }
    rg -n "interface OnePlugin|type OnePlugin|permissions" $settingsPluginTypeFile.FullName

Expected on PASS: permissionsが要素0件を禁止しない配列型であることを、ファイルパス、パッケージversion、該当宣言とともに記録できる。

- [ ] **Step 4: 公式ドキュメントと公式サンプルを比較する**

確認する事実:

- 公式ドキュメントはpermissionsプロパティを必須とし、使用するデータタイプを配列で記載すると説明している。
- 公式サンプルは非空配列を使用しているが、空配列を拒否する根拠にはならない。
- request(req)によるプラグイン専用REST APIはpermissionsのイベント購読とは別の契約として記載されている。

Expected: 型上[]が成立し、公式資料と矛盾しない場合だけStep 5へ進む。型または資料が拒否・不明ならcommentsその他を追加せず、公式ドキュメントまたは開発者チャンネルで確認するまで全実装を停止する。

- [ ] **Step 5: 成功した型ゲートを設計書5.2へ記録する**

5.2に、検証日、確認した公式パッケージversion、型宣言が通常の配列型で[]が型上成立したこと、公式資料は空配列の実機受理までは保証していないこと、Task 10を実機確認ゲートとすることを短く追記する。既存の「第一候補」「不要権限を追加しない」方針は残す。

Run:

    git diff --check
    git diff -- docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md
    git diff --name-only

Expected: 設計書5.2だけに検証記録があり、ほかの設計節とファイルに差分がない。

- [ ] **Step 6: permissions型ゲート結果をcommitする**

    git add docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md
    git commit -m "docs: verify settings plugin permissions type"

Expected: 型ゲートPASSの証跡だけを含むcommit。実機受理は未確認のままTask 10へ明示的に残る。

---

### Task 2: 共通設定正規化コア

**Files:**

- Create: tests/settings-core.test.js
- Create: plugin/first-comment-big-settings/settings-core.js

**Interfaces:**

- Produces browser global: FirstCommentBigSettingsCore
- Produces CommonJS exports:
  - DEFAULT_SETTINGS: frozen { theme: 'light', commentFontSize: 32, firstCommentFontSize: 64 }
  - normalizeSettings(input): 新しい完全設定オブジェクト
  - settingsEqual(a, b): boolean。3項目をstrict equalityで比較
- Consumes: 任意のinput。入力を変更しない。

- [ ] **Step 1: 境界値と不正値の失敗テストを書く**

tests/settings-core.test.js:

    'use strict'

    const test = require('node:test')
    const assert = require('node:assert/strict')
    const core = require('../plugin/first-comment-big-settings/settings-core.js')

    test('既定設定を公開し入力を変更せず完全設定を返す', () => {
      const input = {
        theme: 'dark',
        commentFontSize: 32,
        firstCommentFontSize: 64,
        unknown: 'drop-me',
      }
      const before = structuredClone(input)
      assert.deepEqual(core.normalizeSettings(input), {
        theme: 'dark',
        commentFontSize: 32,
        firstCommentFontSize: 64,
      })
      assert.deepEqual(input, before)
      assert.deepEqual(core.DEFAULT_SETTINGS, {
        theme: 'light',
        commentFontSize: 32,
        firstCommentFontSize: 64,
      })
      assert.equal(Object.isFrozen(core.DEFAULT_SETTINGS), true)
    })

    test('themeはlightとdarkだけを受理する', () => {
      for (const [value, expected] of [
        ['light', 'light'],
        ['dark', 'dark'],
        ['LIGHT', 'light'],
        ['unknown', 'light'],
        [null, 'light'],
      ]) {
        assert.equal(core.normalizeSettings({ theme: value }).theme, expected)
      }
    })

    test('通常文字サイズは16から64の有限整数だけを受理する', () => {
      for (const [value, expected] of [
        [16, 16], [32, 32], [64, 64],
        [15, 32], [65, 32], [32.5, 32],
        [NaN, 32], [Infinity, 32], ['32', 32], ['bad', 32],
      ]) {
        assert.equal(core.normalizeSettings({ commentFontSize: value }).commentFontSize, expected)
      }
    })

    test('初コメ文字サイズは24から128の有限整数だけを受理する', () => {
      for (const [value, expected] of [
        [24, 24], [64, 64], [128, 128],
        [23, 64], [129, 64], [64.5, 64],
        [NaN, 64], [Infinity, 64], ['64', 64], ['bad', 64],
      ]) {
        assert.equal(core.normalizeSettings({ firstCommentFontSize: value }).firstCommentFontSize, expected)
      }
    })

    test('各項目を独立して正規化し同値性は既知3項目だけで判定する', () => {
      const normalized = core.normalizeSettings({
        theme: 'dark',
        commentFontSize: 100,
        firstCommentFontSize: 24,
      })
      assert.deepEqual(normalized, {
        theme: 'dark',
        commentFontSize: 32,
        firstCommentFontSize: 24,
      })
      assert.equal(core.settingsEqual(normalized, { ...normalized, ignored: true }), true)
      assert.equal(core.settingsEqual(normalized, { ...normalized, theme: 'light' }), false)
      assert.equal(core.settingsEqual(null, normalized), false)
    })

- [ ] **Step 2: focusedテストを実行してREDを確認する**

Run:

    node --test tests/settings-core.test.js

Expected: MODULE_NOT_FOUND for plugin/first-comment-big-settings/settings-core.js。テスト自体の構文エラーではないことを確認する。

- [ ] **Step 3: 最小UMD実装を書く**

settings-core.jsは既存first-comment-core.jsと同じ公開パターンを使う。

    ;(function exposeSettingsCore(root, factory) {
      'use strict'
      const api = factory()
      if (typeof module === 'object' && module.exports) module.exports = api
      if (root) root.FirstCommentBigSettingsCore = api
    })(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsCore() {
      'use strict'

      const DEFAULT_SETTINGS = Object.freeze({
        theme: 'light',
        commentFontSize: 32,
        firstCommentFontSize: 64,
      })

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

      return Object.freeze({ DEFAULT_SETTINGS, normalizeSettings, settingsEqual })
    })

- [ ] **Step 4: focused GREENと既存回帰を確認する**

Run:

    node --test tests/settings-core.test.js
    npm test

Expected: 新しいsettings-coreテストが全件PASSし、既存70件も含めfail 0。

- [ ] **Step 5: 共通設定コアをcommitする**

    git add plugin/first-comment-big-settings/settings-core.js tests/settings-core.test.js
    git commit -m "feat: add settings normalization core"

---

### Task 3: プラグインGET/PUT API

**Files:**

- Create: tests/settings-plugin.test.js
- Create: plugin/first-comment-big-settings/plugin.js
- Consume: plugin/first-comment-big-settings/settings-core.js

**Interfaces:**

- Produces CommonJS OnePlugin object with name、uid、version、author、url、permissions、defaultState、init、request。
- init({ store }, initialData): store参照を保持し、初期状態を正規化して必要時だけ保存。
- request(req): Promise<{ code: number, response: object }>
- store contract: store.store getter/setter。setter呼び出し回数をテストで観測する。

- [ ] **Step 1: store fakeとAPI失敗テストを書く**

tests/settings-plugin.test.jsは各テストでrequire cacheを削除して新しいplugin objectを取得する。

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

次を独立テストにする。

- メタデータが設計値と一致し、Task 1通過後のpermissionsが[]。
- defaultStateが完全な既定設定である。
- initが不正initialDataを正規化し、既に同値なら書き込まない。
- GETが完全な正規化設定を返し、不正値、欠落キー、未知キーを持つstoreを1回だけ正規形へ修復する。
- 同一状態の連続GETがstore setterを増やさない。
- PUTがJSON解析、項目別正規化、完全設定の保存、完全設定応答を行う。
- 同一設定のPUTがstore setterを増やさない。
- 構文不正JSONがcode 400で直前状態を維持する。
- JSONのnull、配列、文字列は全項目を既定値へ正規化する。
- GET/PUT以外（公式APIで到達し得るPOSTとDELETE）はcode 404で状態を変更しない。

- [ ] **Step 2: focusedテストを実行してREDを確認する**

Run:

    node --test tests/settings-plugin.test.js

Expected: MODULE_NOT_FOUND for plugin.js。settings-core由来の失敗ではない。

- [ ] **Step 3: 公式サンプル形状の最小プラグインを実装する**

plugin.jsは@onecomme.com/onesdkをruntime requireせず、公式サンプルと同じplain objectをmodule.exportsする。型検証はTask 1の公式型定義を根拠にする。

    'use strict'

    const {
      DEFAULT_SETTINGS,
      normalizeSettings,
      settingsEqual,
    } = require('./settings-core.js')

    function isCanonicalSettings(value, normalized) {
      return Boolean(value) &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 3 &&
        Object.hasOwn(value, 'theme') &&
        Object.hasOwn(value, 'commentFontSize') &&
        Object.hasOwn(value, 'firstCommentFontSize') &&
        settingsEqual(value, normalized)
    }

    function persistIfChanged(plugin, next) {
      if (!plugin.store || isCanonicalSettings(plugin.store.store, next)) return false
      plugin.store.store = next
      return true
    }

    const plugin = {
      name: '初コメBIG 設定',
      uid: 'com.ckylab.first-comment-big-settings',
      version: '1.0.0',
      author: 'CKY Lab',
      url: 'http://localhost:11180/plugins/com.ckylab.first-comment-big-settings/index.html',
      permissions: [],
      defaultState: { ...DEFAULT_SETTINGS },

      init({ store }, initialData) {
        this.store = store
        const source = initialData === undefined ? store.store : initialData
        const normalized = normalizeSettings(source)
        persistIfChanged(this, normalized)
      },

      async request(req) {
        if (req.method === 'GET') {
          const normalized = normalizeSettings(this.store && this.store.store)
          persistIfChanged(this, normalized)
          return { code: 200, response: normalized }
        }
        if (req.method === 'PUT') {
          let parsed
          try {
            parsed = JSON.parse(req.body)
          } catch {
            return { code: 400, response: { message: 'Invalid JSON' } }
          }
          const normalized = normalizeSettings(parsed)
          persistIfChanged(this, normalized)
          return { code: 200, response: normalized }
        }
        return { code: 404, response: { message: 'Not Found' } }
      },
    }

    module.exports = plugin

実装時にはinitのinitialDataとstore.storeの公式挙動をサンプルで再確認する。initialDataが未定義の場合でも既定値へ正規化し、store未注入時のrequestは例外ではなく完全な既定設定を返す。不要な権限やsubscribe関数を追加しない。

- [ ] **Step 4: focused GREENと回帰を確認する**

Run:

    node --test tests/settings-plugin.test.js
    npm test
    node --check plugin/first-comment-big-settings/plugin.js

Expected: APIテスト全件PASS、全Nodeテストfail 0、構文check exit 0。

- [ ] **Step 5: REST APIプラグインをcommitする**

    git add plugin/first-comment-big-settings/plugin.js tests/settings-plugin.test.js
    git commit -m "feat: add settings plugin REST API"

---

### Task 4: 依存なし設定画面

**Files:**

- Create: plugin/first-comment-big-settings/index.html
- Create: plugin/first-comment-big-settings/style.css
- Create: plugin/first-comment-big-settings/script.js
- Create: tests/settings-page.test.js
- Consume: plugin/first-comment-big-settings/settings-core.js

**Interfaces:**

- Browser global: FirstCommentBigSettingsPage.createSettingsPageController(options)
- createSettingsPageController({ document, fetchImpl, settingsCore, endpoint })
- Returns: { load(): Promise<void>, save(event?): Promise<void> }
- DOM IDs: settings-form、theme、comment-font-size、first-comment-font-size、save、status。
- API endpoint default: http://localhost:11180/api/plugins/com.ckylab.first-comment-big-settings

- [ ] **Step 1: コントローラーの失敗テストを書く**

tests/settings-page.test.jsは外部DOMライブラリを使わず、value、valueAsNumber、disabled、textContentとaddEventListenerを持つ小さなfake element mapを作る。次をテストする。

- load GETはmethod GETを使用し、正規化したresponseを3入力へ反映する。
- load失敗はlight/32/64を表示し、固定の取得失敗文をstatus.textContentへ設定する。
- saveはselect.valueとnumber.valueAsNumberから完全な3項目を作りPUTする。
- save中はbutton.disabledがtrue、完了後はfalse。
- save成功はサーバー応答を再反映して「保存しました」を表示する。
- save失敗は入力を消さず「保存できませんでした」を表示する。
- submit eventのpreventDefaultを呼ぶ。
- script.jsとindex.htmlにinnerHTMLが存在しない。

PUT body assertion:

    assert.deepEqual(JSON.parse(fetchCall.options.body), {
      theme: 'dark',
      commentFontSize: 40,
      firstCommentFontSize: 80,
    })

- [ ] **Step 2: focusedテストを実行してREDを確認する**

Run:

    node --test tests/settings-page.test.js

Expected: MODULE_NOT_FOUND for plugin script.js。

- [ ] **Step 3: semantic HTMLと設定画面CSSを作る**

index.htmlはsettings-core.js、script.jsの順に読み込み、次のフォームを持つ。

    <h1>初コメBIG 設定</h1>
    <form id="settings-form">
      <label for="theme">テーマ</label>
      <select id="theme" name="theme">
        <option value="light">ライト</option>
        <option value="dark">ダーク</option>
      </select>

      <label for="comment-font-size">通常コメント文字サイズ</label>
      <span><input id="comment-font-size" type="number" min="16" max="64" step="1" value="32" /> px</span>

      <label for="first-comment-font-size">初コメ文字サイズ</label>
      <span><input id="first-comment-font-size" type="number" min="24" max="128" step="1" value="64" /> px</span>

      <button id="save" type="submit">保存</button>
      <p id="status" role="status" aria-live="polite"></p>
    </form>

style.cssはフォームの可読性とフォーカス表示だけを定義し、外部font、画像、UIライブラリを参照しない。

- [ ] **Step 4: UMD設定画面コントローラーを最小実装する**

script.jsはCommonJS exportとFirstCommentBigSettingsPage globalの両方を提供する。load/saveは内部で全例外を処理し、status.textContentを更新する。HTTP response.okを確認し、JSONのresponseをsettingsCore.normalizeSettingsへ渡す。saveはvalueAsNumberを使い、input.value文字列をAPIへ送らない。Content-Typeはapplication/jsonとする。

ブラウザ起動時はDOM要素が揃っていることを確認してcontrollerを生成し、form submitへsaveを登録してloadを開始する。固定文言以外をDOMへ挿入せず、innerHTMLを使用しない。

- [ ] **Step 5: focused GREEN、静的安全性、回帰を確認する**

Run:

    node --test tests/settings-page.test.js
    node --check plugin/first-comment-big-settings/script.js
    rg -n "innerHTML|Vue|React|Svelte|cdn|unpkg" plugin/first-comment-big-settings
    npm test

Expected: UIテストPASS、node --check exit 0、innerHTMLと外部UI依存の実装一致0件、全Nodeテストfail 0。

- [ ] **Step 6: 設定画面をcommitする**

    git add plugin/first-comment-big-settings/index.html plugin/first-comment-big-settings/style.css plugin/first-comment-big-settings/script.js tests/settings-page.test.js
    git commit -m "feat: add settings plugin page"

---

### Task 5: テンプレート設定クライアント

**Files:**

- Create: template/first-comment-big/settings-client.js
- Create: tests/settings-client.test.js

**Interfaces:**

- Browser global and CommonJS: FirstCommentBigSettingsClient
- Exports: DEFAULT_SETTINGS、normalizeSettings、settingsEqual、createSettingsClient。
- createSettingsClient(options):
  - rootElement: style.setProperty(name, value)を持つdocumentElement
  - fitCommentsToViewport: 設定変更後に呼ぶ関数
  - fetchImpl
  - setIntervalImpl
  - clearIntervalImpl
  - AbortControllerImpl
  - warn
  - endpoint default: 公式localhost plugin endpoint
  - pollIntervalMs default: 500
- Returns:
  - start(): Promise<void>。冪等。タイマーを登録し、即時GET完了後にresolveし、設定API失敗ではrejectしない。
  - stop(): void。冪等。タイマー解除、進行中abort、停止後適用防止。

- [ ] **Step 1: 正規化とCSS差分適用の失敗テストを書く**

tests/settings-client.test.jsに、setProperty呼び出し配列、fit回数、手動tickを持つfake scheduler、応答queueを持つfake fetchを作る。プラグインcoreと同じ境界値表でclient.normalizeSettingsも検証する。

差分テスト:

- 初期light/32/64応答ではsetProperty 0回、fit 0回。
- dark応答では背景・文字・区切り線の3変数だけを設定しfit 1回。
- commentFontSize 40だけの変更では--comment-font-size: 40pxだけを追加しfit 1回。
- firstCommentFontSize 80だけの変更では--first-comment-font-size: 80pxだけを追加しfit 1回。
- 同一応答の次tickではsetPropertyとfitが増えない。
- 複数変更時もすべてのsetProperty後にfitを1回だけ呼ぶ。

Expected dark calls:

    [
      ['--panel-background', '#0b0b0b'],
      ['--comment-text-color', '#ffffff'],
      ['--comment-border-color', '#333333'],
    ]

- [ ] **Step 2: ポーリング・障害・停止の失敗テストを書く**

次を独立テストにする。

- startが即時GETし、setIntervalImplへ500を渡す。
- fetch optionsがmethod GET、cache no-store、AbortController signalを持つ。
- GET中のtickはfetch回数を増やさない。
- HTTP error、fetch reject、json reject、不正response構造はlight/32/64へ戻す。
- dark/40/80適用後の障害は5変数を既定値へ戻してfitを1回呼ぶ。
- 同一失敗中はwarn 1回、正常復帰後の再失敗でwarn合計2回。
- API失敗でもstartとtick promiseはrejectしない。
- stopがintervalを解除し進行中signalをabortedにする。
- stop後に遅延responseが完了してもsetPropertyとfitを呼ばない。
- stop複数回でclear/abortを重複させず例外にならない。

- [ ] **Step 3: focusedテストを実行してREDを確認する**

Run:

    node --test tests/settings-client.test.js

Expected: MODULE_NOT_FOUND for settings-client.js。

- [ ] **Step 4: 独立UMDクライアントを最小実装する**

プラグイン未導入時にも読み込めるようplugin/settings-core.jsへ依存しない。DEFAULT_SETTINGSと同じ正規化規則を内部実装し、exportsへ公開する。

内部状態:

    let stopped = false
    let started = false
    let inFlight = false
    let intervalId = null
    let controller = null
    let failureActive = false
    let lastApplied = { ...DEFAULT_SETTINGS }

applySettings(next)はtheme変更時だけ3色変数、各size変更時だけ対応変数を設定し、1個以上変えた後だけfitCommentsToViewportを1回呼ぶ。pollOnceはinFlightまたはstoppedなら何もしない。正常応答でfailureActiveをfalseにし、失敗時はDEFAULT_SETTINGSをapplyして、failureActiveがfalseのときだけwarnする。finallyでinFlightとcontrollerを解除する。

startはstartedをtrueにして500ms intervalを登録し、await pollOnce()する。stopはstoppedをtrueにし、intervalをclearし、進行中controllerをabortする。AbortErrorとstop後の完了は警告・fallback・CSS適用を行わない。

- [ ] **Step 5: focused GREENと回帰を確認する**

Run:

    node --test tests/settings-client.test.js
    node --check template/first-comment-big/settings-client.js
    npm test

Expected: clientテストPASS、構文check exit 0、既存70件を含め全Nodeテストfail 0。

- [ ] **Step 6: 設定クライアントをcommitする**

    git add template/first-comment-big/settings-client.js tests/settings-client.test.js
    git commit -m "feat: add template settings client"

---

### Task 6: 既存script.jsとの最小接続

**Files:**

- Modify: template/first-comment-big/index.html: script読込部
- Modify: template/first-comment-big/script.js: module取得、生成、start、dispose
- Modify: tests/settings-client.test.js: 静的接続契約
- Do not modify: first-comment-core.js、gift-presentation.js、kick-gift-presentation.js、kick-emote-presentation.js、style.css

**Interfaces:**

- Consumes: window.FirstCommentBigSettingsClient.createSettingsClient。
- Injects: document.documentElementと既存fitCommentsToViewport。
- Holds: let settingsClient = null。
- dispose: settingsClient.stopとOneSDK.unsubscribeを別々のtry blockで実行する。

- [ ] **Step 1: 接続契約の失敗テストを追加する**

tests/settings-client.test.jsでindex.htmlとscript.jsを文字列として読み、次をassertする。

- index.htmlで./settings-client.jsが./script.jsより前、../__origin/js/onesdk.js参照は変更なし。
- script.jsがwindow.FirstCommentBigSettingsClientを取得する。
- createSettingsClientへdocument.documentElementとfitCommentsToViewportを渡す。
- settingsClient.start()をOneSDK.initialize promiseへ連結せず開始する。
- dispose内でsettingsClient.stop()を呼ぶ。
- 既存のcontainer.prepend、scrollHeight > clientHeight、lastElementChild.remove、MAX_COMMENT_ELEMENTS = 100が残る。
- applyGiftColorsのelement.style.backgroundColorとelement.style.colorが残る。

Run:

    node --test tests/settings-client.test.js

Expected: settings-client.jsのscript tagとscript.js接続がないため新しいassertだけFAIL。Task 5テストはPASS。

- [ ] **Step 2: index.htmlへscriptを1行追加する**

既存順序を保ち、OneSDKの後、script.jsの直前へ追加する。

    <script src="../__origin/js/onesdk.js"></script>
    <script src="./settings-client.js"></script>
    <script src="./script.js"></script>

- [ ] **Step 3: script.jsへ設定ライフサイクルだけを接続する**

先頭でwindow.FirstCommentBigSettingsClientを取得し、settingsClient変数を追加する。fitCommentsToViewport定義後に次の独立初期化を置く。

    function startSettingsClient() {
      if (!settingsClientFactory ||
          typeof settingsClientFactory.createSettingsClient !== 'function') {
        console.warn('[初コメBIG] 設定クライアントを読み込めないため既定表示を使用します。')
        return
      }
      try {
        settingsClient = settingsClientFactory.createSettingsClient({
          rootElement: document.documentElement,
          fitCommentsToViewport,
        })
        void settingsClient.start()
      } catch (error) {
        console.warn('[初コメBIG] 設定機能を開始できないため既定表示を使用します。', error)
      }
    }

startSettingsClientはinitialize()とは別に呼ぶ。設定クライアント欠落・生成失敗・start内部のAPI失敗をinitialize().catchへ渡さない。

disposeではdisposedの確定とpagehide listener解除後、OneSDK unsubscribeの前にsettingsClient.stopを専用try/catchで呼ぶ。stop失敗後もunsubscribeへ進み、unsubscribe失敗後もstop済みである構造にする。既存コメント処理の条件、分岐、DOM生成、prepend、fit処理を変更しない。

- [ ] **Step 4: focused GREEN、差分監査、回帰を確認する**

Run:

    node --test tests/settings-client.test.js
    npm test
    git diff --check
    git diff -- template/first-comment-big/index.html template/first-comment-big/script.js

Expected: focusedテストと全NodeテストPASS。index.htmlは1 script追加だけ。script.js差分は設定ライフサイクルだけで、receiveComments、renderModel、applyGiftColors、fitCommentsToViewportの既存本体に機能差分がない。

- [ ] **Step 5: 最小接続をcommitする**

    git add template/first-comment-big/index.html template/first-comment-big/script.js tests/settings-client.test.js
    git commit -m "feat: connect live template settings"

---

### Task 7: ブラウザfixture回帰・動的設定確認

**Files:**

- Modify: tests/first-comment-big-browser-fixture.html
- Consume unchanged production modules from template/first-comment-big/

**Interfaces:**

- Adds fake settings API state: window.__fixtureSettingsApi。
- Adds controls: light、dark、通常40px、BIG80px、同一設定、API失敗、設定fixture検証。
- Preserves all existing comment emission buttons and fake OneSDK behavior.

- [ ] **Step 1: 新しいfixtureチェックを先に追加してREDを確認する**

設定チェック欄と結果一覧を追加し、まだ存在しないwindow.__fixtureSettingsApiを使って次のassertを実行するボタンを作る。

- 初期computed CSSがlight / 32px / 64px。
- dark後に#0b0b0b / #ffffff / #333333。
- 通常40pxとBIG80px。
- 同一設定で対象CSS setProperty回数が増えない。
- サイズ変更だけで表示中DOMが再fitされる。
- TwitCasting giftとKick giftのelement.style.backgroundColor/colorがテーマ前後で同じ。
- API失敗後も新しい通常コメントが先頭へ追加される。
- 既存の通常、BIG、Kickエモート、owner、prepend順序が維持される。
- settingsClient.stopが例外でもOneSDK.unsubscribeが実行される。
- OneSDK.unsubscribeが例外でもsettingsClient.stopによってGETが停止する。

Run:

    python -m http.server 4173 --bind 127.0.0.1

Open: http://127.0.0.1:4173/tests/first-comment-big-browser-fixture.html

Expected RED: 設定API fakeが未定義で設定チェックが失敗する。既存コメント操作は引き続き動作する。サーバーは確認後Ctrl+Cで停止する。

- [ ] **Step 2: production script読込前にfake fetchを実装する**

window.__fixtureSettingsApiへ次を持たせる。

    {
      settings: { theme: 'light', commentFontSize: 32, firstCommentFontSize: 64 },
      fail: false,
      getCount: 0,
      set(next) { this.settings = structuredClone(next) },
    }

既存window.fetchを保存し、URLがsettings endpointの場合だけfake Response相当の{ ok, json() }を返す。fail時はPromise.reject(new Error('fixture settings API failure'))。他URLは元のfetchへ委譲する。production script群ではsettings-client.jsをscript.js直前に読み込む。

CSSStyleDeclaration.setPropertyのうち5設定変数だけを数えるfixture計測をproduction読込前に設置する。計測は表示確認専用で、productionコードへfixture hookを追加しない。

さらにFirstCommentBigSettingsClient.createSettingsClientをfixture内だけでラップし、実controller.stopを呼んだ後に例外を投げる切替を用意する。fake OneSDK.unsubscribeにも記録後に例外を投げる切替を用意する。productionコードは変更しない。

- [ ] **Step 3: 操作ボタンと非同期検証をGREENにする**

各設定ボタンはfake stateを変更し、600ms待って次回tick後のcomputed styleを確認する。サイズ変更後fitは、表示領域ぎりぎりまで既存コメントを入れてからsizeを増やし、新規コメントを投入せずchildElementCountが減ることで確認する。同一設定はsetProperty countが600ms後も増えないことで確認する。

gift色は既存のTwitCasting有料giftとKick BASIC/LEVEL_UPを描画し、要素のstyle.backgroundColor/colorを保存してdarkへ変え、同じ値であることをassertする。API失敗はdark/40/80適用後にfail=trueへし、600ms後にlight/32/64へ戻ることと、OneSDK.emitComments後に先頭へ通常コメントが増えることを確認する。

- [ ] **Step 4: desktopと390px幅で全fixture項目を実測する**

Run server as Step 1 and check both normal viewport and width 390px。

Expected GREEN:

- light / 32 / 64
- dark反映
- 通常文字サイズ変更
- BIG文字サイズ変更
- 同一設定で再適用なし
- size変更後fit
- TwitCasting gift色維持
- Kick gift色維持
- 通常コメント
- 初コメBIG
- Kickエモート
- TwitCasting/Kick owner
- 新着が上、最古が下から削除
- API失敗後もコメント追加可能
- pagehide後は設定GET回数が増えず、OneSDK subscriberも解除
- stop例外時もunsubscribe済み、ページ再読込後のunsubscribe例外時もGET停止
- 意図的に発生させたcleanup警告を除き、関連Console error 0件

- [ ] **Step 5: fixture差分とNode回帰を確認する**

Run:

    npm test
    git diff --check
    git diff -- tests/first-comment-big-browser-fixture.html

Expected: 全Nodeテストfail 0。fixtureの既存コメントデータと操作を削除せず、設定用fakeと操作だけが追加されている。

- [ ] **Step 6: fixture拡張をcommitする**

    git add tests/first-comment-big-browser-fixture.html
    git commit -m "test: cover live settings in browser fixture"

---

### Task 8: READMEへ設定導入・障害挙動を反映

**Files:**

- Modify: template/first-comment-big/README.md
- Modify: template/first-comment-big/README.txt
- Do not modify: root README、Probe docs、RAW、ZIP、dist

**Interfaces:**

- Documents plugin UID、3設定、範囲、既定値、反映時間、任意導入、fallback、gift色維持、停止方法。
- Does not claim permissions実機成功 until Task 10 passes。

- [ ] **Step 1: ドキュメント契約のREDスキャンを行う**

Run:

    rg -n "com\.ckylab\.first-comment-big-settings|500ms|16.*64|24.*128|light|dark|プラグイン.*無効|gift" template/first-comment-big/README.md template/first-comment-big/README.txt

Expected RED: 現行READMEには設定プラグインUID、両範囲、500ms反映、無効時fallbackの全項目が揃っていない。

- [ ] **Step 2: 両READMEへ同じ利用契約を追記する**

記載する内容:

- 設定プラグインは任意で、未導入でも従来のlight / 32px / 64pxでコメント表示を続ける。
- UIDはcom.ckylab.first-comment-big-settings。
- テーマlight/dark、通常16〜64整数、初コメ24〜128整数。
- 保存後は通常最大約0.5秒でOBSへ反映し、OBS再読み込み不要。
- プラグイン未導入、無効、起動前、通信・JSON・値異常時は既定値へ戻る。
- 設定障害はOneSDKコメント購読を止めない。
- TwitCasting/Kick giftのイベント固有背景色・文字色はテーマ変更後も維持する。
- プラグインの導入、有効化、設定画面の開き方は公式プラグイン画面の操作として説明する。
- permissions: []はTask 10の実機確認前には正式対応済みと断言しない。

既存の判定、匿名履歴、gift、Kickエモート、owner、安全化、CSSカスタマイズの説明は削除・意味変更しない。

- [ ] **Step 3: ドキュメントGREENと差分限定を確認する**

Run:

    rg -n "com\.ckylab\.first-comment-big-settings|500ms|16.*64|24.*128|light|dark|プラグイン.*無効|gift" template/first-comment-big/README.md template/first-comment-big/README.txt
    git diff --check
    git diff -- template/first-comment-big/README.md template/first-comment-big/README.txt

Expected: 必須項目が両方に現れ、既存仕様の削除やほかのファイル差分がない。

- [ ] **Step 4: README更新をcommitする**

    git add template/first-comment-big/README.md template/first-comment-big/README.txt
    git commit -m "docs: document First Comment BIG settings"

---

### Task 9: 全回帰検証と差分監査

**Files:**

- Verify all intentional files listed in File Map。
- Verify unchanged: Probe、RAW、既存ZIP、dist、first-comment-core.js、gift-presentation.js、kick-gift-presentation.js、kick-emote-presentation.js、style.css。
- No new implementation in this task。

**Interfaces:**

- Produces: 自動テスト、構文、静的安全性、diff、commit境界の証跡。
- Failure rule: 失敗をこのタスクで場当たり修正せず、原因を所有するTaskへ戻りRED/GREENを再実行する。

- [ ] **Step 1: 全Nodeテストを実行する**

Run:

    npm test

Expected: 基準の既存70テストをすべて含み、追加settingsテストも含めてtests件数が70より増加、passがtestsと同数、fail 0、cancelled 0、skipped 0。

- [ ] **Step 2: 全JavaScriptの構文を検証する**

PowerShell:

    $settingsJsFiles = rg --files -g '*.js'
    foreach ($settingsJsFile in $settingsJsFiles) {
      node --check $settingsJsFile
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

Expected: plugin、template、tests、既存Probeを含む全JSがexit 0。

- [ ] **Step 3: whitespace、HTML安全性、依存、gift色を静的確認する**

Run:

    git diff --check a498a52..HEAD
    rg -n "innerHTML" plugin/first-comment-big-settings template/first-comment-big
    rg -n "Vue|React|Svelte|WebSocket|XMLHttpRequest|sendBeacon" plugin/first-comment-big-settings template/first-comment-big/settings-client.js
    rg -n "style\.backgroundColor|style\.color" template/first-comment-big/script.js
    rg -n -- "--panel-background|--comment-text-color|--comment-border-color|--comment-font-size|--first-comment-font-size" template/first-comment-big/settings-client.js

Expected: diff check exit 0。innerHTML、外部UI framework、WebSocketなどの一致0件。既存giftインライン2色が残る。settings-clientが指定5変数だけを扱う。

- [ ] **Step 4: 変更ファイル範囲を監査する**

Run:

    git diff --name-status a498a52..HEAD
    git status --short
    git log --oneline --decorate a498a52..HEAD

Expected: File Mapの意図したコード、テスト、README、permissions検証記録、計画・設計commitだけ。Probe、RAW、ZIP、distと禁止された既存モジュールに差分なし。作業ツリーはクリーン。

- [ ] **Step 5: 既存ロジック非変更をcommit単位で確認する**

Run:

    git diff --exit-code a498a52..HEAD -- template/first-comment-big/first-comment-core.js
    git diff --exit-code a498a52..HEAD -- template/first-comment-big/gift-presentation.js
    git diff --exit-code a498a52..HEAD -- template/first-comment-big/kick-gift-presentation.js
    git diff --exit-code a498a52..HEAD -- template/first-comment-big/kick-emote-presentation.js
    git diff --exit-code a498a52..HEAD -- template/first-comment-big/style.css

Expected: 5コマンドすべてexit 0。script.jsの既存コメント処理部分はTask 6の差分レビューで不変を確認済み。

- [ ] **Step 6: 回帰検証タスクを閉じる**

自動検証だけで新差分を作らないため、全チェックPASSならcommitしない。修正が必要なら該当Taskへ戻り、そのTaskのfocused RED/GREEN、npm test、commitをやり直してからTask 9全体を再実行する。

---

### Task 10: わんコメ／OBS実機確認とpermissions最終ゲート

**Files:**

- Verify: plugin/first-comment-big-settings/
- Verify: template/first-comment-big/
- Modify only after successful real-device permission gate: docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md
- Do not create: 正式配布ZIP、tag、Release

**Interfaces:**

- Consumes: Task 1〜9が全PASSした作業ツリー。
- Produces: permissions: []実機受理の証跡とOBS動作確認。
- Hard stop: permissions: []が拒否された場合、commentsその他の不要権限へ変更せず、公式仕様または開発者チャンネルの回答待ちで停止する。

- [ ] **Step 1: プラグインなしの従来表示を確認する**

わんコメで設定プラグインを未導入または無効の状態にし、現在のtemplate/first-comment-big/をOBSブラウザソースで開く。通常コメントと初コメを1件ずつ投入する。

Expected: light、通常32px、初コメ64px。コメントは新着が上。設定API失敗警告は同一失敗期間に1回だけで、OneSDK接続とコメント追加は止まらない。

- [ ] **Step 2: 開発中プラグインをわんコメへ導入する**

公式プラグイン導入手順に従い、plugin/first-comment-big-settings/の開発内容を使用する。正式配布ZIPは作成せず、わんコメの開発・ローカル導入方法でフォルダを指定または公式のプラグイン配置先へ開発コピーする。既存配布ZIPとdistは使わない。

Expected: UID com.ckylab.first-comment-big-settings、version 1.0.0、permissions: []のプラグインとして認識され、有効化できる。

- [ ] **Step 3: permissions: []実機受理を判定する**

わんコメのプラグイン一覧、plugin.log、設定画面リンクを確認する。

PASS条件:

- プラグインがエラーなく読み込まれる。
- 有効化状態を維持できる。
- 設定画面を開ける。
- GET endpointがcode 200と完全設定を返す。
- permissions不足または空配列拒否のエラーがplugin.logにない。

FAIL条件が1つでもあれば、plugin.jsへcommentsや他権限を追加せず実装を停止する。わんコメversion、plugin.logの該当エラー、確認手順を記録し、公式ドキュメントまたは開発者チャンネルへ必要権限仕様を照会する。回答が得られるまでStep 4以降、正式ZIP、tag、Releaseへ進まない。

- [ ] **Step 4: 設定画面と即時反映を確認する**

設定画面で順に操作する。

1. 初期light / 32 / 64。
2. lightからdarkへ保存。
3. OBSを再読み込みせず0.5秒程度で背景#0b0b0b、通常文字#ffffff、区切り線#333333へ変わる。
4. 通常文字を32から40へ保存し、通常コメントだけ40pxになる。
5. 初コメ文字を64から80へ保存し、初コメだけ80pxになる。
6. OBS再読み込みなしで各変更が反映される。
7. 範囲外や小数を入力した場合、画面とAPIの正規化規則から逸脱した値が保存されない。

- [ ] **Step 5: 既存表示とgift色を確認する**

dark / 40 / 80状態で、通常、初コメ、TwitCasting gift、Kick BASIC、Kick LEVEL_UP、Kickエモート、TwitCasting owner、Kick ownerを表示する。

Expected:

- giftは初コメBIGにならない。
- TwitCasting/Kick giftのイベント固有backgroundColor/colorがdarkテーマに上書きされない。
- 通常とBIGだけが設定sizeへ従う。
- エモート、owner画像、HTML安全化、新着上・古い下の順序、高さベース削除が従来どおり。

- [ ] **Step 6: 無効化フォールバックと継続性を確認する**

dark / 40 / 80を表示中に設定プラグインを無効化する。

Expected: 次回ポーリング後にlight / 32 / 64へ戻る。OBSブラウザソースを再読み込みせず、その後に送った通常コメントと初コメが表示される。OneSDK購読は継続し、Consoleを500msごとの同一エラーで埋めない。

再度プラグインを有効化し、保存済み設定がstoreから復元されて再反映されることも確認する。

- [ ] **Step 7: pagehide/disposeを確認する**

OBSブラウザソースを閉じるか再読み込みし、pagehide後に設定GETが継続しないこととOneSDK unsubscribeが行われることを確認する。stop失敗とunsubscribe失敗を互いに独立させる例外経路はTask 6のNodeテストとTask 7のfixture結果を実機記録へ併記する。

- [ ] **Step 8: permissions実機PASSを設計書へ記録してcommitする**

Task 10 Step 3がPASSした場合だけ、設計書5.2へ確認日、わんコメversion、permissions: []で正常読込・有効化・REST GET成功を記録する。「不要権限を追加しない」方針は残す。

Run:

    git diff --check
    git diff -- docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md
    git add docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md
    git commit -m "docs: record settings plugin permissions verification"

Expected: 実機確認記録だけのcommit。正式ZIP、push、tag、Releaseは存在しない。

- [ ] **Step 9: 実機確認後の停止点を報告する**

報告する実測値:

- わんコメversion
- OBSブラウザソース条件
- permissions: []受理結果
- light/dark、32→40、64→80の反映
- gift色、既存表示、fallback、コメント継続
- npm test総件数とfail 0
- 全JS node --check
- git diff --check
- git status --short

ここで停止し、正式配布ZIP、commit追加、push、tag、Releaseはユーザーの次の指示まで行わない。

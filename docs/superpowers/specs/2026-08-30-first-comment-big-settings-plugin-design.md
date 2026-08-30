# 初コメBIG 設定プラグイン設計

## 1. 目的と範囲

「初コメBIG」に、わんコメ公式プラグイン機構を使った設定機能を追加する。設定はプラグインの defaultState / store に永続保存し、テンプレートはプラグイン専用REST APIを500ms間隔でGETする。ローカルAPIが通常応答する条件では、保存後の次回ポーリングから最大約0.5秒でOBS表示へ反映する。OBSブラウザソースの再読み込みは不要とする。

本設計で扱う設定は、テーマ、通常コメント文字サイズ、初コメ文字サイズの3項目だけである。本書は実装前の設計を確定するものであり、本書作成時点ではプラグイン、テンプレート、テスト、Probe、RAW、ZIP、distを変更しない。

## 2. 採用方式

「わんコメ公式プラグイン＋プラグイン専用REST API取得方式」を採用する。

- 公式プラグインの状態ストアを使い、設定の保存先とライフサイクルをわんコメ内で完結させる。
- 設定画面とOBS内テンプレートは、固定されたlocalhost REST API契約だけを共有する。
- 設定取得をOneSDKコメント購読から分離し、設定障害をコメント表示へ波及させない。
- 500msポーリングで要件を満たし、push接続や再接続制御を追加しない。

localStorage共有、設定ファイルの直接読み書き、WebSocketによるpush通知は採用しない。ブラウザコンテキスト間の共有を前提にせず、公式ストアと公式APIを唯一の設定経路とする。

## 3. 公式仕様との対応

プラグインクラスは公式仕様に従い、メタデータ、defaultState、store、request(req) を持つ。defaultStateで初期値を定義し、storeで永続状態を読み書きする。プラグインが有効な間、次のエンドポイントを使用する。

    http://localhost:11180/api/plugins/com.ckylab.first-comment-big-settings

参考資料:

- [わんコメ プラグイン開発資料](https://onecomme.com/docs/developer/plugin/)
- [公式サンプルのプラグイン実装](https://github.com/OneComme/OneCommeOrderSpeechPlugin/blob/main/src/index.ts)
- [公式サンプルのREST API利用](https://github.com/OneComme/OneCommeOrderSpeechPlugin/blob/main/static/script.js)

公式サンプルのVueやTypeScriptなどの依存構成は導入せず、公式の状態保存とREST契約だけを踏襲する。設定画面はHTML、CSS、JavaScriptで構成する。

## 4. 設定モデルと正規化

永続化およびAPIで扱う値は常に次の完全なオブジェクトとする。

    {
      "theme": "light",
      "commentFontSize": 32,
      "firstCommentFontSize": 64
    }

| キー | 型 | 既定値 | 受理する値 |
| --- | --- | ---: | --- |
| theme | string | light | light または dark |
| commentFontSize | number | 32 | 16以上64以下の有限な整数 |
| firstCommentFontSize | number | 64 | 24以上128以下の有限な整数 |

正規化は項目ごとに行う。不正な1項目が、ほかの妥当な項目を無効にしてはならない。欠落値と不正値はその項目の既定値へ戻し、未知キーは保存結果と応答から除外する。

文字サイズは typeof value === 'number'、Number.isFinite(value)、Number.isInteger(value)、範囲内の全条件を満たす場合だけ受理する。数値文字列、空文字列、NaN、Infinity、小数、範囲外、不正文字列は受理しない。themeは完全一致だけを受理し、大文字小文字変換や未知名からの推測をしない。

プラグイン側と設定画面側は同じ規則で検証する。信頼境界であるプラグイン側の検証を正とし、ブラウザ側の検証は早期フィードバックのために重ねて行う。

## 5. プラグイン設計

### 5.1 ディレクトリ

後続実装で次を追加する。

    plugin/first-comment-big-settings/
    ├── plugin.js
    ├── settings-core.js
    ├── index.html
    ├── style.css
    └── script.js

- plugin.js: 公式プラグインクラス、メタデータ、状態保存、REST要求処理。
- settings-core.js: 正規化と比較を行う依存なしのCommonJS／ブラウザ両対応モジュール。
- index.html: 「初コメBIG 設定」画面。
- style.css: 設定画面専用の最小スタイル。
- script.js: GET、フォーム反映、入力検証、PUT、状態表示。

実装と実行に外部パッケージを追加しない。

### 5.2 メタデータ

| 項目 | 値 |
| --- | --- |
| name | 初コメBIG 設定 |
| uid | com.ckylab.first-comment-big-settings |
| version | 1.0.0 |
| author | CKY Lab |
| url | http://localhost:11180/plugins/com.ckylab.first-comment-big-settings/index.html |
| permissions | `[]`（公式型定義および実機で受理確認済み） |

コメントや配信イベントを購読しないため、`permissions: []` を使用する。`@onecomme.com/onesdk` の公式型定義で空配列が受理されることに加え、2026年8月31日のTask 10で、わんコメ実機が `permissions: []` のプラグインを正常に読み込んで有効化できることを確認した。

2026年8月30日に公開npmパッケージ `@onecomme.com/onesdk@9.0.0-alpha.1` を確認した。`OnePlugin.permissions` は `permissions: (SendType | PluginFilterEvent)[];` という通常の配列型であり、TypeScript上で `[]` は代入可能である。公式ドキュメントはpermissionsを必須の「使用するデータタイプを配列で記載する」項目とし、公式サンプルは非空の `['waitingList']` を使うが、空配列の実機受理を保証していなかった。request(req)のプラグイン専用REST APIはイベント購読とは別契約である。Task 10の実機確認で空配列が受理されたため、この検証ゲートは通過した。

検証時に空配列が受理されない場合も、便宜的に `comments` やその他の不要な権限を追加せず実装を止める方針としていたが、実機では追加権限なしで受理された。defaultStateには4章の既定設定を指定する。

### 5.3 状態初期化

起動時に store.store を正規化する。未保存、旧形式、不正値、余分なキーがある場合は完全な正規化済みオブジェクトへ置き換える。保存前後の比較は3項目の値で行い、同一なら不要なストア書き込みをしない。正規化関数は入力を変更せず、新しいオブジェクトを返す。

### 5.4 REST API

GETとPUTだけを提供する。

GET:

1. store.store を読み込んで正規化する。
2. 保存値と正規化結果が異なる場合だけストアを修復する。
3. code 200と正規化済み設定をresponseに返す。

PUT:

1. req.body が文字列の場合だけJSONとして解析し、plain Objectの場合は解析済みの値としてそのまま使用する。
2. 解析結果を完全な設定スナップショットとして項目別に正規化する。
3. 現保存値と異なる場合だけ store.store へ保存する。
4. code 200と正規化済み設定をresponseに返す。

現行のわんコメ実機では、PUTのreq.bodyがplain Objectとして渡されることを確認済みである。互換性のため文字列JSONも受理する。構文上不正なJSON文字列では保存状態を変えず、code 400と固定エラーメッセージを返す。解析後または解析済みの値が設定オブジェクトでない本文は、全項目を既定値へ正規化して保存する。GET/PUT以外は状態を変えずcode 404を返す。APIはコメント、ユーザー、配信情報を扱わない。

## 6. 設定画面

画面構成は次のとおりとする。

    初コメBIG 設定

    テーマ
    [ ライト ▼ ]

    通常コメント文字サイズ
    [ 32 ▲▼ ] px

    初コメ文字サイズ
    [ 64 ▲▼ ] px

    [ 保存 ]

- テーマはselectとし、値light/dark、表示「ライト」/「ダーク」とする。
- 通常文字サイズは input type="number" min="16" max="64" step="1" とする。
- 初コメ文字サイズは input type="number" min="24" max="128" step="1" とする。
- 初期表示時にGETし、成功時は正規化値をフォームへ反映する。
- 初期GET失敗時は既定値を表示し、取得失敗を画面内へ表示する。
- 保存時はnumber入力を valueAsNumber で数値として読み、ブラウザ側で検証してから完全な設定オブジェクトをPUTする。input.valueの文字列をそのままAPIへ渡さない。
- PUT成功時はサーバー応答を再反映し、保存完了を表示する。
- PUT失敗時は入力を消さず、保存失敗を表示する。
- 処理中は保存ボタンを無効化して二重送信を防ぐ。

受信文字列をinnerHTMLへ渡さない。状態メッセージは固定文言をtextContentで表示する。

## 7. テンプレート側設計

### 7.1 モジュール境界

後続実装で template/first-comment-big/settings-client.js を追加し、ブラウザとNodeテストの両方で使える依存なしモジュールとする。index.htmlはこれをscript.jsの前に読み込む。

設定クライアントの責務は、RESTポーリング、応答正規化、前回値との比較、CSS変数の差分更新、表示領域再調整要求、停止処理だけとする。初コメ判定、コメントモデル、gift判定、DOM生成、OneSDK初期化・購読・解除は移さない。

設定クライアント生成時に、CSS変数を設定するルート要素と、変更完了時のコールバックを注入する。script.jsは既存fitCommentsToViewport関数をそのコールバックとして渡す。設定クライアントからscript.jsの非公開関数をグローバル公開せず、Nodeテストではスパイ関数を注入して呼び出し回数と順序を検証する。

### 7.2 ポーリングと反映

テンプレート起動時に即時GETを1回行い、その後setIntervalで500msごとにGETする。cacheはno-storeとする。前回要求が完了していない場合は次のtickをスキップし、重複要求を開始しない。

ローカルAPIが500ms未満で応答する通常条件では、保存後の次回tickから最大約0.5秒で反映する。通信遅延時は応答時間分だけ遅れる。

設定取得はOneSDK.ready/setup/subscribe/connectを待たず、これらからも待たれない。設定API例外をOneSDK初期化Promiseへ伝播させない。

### 7.3 フォールバック

次の場合、取得結果全体を light / 32 / 64 として処理する。

- プラグインが未導入、無効、起動前
- fetch失敗、HTTPエラー
- JSON解析失敗
- API応答構造が不正

応答構造は妥当だが個別値が不正な場合は、不正項目だけを既定値へ戻す。一度正常値を適用した後の一時的な取得失敗でも直前値を維持せず、指定された既定値へ戻す。

失敗は設定クライアント内で完結させる。コメント購読を解除せず、既存disposed状態を変更せず、OneSDK初期化失敗として記録せず、コメント描画を継続する。500msごとの同一エラーでConsoleを埋めないよう、失敗状態へ遷移した最初の1回だけ警告し、正常復帰後に再度失敗した場合だけもう一度警告する。

### 7.4 CSS変数の差分適用

初期適用値は既存CSSと同じ light / 32 / 64 とする。前回適用値を保持し、変わった項目に対応する変数だけをdocument.documentElement.style.setPropertyで更新する。

| 設定 | 更新するCSS変数 |
| --- | --- |
| light | --panel-background: #ffffff、--comment-text-color: #000000、--comment-border-color: #d8d8d8 |
| dark | --panel-background: #0b0b0b、--comment-text-color: #ffffff、--comment-border-color: #333333 |
| commentFontSize | --comment-font-size: 整数px |
| firstCommentFontSize | --first-comment-font-size: 整数px |

同じ設定の再取得ではsetPropertyを呼ばず、表示領域も再調整しない。1回の取得で1項目以上変わった場合は、全変数の更新後に既存fitCommentsToViewport()を1回だけ呼ぶ。文字サイズ増加後の古いコメント削除は既存の高さベース規則へ委ねる。

### 7.5 gift色の保護

TwitCasting giftとKick BASIC / LEVEL_UP giftは、既存処理が各コメント要素へ設定するstyle.backgroundColorとstyle.colorを維持する。テーマ適用はルートの5つのCSS変数だけを変更し、要素のインラインスタイルを削除・更新しない。

gift背景色・文字色をテーマCSSで指定せず、important指定でインライン色を上書きする規則も追加しない。共通の区切り線はテーマ変数へ従うが、gift固有の背景色と文字色はテーマ変更の影響を受けない。

### 7.6 停止

停止処理は冪等にする。

1. 500msタイマーを解除する。
2. 進行中GETをAbortControllerで中止する。
3. 停止後に完了した非同期処理がCSSや表示領域を変えないよう停止フラグを確認する。

既存pagehide/disposeから設定クライアントを停止する。OneSDK購読解除とポーリング停止は相互依存させず、片方の失敗で他方を省略しない。

## 8. 既存機能との非干渉

後続実装では次を変更しない。

- 通常ユーザーのisFirstTime判定
- TwitCasting匿名履歴
- gift優先順位とgiftの初コメBIG除外
- TwitCasting gift処理
- Kick BASIC / LEVEL_UP gift処理
- Kickエモート処理
- TwitCasting/Kick配信者本人判定
- textContent、テキストノード、URL検証などのHTML安全化
- 新着を先頭へ追加し、古いコメントを下端から削除する表示順
- scrollHeightとclientHeight、安全上限による高さベース削除

設定変更後に既存fitCommentsToViewport()を呼べるようにする以外、コメント処理フローへ設定分岐を入れない。

## 9. テスト設計

既存Nodeテスト70件を維持し、次を追加する。

### 9.1 正規化

- light/darkを受理する。
- 不明theme、型違い、欠落themeをlightへ戻す。
- 通常文字サイズ16/32/64を受理する。
- 通常文字サイズ15/65/NaN/Infinity/小数/数値文字列/不正文字列を32へ戻す。
- 初コメ文字サイズ24/64/128を受理する。
- 初コメ文字サイズ23/129/NaN/Infinity/小数/数値文字列/不正文字列を64へ戻す。
- 不正な1項目がほかの妥当値を無効にしない。
- 未知キーを結果へ残さない。

### 9.2 プラグインAPI

- 初期GETが既定設定を返す。
- 妥当なPUTが完全な設定を保存して返す。
- PUTでも正規化し、不正値を保存しない。
- 不正JSONでは400となり直前値を維持する。
- GET時に不正な保存状態を修復する。
- 同一設定で不要なストア書き込みをしない。
- GET/PUT以外は404となり状態を変更しない。

### 9.3 設定クライアント

- 即時GET後、500ms間隔で取得する。
- API未導入、HTTPエラー、fetch例外、不正JSON、不正応答で既定値を適用する。
- API失敗時もコメント表示を継続する。
- 同一設定の再取得でCSSとfitCommentsToViewport()を再適用しない。
- 各設定の変更で対象変数だけを更新する。
- 変更後、全変数適用後にfitCommentsToViewport()を1回実行する。
- 要求中の次tickで重複GETしない。
- pagehide/disposeでポーリングと進行中要求を停止する。
- 複数回停止しても例外にならず、停止後の応答を適用しない。

### 9.4 ブラウザfixture

- light / 32 / 64の初期表示。
- darkが再読み込みなしで反映される。
- 2つの文字サイズが独立して反映される。
- 同一設定で不要な再調整をしない。
- BIGや長文の文字サイズ変更後も縦方向へ収まる。
- TwitCasting/Kick giftの背景色と文字色がテーマ変更前後で同じである。
- 通常コメント、初コメBIG、gift、Kickエモート、配信者本人、表示順が既存どおりである。
- 設定API失敗後も新しいコメントが表示される。

偽APIとfixtureデータは本番テンプレートや配布物へ含めない。

### 9.5 回帰検証

実装時にnpm test、全JavaScriptへのnode --check、git diff --checkを実行する。既存70件がすべて成功すること、設定処理がOneSDK購読解除を呼ばないこと、テーマが5つの既存CSS変数以外を変更しないこと、giftのインライン色を上書きしないことを差分レビューする。

## 10. 障害境界と安全性

- fetch、HTTP判定、JSON解析、正規化、CSS適用の例外をコメント購読へ伝播させない。
- 設定障害をOneSDK初期化失敗として扱わず、購読を解除しない。
- APIへコメント、ユーザー、配信データを送らない。
- PUTは既知の3項目だけを保存し、未知キーやプロトタイプをコピーしない。
- 設定値からHTMLを生成せず、設定画面はtextContentまたはフォームvalueを使う。
- 公式localhostエンドポイントだけを使用し、外部へ設定を送らない。

## 11. 非目標

- 名前表示ON/OFF
- アイコン表示ON/OFF
- 初コメBIG ON/OFF
- サービス別テーマ
- OSダークモード自動追従
- カラーピッカー
- フォント変更
- WebSocketによるpush通知
- 既存判定、匿名履歴、gift、エモート、配信者本人、安全化、表示順の変更
- 配布ZIP生成
- 正式配布、タグ、Release

## 12. 後続実装の完了条件

1. プラグインが3項目だけを公式ストアへ正規化して永続保存する。
2. 設定画面がGET/PUTを使い、ブラウザとプラグインの両方で検証する。
3. テンプレートが500ms間隔で取得し、通常条件で保存後最大約0.5秒から更新する。
4. 同一値ではCSS変数と表示領域を再適用しない。
5. 変更時に5つの既存CSS変数だけを更新し、fitCommentsToViewport()を1回実行する。
6. 設定障害でlight / 32px / 64pxへ戻り、コメント表示を継続する。
7. TwitCasting/Kick giftのイベント固有背景色・文字色を維持する。
8. pagehide/disposeでポーリングを停止する。
9. 既存Nodeテスト70件と追加テストがすべて成功する。
10. 8章の既存ロジックへ機能変更がないことを差分レビューで確認する。

入力型、範囲、API応答、フォールバック、反映タイミング、差分適用、停止処理、gift色の優先順位はすべて本書で確定した。

## 13. Task 10 実機確認結果

2026年8月31日に、わんコメとOBSを使った実機確認を実施し、次を確認した。

- `permissions: []` のプラグインが正常に読み込まれ、有効化できる。
- 設定画面を開くことができ、REST GET/PUTが正常に動作する。
- プラグインをOFFにすると、OBSブラウザソースを再読み込みせずlight / 32 / 64へ戻る。
- プラグインを再度ONにすると、保存済み設定へ戻る。
- 設定画面からlight / darkを保存すると、OBSブラウザソースを再読み込みせず反映される。
- 通常コメント文字サイズと初コメ文字サイズの変更が、その場で反映される。
- 設定の保存、プラグインのON/OFF、設定反映中もコメント表示が継続する。

実機確認中に判明したREST境界の問題は、`95771df`（PUTの解析済みbody対応）、`0b98250`（設定画面のREST response envelope対応）、`d50430a`（テンプレート設定クライアントのREST response envelope対応）で修正済みである。

ダークテーマ時の無料gift配色、任意背景色、任意文字色、その他のテーマエディタ機能は今回変更していない。無料giftのダークテーマ対応は独立した後続タスクとして扱う。

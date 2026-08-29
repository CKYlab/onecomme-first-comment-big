# 初コメBIG v1.0 Design

## 目的と範囲

わんコメのOneSDKから受信したコメント本文だけをOBS向け透過画面へ表示し、その配信での初回コメントだけを大きくする。本番テンプレートは既存の調査用OneSDK Probeと分離し、Probeのファイル、調査資料、未追跡の配布物を変更・削除しない。

v1.0では設定画面、名前・アイコン表示、サービス別装飾、効果音、読み上げ、外部送信、Analytics、通常ユーザーの独自履歴、未検証サービス固有ロジックを実装しない。配布ZIPの生成、Gitコミット、GitHub公開も今回の範囲外とする。

## ディレクトリ構成

本番テンプレートを `template/first-comment-big/` に新設する。既存Probeはリポジトリ直下に維持し、移動による既存リンクや検証手順への影響を避ける。

```text
template/first-comment-big/
├── index.html
├── style.css
├── first-comment-core.js
├── script.js
├── template.json
├── README.md
└── README.txt
```

本番テンプレートの詳しい説明は同ディレクトリの `README.md`、わんコメへ同梱する短い説明は `README.txt` に記載する。リポジトリ直下のProbe用 `README.md` は変更しない。Nodeテストとブラウザfixtureは既存の `tests/` 以下へ追加する。

## コンポーネント

`first-comment-core.js` はブラウザとCommonJSの双方で利用できる依存なしUMDモジュールとする。次の責務をDOMおよびOneSDKから分離する。

- コメントデータの安全な表示モデル生成
- gift優先除外を含むBIG判定
- TwitCasting匿名キーの生成
- 匿名履歴の読み込み、記録、配信単位の上限管理
- 永続ストレージ失敗時も機能するメモリ履歴

`script.js` はOneSDKの初期化、コメント購読、DOM描画、`pagehide` 時の購読解除だけを担当する。`index.html` は表示領域と既知の `../__origin/js/onesdk.js` を読み込み、`style.css` は透過OBS向け表示を定義する。

## BIG判定フロー

各受信要素について、次の順番を厳守する。

1. オブジェクトまたは `data` が不正なら安全に無視する。表示本文だけ取得できる場合でもBIGにはしない。
2. `data.hasGift === true` なら常に通常サイズとし、匿名履歴にも記録しない。
3. `comment.service === 'twicas'` かつ `data.isAnonymous === true` の場合だけ匿名独自判定へ進む。
4. 匿名独自判定では、空でない文字列の `service`、`liveId`、`data.name` がすべて揃った場合だけ匿名キーを作る。欠落時は通常サイズとし、履歴へ記録しない。
5. 未観測の匿名キーは履歴へ記録してBIG、観測済みなら通常サイズとする。
6. その他は `data.isFirstTime === true` の場合だけBIGとする。`false`、欠落、truthyな非boolean値は通常サイズとする。

匿名キーは `service + liveId + data.name` の3要素を構造化したまま扱う。`userId`、`screenName`、`isFirstTime`、`isRepeater` は匿名識別に使わず、匿名番号の数字部分も抽出しない。他サービスについては `isFirstTime === true` 以外の推測を行わない。

## 匿名履歴と永続化

履歴は実行中のメモリを正とし、利用可能な場合だけ `localStorage` と同期する。保存キーはテンプレート固有の固定名とし、値は次の形のJSONとする。

```json
{
  "version": 1,
  "lives": [
    {
      "service": "twicas",
      "liveId": "840040616",
      "names": ["匿名コメント#1117"]
    }
  ]
}
```

`lives` は古い配信から新しい配信の順に並べ、匿名コメントを観測した配信を末尾へ移動する。この順序自体を最近利用した配信の情報として使うため、時刻は保存しない。最大15配信を保持し、超過時は先頭の配信単位から削除する。同一配信内の匿名名は重複保存しない。本文、プロフィール画像、通常ユーザーID、`userId`、`screenName` は保存しない。

読み込み時にJSON破損、未知の版、不正な要素があっても初期化を停止しない。不正要素を採用せず、利用可能な妥当データだけをメモリへ復元する。`localStorage` の取得または保存が例外になる場合は永続化を無効化し、Consoleへ警告を1回だけ出す。その後もページ生存中はメモリ履歴で匿名2回目を通常サイズにできる。永続化失敗により通常コメントの判定や描画を止めない。

テンプレートが配信途中に初めて起動された場合、起動前のTwitCasting匿名履歴はOneSDKデータから復元できない。この場合、起動後に初観測した匿名ユーザーをBIG扱いする可能性がある。一度観測して保存できた匿名履歴は、同じ `liveId` の再読み込み後に復元する。

## コメント本文と安全な描画

表示モデルはコメント本文だけを返し、名前、匿名番号、ID、画像、初コメラベルを含めない。通常コメントでは文字列化可能な `data.comment` をプレーンテキストとして使う。

giftではHTMLを含み得る `data.comment` を表示候補にしない。プレーンテキストであることが期待できる `data.speechText`、次に `data.item.name` を候補とし、空ならそのイベントを表示しない。すべての表示はDOMの `textContent` で行い、受信データを `innerHTML` へ渡さない。URL画像も読み込まない。

受信配列に不正な要素が混ざっていても、ほかの正常コメントの処理を継続する。空白だけの本文は表示しない。

## 表示仕様

画面は透過背景で、コメントを受信順に縦方向へ追加する。同時に保持する表示は最大12件とし、13件目の追加時に最も古い表示から削除してDOMの無制限増加を防ぐ。通常とBIGの視覚差は基本的に文字サイズだけとし、共通の文字色、太さ、縁取り、行間を使う。

最低限、次のCSS変数を公開する。

```css
:root {
  --comment-font-size: 32px;
  --first-comment-font-size: 64px;
}
```

各コメントはコンテナ幅以内で折り返し、`overflow-wrap: anywhere` と最大幅を設定する。派手なアニメーションは追加しない。

## OneSDKライフサイクル

NICO FLOWとProbeで確認済みの順序を踏襲する。

1. `await OneSDK.ready()`
2. `OneSDK.usePermission([OneSDK.PERM.COMMENT])` が利用可能なら使用し、それ以外は `['comments']`
3. `await OneSDK.setup({ mode: 'diff', disabledDelay: true, permissions })`
4. `OneSDK.subscribe({ action: 'comments', callback })`
5. `await OneSDK.connect()`

`pagehide` で破棄処理を一度だけ実行し、購読IDが存在して `OneSDK.unsubscribe` が関数の場合に購読解除する。初期化失敗はConsoleへ記録し、空の透過画面として安全に停止する。

## テスト戦略

Node標準テストで、ユーザー指定の13ケースに加えて次を検証する。

- strict boolean以外の `isFirstTime` は通常
- giftが匿名履歴を消費しない
- 匿名履歴の保存内容に本文や通常ユーザー情報が入らない
- 15配信を超えたとき配信単位で古い履歴を削除する
- 破損JSONと不正な保存要素から安全に復旧する
- gift本文選択でHTML入り `data.comment` を使わない
- 空本文および不正コメントを安全に無視する

テストは先に作成して、対象モジュールが存在しない、または期待APIが未実装である理由で失敗することを確認してから最小実装を行う。

ブラウザfixtureは偽OneSDKを使い、通常初コメ、通常2回目、匿名初コメ、同一匿名2回目、別匿名、gift、`localStorage` 復元を画面上で再現する。DOM ID整合、本文だけの表示、通常/BIGクラス、購読解除、Consoleエラーも確認する。実データをfixtureへ含めない。

最終検証では `npm test`、全JavaScriptへの `node --check`、`git diff --check` を実行する。さらに静的確認で `innerHTML`、外部送信API、匿名キーへの `userId` / `screenName` 使用、数字抽出、通常ユーザー情報の保存がないことを検査する。

## 未確認事項

Nodeテストと偽OneSDKブラウザfixtureはローカルで検証できるが、次は完了扱いにしない。

- わんコメへの本番テンプレート追加と認識
- 実際のOBSブラウザソースでの表示
- 実配信のTwitCasting通常・匿名・giftコメント
- YouTube、Twitch、Kickの実データと `isFirstTime`
- 長時間配信、複数同時配信、わんコメ更新後の挙動

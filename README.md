# OneSDK Probe

わんコメ用「初コメBIG」を実装する前に、TwitCasting匿名コメントの加工前データを調べるための一時的な観測テンプレートです。初コメ判定やBIG表示は行いません。また、匿名番号の保存先を推測したり、特定フィールドを匿名番号として扱ったりしません。

## 何を記録するか

OneSDKの `comments` 購読コールバックへ届いた各コメントを、表示用モデル等へ変換する前にJSON安全なスナップショットへコピーします。

- 最新100件をメモリ上の `window.__oneSDKProbeLog` に保持
- 最新コメントの主要フィールドとRAW JSONを画面表示
- 各コメントのサマリーとRAWスナップショットをConsoleへ表示
- 外部送信、analytics、`localStorage`、ファイル・Gitへの自動保存は行わない

## わんコメへの追加

このリポジトリは配布ZIPを自動生成しません。追加用ZIPを手動で作る場合は、次の6ファイルを `one-sdk-probe` フォルダへ入れ、そのフォルダを包むZIPにしてください。

```text
one-sdk-probe/
├── index.html
├── style.css
├── probe-core.js
├── script.js
├── template.json
└── README.txt
```

リポジトリ用の `README.md`、`package.json`、`tests/`、`docs/`、`research/` はZIPに含めません。

1. 作成したZIPを、わんコメのテンプレート一覧へドラッグ＆ドロップします。
2. 追加された「OneSDK Probe」を開きます。
3. 同じTwitCasting配信で通常コメントと匿名コメントを投稿します。
4. Probe画面またはテンプレートを表示しているブラウザのDevToolsで結果を確認します。

わんコメ 9.1.1で動作しているNICO FLOWと同じ `../__origin/js/onesdk.js` およびOneSDK接続方式を使用しています。ただし、このProbe自体のわんコメ実機受信はまだ未確認です。

## RAW JSONの見方

画面の「Latest summary」は比較しやすい既知パスを一覧にしたものです。「RAW JSON」はその抜き出し元となったコメント全体のスナップショットです。サマリーにない未知フィールドもRAW JSONには残ります。

DevToolsでは次の式で保存中の全ログを確認できます。

```js
window.__oneSDKProbeLog
```

各ログは `receivedAt`、`summary`、`raw` を持ちます。`raw` が加工前コメントの切り離されたスナップショットです。`[Missing]` はそのパスが存在しなかったことを示し、`false`、`0`、空文字とは区別されます。

## Copy Logs / Clear Logs

- **Copy Logs**: 保存中の全ログを整形済みJSONとしてクリップボードへコピーします。Clipboard APIが使えない場合は、同じJSONをConsoleへ出力します。
- **Clear Logs**: `window.__oneSDKProbeLog` の中身と画面の最新表示を消去します。

ログにはユーザーID、表示名、コメント本文などの識別情報が含まれる可能性があります。実ログを公開リポジトリへコミットしたり、不特定多数へ共有したりしないでください。

## 調査手順

同一配信内で、通常Aの1・2回目、匿名Aの1・2回目、匿名Bの1・2回目を投稿し、Copy Logsで取得したデータを比較します。比較結果は [`research/anonymous-comment-notes.md`](research/anonymous-comment-notes.md) に記録します。匿名Aで継続し匿名Bで変わる値が見つかっても、わんコメ画面の匿名番号と実値を照合するまでは結論にしません。

実データ調査が終わったら、このProbeは本番の「初コメBIG」テンプレートから外す予定です。

## ローカル検証

Node.jsの外部依存なしテストを実行します。

```powershell
npm test
```

`tests/browser-fixture.html` は偽OneSDKから画面表示までの配線確認用です。fixtureの値はすべて架空で、TwitCasting匿名コメントのフィールド構造を示す証拠ではありません。

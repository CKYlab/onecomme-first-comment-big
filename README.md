# 初コメBIG

わんコメ（OneComme）向けのOBS用カスタムコメントテンプレートです。

その配信で**初めてコメントした人の本文だけを大きく表示**し、2回目以降は通常サイズで表示します。

ユーザー名・ユーザーID・初コメラベルなどは表示せず、コメント本文を主役にしたシンプルなレイアウトです。

> 現在は開発中です。正式な配布ZIP・tag・GitHub Releaseはまだ作成していません。

## 主な機能

- `data.isFirstTime === true` のコメントを初コメBIG表示
- 新着コメントを上、古いコメントを下へ表示
- 表示領域を超えた古いコメントを自動削除
- TwitCasting匿名コメントの初回判定に対応
- TwitCasting / Kickのgiftを通常サイズで表示
- Kickエモートをインライン画像表示
- TwitCasting / Kickの配信者本人コメントを通常サイズで表示
- コメント本文はHTMLとして実行せず、安全な文字列として描画

通常ユーザーの初コメ判定には、OneSDKから届く `data.isFirstTime` を使用します。

サービスごとの実機確認状況や詳細な判定仕様については、  
[`template/first-comment-big/README.md`](template/first-comment-big/README.md) を参照してください。

## 設定プラグイン（任意）

`初コメBIG 設定` プラグインを有効にすると、OBSブラウザソースを再読み込みせずに次の設定を変更できます。

- ライト / ダークテーマ
- 通常コメント文字サイズ：16〜64px
- 初コメBIG文字サイズ：24〜128px

既定値は次のとおりです。

```text
テーマ: light
通常コメント: 32px
初コメBIG: 64px
```

設定はわんコメのプラグインストアへ保存され、通常は保存後約0.5秒でOBSへ反映されます。

プラグインを無効にすると既定値へフォールバックし、再度有効にすると保存済み設定へ戻ります。

設定プラグインは次のディレクトリにあります。

```text
plugin/first-comment-big-settings/
```

設定機能の設計と実機確認記録：

[`docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md`](docs/superpowers/specs/2026-08-30-first-comment-big-settings-plugin-design.md)

## テンプレート本体

現在の初コメBIG本体は次のディレクトリにあります。

```text
template/first-comment-big/
```

詳しい内容はこちら：

[`template/first-comment-big/README.md`](template/first-comment-big/README.md)

TwitCasting匿名履歴、gift表示、Kickエモート、配信者本人判定、CSS変数、既知の制約などもこちらにまとめています。

## 開発・テスト

Node.jsでテストを実行できます。

```powershell
npm test
```

設定機能v1の統合時点では、116件のNodeテストを通過しています。

## OneSDK Probeについて

このリポジトリは、初コメBIGを実装する前にTwitCasting匿名コメントのRAWデータ構造を調査するための **OneSDK Probe** から始まりました。

そのため、ルート直下の以下のようなファイルは調査用Probeとして現在も残しています。

```text
index.html
script.js
style.css
probe-core.js
template.json
README.txt
```

これらは現在の初コメBIG本体とは別物です。

調査記録は [`research/`](research/) に残しています。

## 現在の状態

初コメBIG本体と設定プラグインは開発・実機確認を進めています。

現在確認している主な内容：

- TwitCastingでの通常コメント・初コメBIG表示
- TwitCastingの匿名コメント判定
- TwitCasting gift表示
- Kickコメント表示
- Kickエモート表示
- Kick gift表示
- ライト / ダークテーマのリアルタイム変更
- 通常コメント / 初コメBIG文字サイズのリアルタイム変更
- 設定プラグインON / OFF時のフォールバックと保存設定復帰

正式な配布ZIP、tag、GitHub Releaseは、追加の表示確認と整理が終わってから作成する予定です。

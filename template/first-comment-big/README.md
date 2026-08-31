# 初コメBIG v1.1

わんコメのコメント本文だけを縦型パネルへ表示し、その配信で初めてコメントした人の本文だけを大きくするOBS向けカスタムテンプレートです。ユーザー名、匿名番号、screenName、ユーザーID、初コメラベルは画面へ表示しません。配信者本人のコメントだけは、小さなプロフィール画像を本文の左へ表示します。

## 判定方法

通常ユーザーはOneSDKから届く `data.isFirstTime === true` の場合だけBIGになります。`false`、フィールド欠落、boolean以外の値は推測せず通常サイズにします。この共通判定はYouTube、Twitch、Kickなどにも適用し、`isRepeater` は判定に使いません。

TwitCastingでは `data.isOwner === true`、Kickでは `data.origin.sender.identity.badges` に `type === "broadcaster"` がある場合だけ配信者本人として扱います。Kickの `data.isOwner`、Verifiedバッジ、ユーザー名、ユーザーIDは本人判定に使いません。本人コメントは `isFirstTime` に関係なく通常サイズで、匿名履歴も消費しません。HTTP/HTTPSの `data.profileImage` だけを円形アイコンとして表示し、読込失敗時はアイコンだけを削除します。名前やバッジは表示しません。giftは本人判定より優先し、従来のgift表示になります。

通常コメント本文に含まれる `&gt;`、`&lt;`、`&amp;`、`&quot;`、数値文字参照などは安全に1回だけデコードします。例えば `&amp;gt;` は `&gt;` までで止まります。デコード後も本文は `textContent` またはTextNodeで描画し、タグ文字列をHTMLとして実行しません。

Kickでは `data.origin.content` の `[emote:数字ID:エモート名]` を安全なトークンとして解析し、通常エモートと配信者オリジナルエモートを共通処理でインライン画像表示します。複数エモートにも対応し、`data.comment` のHTMLは使用しません。画像を読み込めない場合はエモート名へ戻します。エモートを含む行も `isFirstTime === true` なら本文と画像が初コメBIGのサイズに追従します。

TwitCasting匿名コメントは `service === 'twicas'` かつ `data.isAnonymous === true` の場合だけ独自履歴へ記録します。匿名番号付きの `data.name` を数字へ分解せず、`service + liveId + data.name` の組み合わせを配信単位の識別情報として使います。`userId` や `screenName` の `tw1` / `tw2` / `tw3` は匿名識別に使いません。匿名コメントをBIGにする設定は既定でOFFです。

`data.hasGift === true` のアイテム・ギフトは、`isFirstTime` の値に関係なく常に通常サイズです。giftイベントは匿名履歴を消費しません。TwitCasting giftでは、構造化された `data.item.image` がHTTP/HTTPS URLの場合だけ小さな画像として表示し、`data.item.name` を表示します。`speechText` 先頭の重複したアイテム名だけを最大2回除去し、残った任意コメントや🍡表記を解析せずそのまま保持します。無料giftと、有料giftで有効なOneSDK色がない場合はneutral giftとしてテーマ色へ追従します。有効な `data.colors.bodyBackgroundColor` と `bodyTextColor` がある有料giftは、その色を行全体へ適用し、価格から色を算出しません。`item.name` がない場合だけ `speechText` 全体を使います。HTMLを含み得る `data.comment` は解析・描画しません。

Kickギフトは `service === 'kick'` かつ `data.hasGift === true` で判定し、実配信RAWで確認したBASICとLEVEL_UPを同じ表示処理で扱います。`data.gift`、`data.origin.gift.amount`、`data.colors`、`data.origin.message` の構造化フィールドだけを使い、1段目にHTTP/HTTPSの画像と括弧付き金額、添付コメントがある場合だけ2段目にコメントを表示します。`static_url` を優先し、読込失敗時は別URLの `animated_url` へ一度だけ切り替えます。BASIC 100 Full Sendのように `animated_url` がなくても `static_url` だけで表示でき、画像を読み込めない場合も画像だけを削除して金額とコメントを残します。Kick指定の背景色・文字色が使えない場合は白背景・黒文字へ戻ります。Kickギフトは常に通常サイズで、ユーザー名やプロフィール画像を表示せず、`data.comment` のHTMLや `speechText` は使用しません。添付コメントは `origin.message` を1回だけHTML文字参照デコードした後も安全な文字列として描画します。

## TwitCasting匿名履歴

テンプレートが観測したTwitCasting匿名ユーザーだけを `localStorage` に保存します。保存内容は次の必要最小限の情報です。

```json
{
  "version": 1,
  "lives": [
    {
      "service": "twicas",
      "liveId": "配信ID",
      "names": ["匿名番号付き表示名"]
    }
  ]
}
```

コメント本文、プロフィール画像、通常ユーザーID、匿名コメントの `userId` / `screenName` は保存しません。最近利用した最大15配信を保持し、超えた場合は古い配信単位の履歴から削除します。複数配信を同時取得しても、新しい `liveId` を見ただけで他配信の履歴を全削除することはありません。

`localStorage` を利用できない場合、Consoleへ警告を1回出してメモリ上の履歴へフォールバックします。そのページが生きている間は同一匿名ユーザーの2回目を通常サイズにできますが、再読み込み耐性は失われます。テンプレート全体や通常コメント表示は停止しません。

### 匿名コメントに関する制約

配信途中でこのテンプレートを初めて起動した場合、起動前に投稿済みだったTwitCasting匿名ユーザーの履歴は現在のOneSDKデータだけでは復元できません。そのため、起動後に初めて観測した匿名コメントをBIG扱いする可能性があります。

一度テンプレートが匿名ユーザーを観測した後は、保存できた履歴を同一 `liveId` の再読み込み後に復元します。

## 設定プラグイン（任意）

設定プラグイン `com.ckylab.first-comment-big-settings` は任意です。未導入でも、コメント表示は `light` / 標準フォント / 32px / 64px / 匿名BIG OFFの既定値で続きます。導入と有効化は公式プラグイン画面で行い、設定画面も同じ公式プラグイン画面から開きます。

設定項目は次の5つです。

- テーマ: `light` または `dark`（既定値: `light`）
- フォント（既定値: 標準）
  - 標準（游ゴシック）
  - メイリオ
  - 太ゴシック（BIZ UDPゴシック）
  - 丸ゴシック（M PLUS Rounded 1c）
- 通常コメント文字サイズ: 16〜64px の整数（既定値: 32px）
- 初コメBIG文字サイズ: 24〜128px の整数（既定値: 64px）
- ツイキャス匿名コメントも初コメBIG: ON / OFF（既定値: OFF）

保存後の設定は通常最大約0.5秒（500ms）でOBSへ反映され、OBSの再読み込みは不要です。プラグインが未導入・無効・起動前の場合、および通信・JSON・値の異常時は既定値へ戻ります。この設定に関わる障害が起きてもOneSDKのコメント購読は停止しません。テーマを変更しても、有効な配信固有色を持つTwitCasting/Kick giftはその背景色・文字色を維持します。

丸ゴシックは選択したときだけGoogle Fontsから `M PLUS Rounded 1c` の太さ700を読み込むため、PCへのフォントインストールは不要です。ネットワーク取得に失敗した場合はBIZ UDPゴシックや游ゴシックなどのローカルフォントへ戻ります。標準、メイリオ、太ゴシックではGoogle Fontsを読み込みません。

匿名BIGがOFFでも匿名履歴は記録します。その後ONへ切り替えても既に観測した匿名ユーザーはBIGにならず、ON中に初めて観測した匿名ユーザーだけがBIGになります。`permissions: []` のプラグイン読込・有効化・設定GET/PUTは実機で確認済みです。

設定プラグインを差し替え・更新した場合は、わんコメを再起動してください。既存のOBSブラウザソースを流用する場合、以前のテンプレート用カスタムCSSが表示サイズやownerコメントへ影響することがあるため、カスタムCSSを確認してください。OBS側でソースを縮小している場合、設定したpx値より実際の見た目は小さくなります。既定値は通常32px、初コメBIG64pxです。

## 表示とCSS変数

デフォルトは白背景・黒文字で、新着を最上部へ追加し、既存コメントを下へ押し下げます。DOMは最大100件とし、100件を超えた場合だけ最下部の最古コメントを削除します。表示領域の高さを超える部分は `overflow-y: hidden` でクリップし、高さを理由にDOMから削除しないため、BIGが下端を通過した後も表示下部へ大きな空白を残しません。通常サイズとBIGサイズを含む主な表示値は `style.css` 冒頭のCSS変数で変更できます。

```css
:root {
  --comment-font-family: "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif;
  --comment-font-size: 32px;
  --first-comment-font-size: 64px;
  --panel-background: #ffffff;
  --comment-text-color: #000000;
  --comment-border-color: #d8d8d8;
  --gift-neutral-background: #ffffff;
  --gift-neutral-text-color: #000000;
  --comment-padding-x: 16px;
  --comment-padding-y: 10px;
  --gift-image-size: 1.65em;
  --kick-emote-size: 1.4em;
  --kick-gift-image-size: 36px;
  --kick-gift-image-max-width: 120px;
  --owner-image-size: 30px;
}
```

OBSブラウザソースの「カスタムCSS」末尾へ同じ変数を追加して上書きできます。

```css
:root {
  --panel-background: transparent;
}
```

長文は通常・BIG・giftのすべてで表示領域の最大幅に折り返します。通常とBIGの違いは基本的に文字サイズだけで、派手な色、影、カード装飾、アニメーションはありません。コメント間は薄い横線で区切ります。

## わんコメへの追加

正式配布用ZIPを作成する際は、このREADMEがある `first-comment-big` フォルダを包んだZIPを作り、わんコメのテンプレート一覧へドラッグ＆ドロップします。その後、青い「ここをドラッグしてOBSに入れる」をOBSへ移します。テンプレートの基準サイズは幅1920・高さ1080です。

## 実機確認

わんコメ／OBS実機で、初コメBIG後の表示、最大100件、4種類のフォント、Google Fonts版丸ゴシック、匿名BIG ON/OFF、gift色、owner表示、設定のリアルタイム反映を確認済みです。YouTube / Twitchの実データ、長時間配信、複数同時配信、将来のわんコメ更新後の挙動は継続確認対象です。

Nodeテストや偽OneSDK fixtureの成功を、これらの実機確認済みという意味では扱いません。

わんコメ用「初コメBIG」v1.1

【動作】
コメント本文だけを縦型パネルへ上から下に表示し、その
配信で初めてコメントした人の本文だけを大きくします。名前、匿名番号、
ID、通常ユーザーアイコン、初コメラベルは表示しません。配信者本人だけは
小さなプロフィール画像を本文の左へ表示します。

通常ユーザーはOneSDKの data.isFirstTime === true の場合だけBIGです。
false、欠落、boolean以外は通常サイズで、isRepeaterは判定に使いません。

TwitCastingはdata.isOwner === true、Kickはorigin.sender.identity.badgesに
type === "broadcaster"がある場合だけ本人扱いします。KickのisOwner、
Verifiedだけ、名前、IDは判定に使いません。本人は常に通常サイズで匿名
履歴も消費しません。HTTP/HTTPSのdata.profileImageだけを円形表示し、
読込失敗時はアイコンだけを削除します。gift表示は本人判定より優先です。

通常本文の&gt;、&lt;、&amp;、&quot;、数値文字参照などは1回だけデコード
します。&amp;gt;は&gt;までで止まります。デコード後もtextContentまたは
TextNodeで描画するため、タグ文字列をHTMLとして実行しません。

Kickではdata.origin.contentの[emote:数字ID:エモート名]を使い、通常
エモートと配信者オリジナルエモートを共通処理で画像表示します。複数
エモートにも対応し、data.commentのHTMLは使いません。画像読込失敗時は
エモート名へ戻ります。初コメのエモート画像もBIG行の文字サイズへ追従
します。

TwitCasting匿名は service + liveId + data.name を配信単位で管理します。
匿名番号の数字部分、userId、screenNameのtw1/tw2/tw3は使いません。
匿名履歴だけをlocalStorageへ保存し、最近の最大15配信を保持します。
本文、画像、通常ユーザーIDは保存しません。

localStorageが使えない場合はConsoleへ1回警告し、メモリ履歴へ切り替え
ます。そのページ内の2回目判定は続きますが、再読み込み耐性は失われます。

data.hasGift === true のアイテム・ギフトは常に通常サイズです。giftは匿名
履歴を消費しません。TwitCastingではHTTP/HTTPSのdata.item.imageを小さな
画像に使い、item.nameを表示します。speechText先頭の重複したitem.nameだけ
を最大2回除去し、残った任意コメントや🍡表記は解析せず保持します。無料
giftと有効色がない有料giftはテーマ色へ追従します。有効なOneSDKの
data.colorsがある有料giftはその色を行全体へ適用し、価格から色を算出
しません。
名前がない場合だけspeechText全体を使い、HTML入りcommentは解析・描画
しません。

Kickギフトはservice === "kick"かつdata.hasGift === trueで判定し、実配信
RAWで確認したBASICとLEVEL_UPを同じ処理で扱います。data.gift、
data.origin.gift.amount、data.colors、data.origin.messageだけを使います。
1段目にHTTP/HTTPSの画像と括弧付き金額、添付コメントがある場合だけ2段目に
コメントを表示します。static_urlを優先し、読込失敗時は別URLのanimated_url
へ一度だけ切り替えます。BASIC 100 Full Sendのようにanimated_urlがなくても
static_urlだけで表示でき、画像を読み込めない場合も画像だけを削除して金額と
コメントを残します。Kick指定色が使えない場合は白背景・黒文字へ戻ります。
Kickギフトは通常サイズで、名前やプロフィール画像を表示しません。
data.commentのHTMLとspeechTextは使わず、origin.messageを1回だけ文字参照
デコードして安全な文字列として描画します。

【重要な制約】
配信途中で初めて起動した場合、起動前のTwitCasting匿名履歴は復元できません。
匿名BIGがONなら、起動後の初観測コメントをBIG扱いする可能性があります。
一度観測して保存できた匿名履歴は、同じliveIdの再読み込み後に復元します。

【設定プラグイン（任意）】
設定プラグイン com.ckylab.first-comment-big-settings は任意です。未導入でも、
コメント表示は light / 標準フォント / 32px / 64px / 匿名BIG OFFの既定値で
続きます。導入と
有効化は公式プラグイン画面で行い、設定画面も同じ公式プラグイン画面から
開きます。

設定項目は次の5つです。
- テーマ: light または dark（既定値: light）
- フォント: 標準（游ゴシック）／メイリオ／太ゴシック（BIZ UDPゴシック）／
  丸ゴシック（M PLUS Rounded 1c）
- 通常コメント文字サイズ: 16〜64px の整数（既定値: 32px）
- 初コメBIG文字サイズ: 24〜128px の整数（既定値: 64px）
- ツイキャス匿名コメントも初コメBIG: ON / OFF（既定値: OFF）

保存後の設定は通常最大約0.5秒（500ms）でOBSへ反映され、OBSの再読み込みは
不要です。プラグインが未導入・無効・起動前の場合、および通信・JSON・値の
異常時は既定値へ戻ります。この設定に
関わる障害が起きてもOneSDKのコメント購読は停止しません。テーマを変更しても、
有効な配信固有色を持つTwitCastingとKickのgiftはその色を維持します。

丸ゴシックは選択した時だけGoogle Fontsから太さ700を読み込むため、PCへの
インストールは不要です。取得失敗時はローカルフォントへ戻ります。他の3種
ではGoogle Fontsを読み込みません。

匿名BIGがOFFでも履歴は記録します。後からONにしても既観測匿名は通常表示で、
ON中に初めて観測した匿名だけがBIGになります。permissions: [] の読込、
有効化、設定GET/PUTは実機確認済みです。

設定プラグインを差し替え・更新した場合は、わんコメを再起動してください。
既存OBSソースを流用する場合は、以前のカスタムCSSが表示サイズやowner表示へ
影響していないか確認してください。OBS側でソースを縮小すると、設定したpx値
より見た目が小さくなります。既定値は通常32px、初コメBIG64pxです。

【文字サイズ】
style.cssまたはOBSのカスタムCSSで次を変更します。

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

長文は最大幅で折り返します。コメント間は薄い横線で区切り、新着を上へ
追加します。DOMは最大100件で、超過時だけ最古コメントを削除します。高さを
超えた部分はoverflow-y:hiddenで表示範囲外へクリップし、高さを理由にDOMから
削除しないため、BIG通過後も表示下部へ大きな空白を残しません。

【追加方法】
正式配布時は、このREADME.txtが入った
first-comment-bigフォルダを包むZIPを作り、わんコメのテンプレート一覧へ
ドラッグ＆ドロップします。基準サイズは幅1920・高さ1080です。

【実機確認】
わんコメ／OBSで、初コメBIG後の表示、最大100件、4種類のフォント、Google
Fonts版丸ゴシック、匿名BIG ON/OFF、gift色、owner表示、設定のリアルタイム
反映を確認済みです。YouTube / Twitch実データ、長時間・複数同時配信、将来の
わんコメ更新後の挙動は継続確認対象です。

わんコメ用「初コメBIG」v1.1

【動作】
コメント本文だけを白背景・黒文字の縦型パネルへ上から下に表示し、その
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
giftは白背景・黒文字、有料giftはOneSDKのdata.colorsを行全体へ適用し、
価格から色を算出しません。色が使えない場合は白背景・黒文字へ戻します。
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
配信途中で初めて起動した場合、起動前のTwitCasting匿名履歴は復元できず、
起動後の初観測コメントをBIG扱いする可能性があります。一度観測して保存
できた匿名履歴は、同じliveIdの再読み込み後に復元します。

【設定プラグイン（任意）】
設定プラグイン com.ckylab.first-comment-big-settings は任意です。未導入でも、
コメント表示は従来どおり light / 32px / 64px の既定値で続きます。導入と
有効化は公式プラグイン画面で行い、設定画面も同じ公式プラグイン画面から
開きます。

設定項目は次の3つだけです。
- テーマ: light または dark（既定値: light）
- 通常コメント文字サイズ: 16〜64px の整数（既定値: 32px）
- 初コメBIG文字サイズ: 24〜128px の整数（既定値: 64px）

保存後の設定は通常最大約0.5秒（500ms）でOBSへ反映され、OBSの再読み込みは
不要です。プラグインが未導入・無効・起動前の場合、および通信・JSON・値の
異常時は、テーマ light、通常32px、初コメBIG64pxへ戻ります。この設定に
関わる障害が起きてもOneSDKのコメント購読は停止しません。テーマを変更しても、
TwitCastingとKickのgiftは各イベント固有の背景色・文字色を維持します。

permissions: [] が実機で正式対応済みかどうかの確認はTask 10で行う予定です。
Task 10の実機確認前に、正式対応済みとは断言しません。

【文字サイズ】
style.cssまたはOBSのカスタムCSSで次を変更します。

:root {
  --comment-font-size: 32px;
  --first-comment-font-size: 64px;
  --panel-background: #ffffff;
  --comment-text-color: #000000;
  --comment-border-color: #d8d8d8;
  --comment-padding-x: 16px;
  --comment-padding-y: 10px;
  --gift-image-size: 1.65em;
  --kick-emote-size: 1.4em;
  --kick-gift-image-size: 36px;
  --kick-gift-image-max-width: 120px;
  --owner-image-size: 30px;
}

長文は最大幅で折り返します。コメント間は薄い横線で区切り、新着を上へ
追加します。表示領域を超えた古い下側のコメントから削除します。1件だけ
の巨大コメントは削除せず、DOM異常増加対策として最大100件に制限します。

【追加方法】
v1.1の配布ZIPはまだ生成していません。確認後、このREADME.txtが入った
first-comment-bigフォルダを包むZIPを作り、わんコメのテンプレート一覧へ
ドラッグ＆ドロップします。基準サイズは幅1920・高さ1080です。

【未確認】
本番テンプレートのわんコメへの追加、OBS表示、実配信のTwitCasting通常・
匿名・giftとdata.item.image、TwitCasting／Kick配信者本人コメントと画像、
YouTube / Twitch、KickエモートのOBS実表示、長時間・複数同時配信は未確認
です。Kick BASIC 100 Full SendとLEVEL_UPのRAW構造、およびBASIC 100の
わんコメ標準表示は確認済みですが、この初コメBIGテンプレート／OBSでの
BASIC 100表示はまだ未確認です。

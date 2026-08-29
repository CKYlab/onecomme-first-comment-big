const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../template/first-comment-big/first-comment-core.js");

const {
  createKickGiftPresentation,
  formatKickAmount,
  sanitizeHttpImageUrl,
} = require("../template/first-comment-big/kick-gift-presentation.js");

function makeKickGift({ data = {}, gift = {}, colors = {}, origin = {}, originGift = {} } = {}) {
  return {
    service: "kick",
    data: {
      hasGift: true,
      comment: "<b>HTML comment must not be used</b>",
      speechText: "speechText must not be used",
      gift: {
        static_url: "https://example.com/kicks-static.webp",
        animated_url: "https://example.com/kicks-animated.webp",
        color: "#ff00ff",
        ...gift,
      },
      colors: {
        bodyBackgroundColor: "#18E9FB",
        bodyTextColor: "#333333",
        ...colors,
      },
      origin: {
        message: "",
        gift: {
          gift_id: "pack_it_up",
          name: "Pack It Up",
          amount: 1000,
          ...originGift,
        },
        ...origin,
      },
      ...data,
    },
  };
}

function makeBasicKickGift() {
  return {
    service: "kick",
    data: {
      hasGift: true,
      isFirstTime: true,
      gift: {
        static_url: "https://files.kick.com/kicks/gifts/full-send.webp",
        color: "#18FBB0",
      },
      colors: {
        bodyBackgroundColor: "#18FBB0",
        headerBackgroundColor: "#18FBB0",
        bodyTextColor: "#333",
        headerTextColor: "inherit",
      },
      origin: {
        message: "",
        gift: {
          gift_id: "full_send",
          name: "Full Send",
          amount: 100,
          type: "BASIC",
          tier: "BASIC",
          character_limit: 0,
          pinned_time: 0,
        },
      },
      speechText: "full_send (100) ",
      comment:
        '<img class="gift-image" src="https://files.kick.com/kicks/gifts/full-send.webp" alt="full_send" /> (100)',
    },
  };
}

test("BASIC 100 Full Sendを既存Kickギフト表示へ変換する", () => {
  assert.deepEqual(createKickGiftPresentation(makeBasicKickGift()), {
    amountText: "(100)",
    message: null,
    imageUrls: ["https://files.kick.com/kicks/gifts/full-send.webp"],
    backgroundColor: "#18FBB0",
    textColor: "#333",
  });
});

test("BASIC 100はisFirstTime trueでも通常サイズモデルになる", () => {
  const comment = makeBasicKickGift();
  const presentation = createKickGiftPresentation(comment);
  const model = core.createDisplayModel(
    {
      ...comment,
      data: { ...comment.data, speechText: presentation.amountText },
    },
    core.createAnonymousHistory(),
  );

  assert.deepEqual(model, { text: "(100)", isFirstComment: false });
});

test("BASIC 100の不正画像URLを使用せず金額表示を残す", () => {
  const comment = makeBasicKickGift();
  comment.data.gift.static_url = "javascript:alert(1)";

  const presentation = createKickGiftPresentation(comment);

  assert.deepEqual(presentation.imageUrls, []);
  assert.equal(presentation.amountText, "(100)");
});

test("BASIC 100の色が欠落した場合は白背景・黒文字へfallbackする", () => {
  const comment = makeBasicKickGift();
  delete comment.data.colors;

  const presentation = createKickGiftPresentation(comment);

  assert.equal(presentation.backgroundColor, "#ffffff");
  assert.equal(presentation.textColor, "#000000");
});

test("KickかつhasGiftがtrueのイベントだけをKICKsとして扱う", () => {
  assert.ok(createKickGiftPresentation(makeKickGift()));
  assert.equal(
    createKickGiftPresentation({ ...makeKickGift(), service: "twicas" }),
    null,
  );
  assert.equal(
    createKickGiftPresentation(makeKickGift({ data: { hasGift: 1 } })),
    null,
  );
});

test("コメントなし1000 KICKsを構造化フィールドから表示する", () => {
  assert.deepEqual(createKickGiftPresentation(makeKickGift()), {
    amountText: "(1000)",
    message: null,
    imageUrls: [
      "https://example.com/kicks-static.webp",
      "https://example.com/kicks-animated.webp",
    ],
    backgroundColor: "#18E9FB",
    textColor: "#333333",
  });
});

test("コメント付きKICKsはorigin.messageだけを保持する", () => {
  const presentation = createKickGiftPresentation(
    makeKickGift({ origin: { message: "  Nice stream!  " } }),
  );

  assert.equal(presentation.amountText, "(1000)");
  assert.equal(presentation.message, "Nice stream!");
  assert.doesNotMatch(presentation.message, /HTML comment|speechText/);
});

test("10000 KICKsの金額と配信色をそのまま返す", () => {
  const presentation = createKickGiftPresentation(
    makeKickGift({
      originGift: { amount: 10000 },
      colors: {
        bodyBackgroundColor: "#FCB645",
        bodyTextColor: "#333",
      },
    }),
  );

  assert.equal(presentation.amountText, "(10000)");
  assert.equal(presentation.backgroundColor, "#FCB645");
  assert.equal(presentation.textColor, "#333");
});

test("配信色が欠落した場合は白背景・黒文字へfallbackしgift.colorを使わない", () => {
  const presentation = createKickGiftPresentation(
    makeKickGift({
      gift: { color: "#ff00ff" },
      colors: {
        bodyBackgroundColor: "",
        bodyTextColor: null,
      },
    }),
  );

  assert.equal(presentation.backgroundColor, "#ffffff");
  assert.equal(presentation.textColor, "#000000");
});

test("画像URLはstaticを優先し、HTTP(S)以外を除外してanimatedへfallbackできる", () => {
  assert.deepEqual(
    createKickGiftPresentation(
      makeKickGift({
        gift: {
          static_url: undefined,
          animated_url: "https://example.com/animated-only.gif",
        },
      }),
    ).imageUrls,
    ["https://example.com/animated-only.gif"],
  );

  assert.deepEqual(
    createKickGiftPresentation(
      makeKickGift({
        gift: {
          static_url: "javascript:alert(1)",
          animated_url: "https://example.com/fallback.gif",
        },
      }),
    ).imageUrls,
    ["https://example.com/fallback.gif"],
  );

  assert.deepEqual(
    createKickGiftPresentation(
      makeKickGift({
        gift: {
          static_url: "https://example.com/same.webp",
          animated_url: "https://example.com/same.webp",
        },
      }),
    ).imageUrls,
    ["https://example.com/same.webp"],
  );
});

test("金額は正の有限数または数字文字列だけを採用する", () => {
  for (const [value, expected] of [
    [1000, "(1000)"],
    ["10000", "(10000)"],
    [0, "(KICKs)"],
    [-1, "(KICKs)"],
    [Infinity, "(KICKs)"],
    ["1e3", "(KICKs)"],
    ["1000 KICKs", "(KICKs)"],
    [null, "(KICKs)"],
  ]) {
    assert.equal(formatKickAmount(value), expected);
  }
});

test("未知・欠落金額でもKICKsイベント自体は表示対象として残す", () => {
  const presentation = createKickGiftPresentation(
    makeKickGift({ originGift: { amount: undefined } }),
  );

  assert.equal(presentation.amountText, "(KICKs)");
});

test("空コメントは省略し、危険に見える文字列も文字データとして保持する", () => {
  assert.equal(
    createKickGiftPresentation(makeKickGift({ origin: { message: "   " } })).message,
    null,
  );

  assert.equal(
    createKickGiftPresentation(
      makeKickGift({ origin: { message: '<img src=x onerror="alert(1)">' } }),
    ).message,
    '<img src=x onerror="alert(1)">',
  );
});

test("画像URL sanitizerはHTTP(S)だけを許可する", () => {
  assert.equal(sanitizeHttpImageUrl("https://example.com/a.webp"), "https://example.com/a.webp");
  assert.equal(sanitizeHttpImageUrl("http://example.com/a.webp"), "http://example.com/a.webp");
  assert.equal(sanitizeHttpImageUrl("data:image/png;base64,AAAA"), null);
  assert.equal(sanitizeHttpImageUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeHttpImageUrl("not a url"), null);
});

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const core = require('../template/first-comment-big/first-comment-core.js')

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    read(key) {
      return values.get(key)
    },
  }
}

function makeAnonymous(overrides = {}) {
  return {
    service: 'twicas',
    data: {
      comment: '匿名の本文',
      isAnonymous: true,
      liveId: 'live-a',
      name: '匿名コメント#1000',
      screenName: 'c:tw1',
      userId: 'twc-c:tw1',
      ...overrides,
    },
  }
}

test('通常ユーザーは isFirstTime が true の場合だけBIGになる', () => {
  const history = core.createAnonymousHistory()

  assert.deepEqual(
    core.createDisplayModel(
      { service: 'youtube', data: { comment: '初回', isFirstTime: true } },
      history,
    ),
    { text: '初回', isFirstComment: true },
  )
  assert.deepEqual(
    core.createDisplayModel(
      { service: 'youtube', data: { comment: '2回目', isFirstTime: false } },
      history,
    ),
    { text: '2回目', isFirstComment: false },
  )
  assert.deepEqual(
    core.createDisplayModel({ service: 'youtube', data: { comment: '欠落' } }, history),
    { text: '欠落', isFirstComment: false },
  )
  assert.deepEqual(
    core.createDisplayModel(
      { service: 'youtube', data: { comment: '非boolean', isFirstTime: 1 } },
      history,
    ),
    { text: '非boolean', isFirstComment: false },
  )
})

test('他サービスも isFirstTime true だけを共通ロジックでBIGにする', () => {
  const history = core.createAnonymousHistory()

  assert.equal(
    core.createDisplayModel(
      { service: 'twitch', data: { comment: 'Twitch初回', isFirstTime: true } },
      history,
    ).isFirstComment,
    true,
  )
  assert.equal(
    core.createDisplayModel({ service: 'kick', data: { comment: 'Kick不明' } }, history)
      .isFirstComment,
    false,
  )
})

test('giftは isFirstTime true でも常に通常サイズになる', () => {
  const history = core.createAnonymousHistory()
  const model = core.createDisplayModel(
    {
      service: 'twicas',
      data: {
        comment: '<img src="unsafe">',
        hasGift: true,
        isFirstTime: true,
        speechText: 'アイテムを贈りました',
      },
    },
    history,
  )

  assert.deepEqual(model, { text: 'アイテムを贈りました', isFirstComment: false })
})

test('giftは speechText、item.name の順で安全な本文を選びHTML commentを使わない', () => {
  const history = core.createAnonymousHistory()

  assert.equal(
    core.createDisplayModel(
      {
        service: 'twicas',
        data: {
          comment: '<img src="unsafe">',
          hasGift: true,
          speechText: '読み上げ用',
          item: { name: 'アイテム名' },
        },
      },
      history,
    ).text,
    '読み上げ用',
  )
  assert.equal(
    core.createDisplayModel(
      {
        service: 'twicas',
        data: { comment: '<img src="unsafe">', hasGift: true, item: { name: 'アイテム名' } },
      },
      history,
    ).text,
    'アイテム名',
  )
  assert.equal(
    core.createDisplayModel(
      { service: 'twicas', data: { comment: '<img src="unsafe">', hasGift: true } },
      history,
    ),
    null,
  )
})

test('匿名giftは匿名ユーザーの初回を消費しない', () => {
  const history = core.createAnonymousHistory()

  assert.deepEqual(
    core.createDisplayModel(
      makeAnonymous({ hasGift: true, speechText: '匿名gift', isFirstTime: true }),
      history,
    ),
    { text: '匿名gift', isFirstComment: false },
  )
  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, true)
})

test('本人情報があるgiftも既存gift分岐を優先して本人表示にしない', () => {
  const model = core.createDisplayModel(
    {
      service: 'twicas',
      data: {
        comment: '<img src="unsafe">',
        hasGift: true,
        isFirstTime: true,
        isOwner: true,
        profileImage: 'https://example.test/owner.png',
        speechText: '本人からのgift',
      },
    },
    core.createAnonymousHistory(),
  )

  assert.deepEqual(model, { text: '本人からのgift', isFirstComment: false })
})

test('TwitCasting匿名は同じ service・liveId・name の初回だけBIGになる', () => {
  const history = core.createAnonymousHistory()

  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, true)
  assert.equal(core.createDisplayModel(makeAnonymous({ comment: '2回目' }), history).isFirstComment, false)
})

test('同じ c:tw1 でも name が違えばそれぞれ初回BIGになる', () => {
  const history = core.createAnonymousHistory()

  assert.equal(
    core.createDisplayModel(makeAnonymous({ name: '匿名コメント#1000' }), history).isFirstComment,
    true,
  )
  assert.equal(
    core.createDisplayModel(makeAnonymous({ name: '匿名コメント#2000' }), history).isFirstComment,
    true,
  )
})

test('同じ匿名名でも liveId が違えばそれぞれ初回BIGになる', () => {
  const history = core.createAnonymousHistory()

  assert.equal(core.createDisplayModel(makeAnonymous({ liveId: 'live-a' }), history).isFirstComment, true)
  assert.equal(core.createDisplayModel(makeAnonymous({ liveId: 'live-b' }), history).isFirstComment, true)
})

test('TwitCasting匿名で liveId または name が欠落した場合は通常サイズになる', () => {
  const history = core.createAnonymousHistory()

  assert.equal(core.createDisplayModel(makeAnonymous({ liveId: undefined }), history).isFirstComment, false)
  assert.equal(core.createDisplayModel(makeAnonymous({ name: undefined }), history).isFirstComment, false)
  assert.equal(core.createDisplayModel(makeAnonymous({ liveId: '  ' }), history).isFirstComment, false)
})

test('他サービスの isAnonymous は匿名独自履歴を使わない', () => {
  const history = core.createAnonymousHistory()
  const comment = makeAnonymous({ isFirstTime: true })
  comment.service = 'youtube'

  assert.equal(core.createDisplayModel(comment, history).isFirstComment, true)
  assert.equal(core.createDisplayModel(comment, history).isFirstComment, true)
  assert.deepEqual(history.toJSON(), { version: 1, lives: [] })
})

test('localStorageから復元した匿名ユーザーは通常サイズになる', () => {
  const storage = makeStorage()
  const firstHistory = core.createAnonymousHistory({ storage })
  assert.equal(core.createDisplayModel(makeAnonymous(), firstHistory).isFirstComment, true)

  const restoredHistory = core.createAnonymousHistory({ storage })
  assert.equal(core.createDisplayModel(makeAnonymous(), restoredHistory).isFirstComment, false)
})

test('localStorage読み込み不能でもメモリ上で2回目を通常サイズにして警告は1回だけ出す', () => {
  const warnings = []
  const storage = {
    getItem() {
      throw new Error('storage denied')
    },
    setItem() {
      throw new Error('must not retry storage')
    },
  }
  const history = core.createAnonymousHistory({ storage, warn: (message) => warnings.push(message) })

  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, true)
  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, false)
  assert.equal(warnings.length, 1)
})

test('localStorage保存不能でもメモリを先に更新して警告は1回だけ出す', () => {
  const warnings = []
  let writes = 0
  const storage = {
    getItem() {
      return null
    },
    setItem() {
      writes += 1
      throw new Error('quota exceeded')
    },
  }
  const history = core.createAnonymousHistory({ storage, warn: (message) => warnings.push(message) })

  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, true)
  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, false)
  assert.equal(writes, 1)
  assert.equal(warnings.length, 1)
})

test('匿名履歴には必要最小限のservice・liveId・nameだけを保存する', () => {
  const storage = makeStorage()
  const history = core.createAnonymousHistory({ storage })

  core.createDisplayModel(
    makeAnonymous({
      comment: '保存してはいけない本文',
      displayName: '保存してはいけない表示名',
      profileImage: 'https://example.invalid/profile.png',
    }),
    history,
  )

  assert.deepEqual(JSON.parse(storage.read(core.STORAGE_KEY)), {
    version: 1,
    lives: [
      {
        service: 'twicas',
        liveId: 'live-a',
        names: ['匿名コメント#1000'],
      },
    ],
  })
})

test('最近の15配信だけを保持し古い配信単位で削除する', () => {
  const history = core.createAnonymousHistory()

  for (let index = 1; index <= 16; index += 1) {
    history.remember({
      service: 'twicas',
      liveId: `live-${index}`,
      name: `匿名コメント#${index}`,
    })
  }

  const saved = history.toJSON()
  assert.equal(saved.lives.length, 15)
  assert.equal(saved.lives[0].liveId, 'live-2')
  assert.equal(saved.lives[14].liveId, 'live-16')
  assert.equal(saved.lives.some((live) => live.liveId === 'live-1'), false)
})

test('再観測した配信を最近の配信として末尾へ移動する', () => {
  const history = core.createAnonymousHistory({ maxLives: 3 })
  history.remember({ service: 'twicas', liveId: 'live-a', name: '匿名コメント#1' })
  history.remember({ service: 'twicas', liveId: 'live-b', name: '匿名コメント#2' })
  history.remember({ service: 'twicas', liveId: 'live-a', name: '匿名コメント#1' })
  history.remember({ service: 'twicas', liveId: 'live-c', name: '匿名コメント#3' })
  history.remember({ service: 'twicas', liveId: 'live-d', name: '匿名コメント#4' })

  assert.deepEqual(
    history.toJSON().lives.map((live) => live.liveId),
    ['live-a', 'live-c', 'live-d'],
  )
})

test('破損JSON・未知version・不正要素を安全に無視する', () => {
  const malformed = core.createAnonymousHistory({
    storage: makeStorage({ [core.STORAGE_KEY]: '{broken' }),
  })
  assert.equal(malformed.remember({ service: 'twicas', liveId: 'live-a', name: '匿名コメント#1' }), true)

  const unknown = core.createAnonymousHistory({
    storage: makeStorage({ [core.STORAGE_KEY]: JSON.stringify({ version: 2, lives: [] }) }),
  })
  assert.deepEqual(unknown.toJSON(), { version: 1, lives: [] })

  const partiallyValid = core.createAnonymousHistory({
    storage: makeStorage({
      [core.STORAGE_KEY]: JSON.stringify({
        version: 1,
        lives: [
          { service: 'twicas', liveId: 'valid-live', names: ['匿名コメント#1', '', 42] },
          { service: 'twicas', liveId: '', names: ['匿名コメント#2'] },
          null,
        ],
      }),
    }),
  })
  assert.deepEqual(partiallyValid.toJSON(), {
    version: 1,
    lives: [{ service: 'twicas', liveId: 'valid-live', names: ['匿名コメント#1'] }],
  })
})

test('不正コメントと空白だけの本文を安全に無視する', () => {
  const history = core.createAnonymousHistory()

  assert.equal(core.createDisplayModel(null, history), null)
  assert.equal(core.createDisplayModel({}, history), null)
  assert.equal(core.createDisplayModel({ service: 'youtube', data: { comment: '   ' } }, history), null)
  assert.equal(core.createDisplayModel({ service: 'youtube', data: { comment: 123 } }, history), null)
})

test('TwitCasting本人はisFirstTimeに関係なく通常サイズでプロフィール画像を持つ', () => {
  const history = core.createAnonymousHistory()

  for (const isFirstTime of [true, false]) {
    assert.deepEqual(
      core.createDisplayModel(
        {
          service: 'twicas',
          data: {
            comment: '配信者コメント',
            isFirstTime,
            isOwner: true,
            profileImage: 'https://example.test/owner.png',
          },
        },
        history,
      ),
      {
        text: '配信者コメント',
        isFirstComment: false,
        isOwner: true,
        ownerImageUrl: 'https://example.test/owner.png',
      },
    )
  }
})

test('TwitCasting一般ユーザーはisOwner falseなら従来どおり初コメBIGになる', () => {
  const model = core.createDisplayModel(
    {
      service: 'twicas',
      data: { comment: '一般初コメ', isFirstTime: true, isOwner: false },
    },
    core.createAnonymousHistory(),
  )

  assert.deepEqual(model, { text: '一般初コメ', isFirstComment: true })
})

test('TwitCasting匿名本人コメントは匿名履歴を消費しない', () => {
  const history = core.createAnonymousHistory()
  const owner = makeAnonymous({ isOwner: true, isFirstTime: true })

  assert.equal(core.createDisplayModel(owner, history).isOwner, true)
  assert.equal(core.createDisplayModel(makeAnonymous(), history).isFirstComment, true)
})

test('Kickはbroadcasterバッジの完全一致だけを本人判定に使う', () => {
  const history = core.createAnonymousHistory()
  const makeKick = (badges) => ({
    service: 'kick',
    data: {
      comment: 'Kick初コメ',
      isFirstTime: true,
      isRepeater: true,
      isOwner: false,
      origin: { sender: { identity: { badges } } },
    },
  })

  assert.equal(
    core.createDisplayModel(
      makeKick([{ type: 'broadcaster', text: 'Broadcaster' }]),
      history,
    ).isOwner,
    true,
  )
  assert.equal(
    core.createDisplayModel(
      makeKick([
        { type: 'broadcaster', text: 'Broadcaster' },
        { type: 'verified', text: 'Verified channel' },
      ]),
      history,
    ).isOwner,
    true,
  )
  assert.deepEqual(
    core.createDisplayModel(
      makeKick([{ type: 'verified', text: 'Verified channel' }]),
      history,
    ),
    { text: 'Kick初コメ', isFirstComment: true },
  )
  assert.deepEqual(
    core.createDisplayModel(
      makeKick([{ type: 'Broadcaster' }, { type: 'broadcaster-plus' }]),
      history,
    ),
    { text: 'Kick初コメ', isFirstComment: true },
  )
})

test('Kick本人判定はdata.isOwnerやユーザー識別子を使用しない', () => {
  const model = core.createDisplayModel(
    {
      service: 'kick',
      data: {
        comment: 'Kick一般初コメ',
        isFirstTime: true,
        isOwner: true,
        username: 'hard-coded-owner',
        userId: 'owner-id',
        origin: { sender: { identity: { badges: [] } } },
      },
    },
    core.createAnonymousHistory(),
  )

  assert.deepEqual(model, { text: 'Kick一般初コメ', isFirstComment: true })
})

test('本人プロフィール画像はhttpとhttpsだけを許可する', () => {
  const makeOwner = (profileImage) =>
    core.createDisplayModel(
      {
        service: 'twicas',
        data: { comment: '本人', isOwner: true, profileImage },
      },
      core.createAnonymousHistory(),
    )

  assert.equal(makeOwner('https://example.test/owner.png').ownerImageUrl, 'https://example.test/owner.png')
  assert.equal(makeOwner('http://example.test/owner.png').ownerImageUrl, 'http://example.test/owner.png')
  assert.equal(makeOwner('javascript:alert(1)').ownerImageUrl, null)
  assert.equal(makeOwner('data:image/png;base64,AAAA').ownerImageUrl, null)
  assert.equal(makeOwner('/relative.png').ownerImageUrl, null)
  assert.equal(makeOwner('').ownerImageUrl, null)
})

test('通常コメントのHTML文字参照を名前付き・10進・16進とも1回だけデコードする', () => {
  assert.equal(
    core.decodeHtmlEntitiesOnce(
      '見た(´&gt;ω&lt;｀)☆ &amp; &quot; &#39; &#62; &#x3C; &#X1F600;',
    ),
    '見た(´>ω<｀)☆ & " \' > < 😀',
  )
  assert.equal(core.decodeHtmlEntitiesOnce('&amp;gt;'), '&gt;')
})

test('未知参照と不正な数値文字参照は推測せず保持する', () => {
  assert.equal(
    core.decodeHtmlEntitiesOnce(
      '&unknown; &#x110000; &#xD800; &#0; &#not-a-number;',
    ),
    '&unknown; &#x110000; &#xD800; &#0; &#not-a-number;',
  )
})

test('HTMLタグ文字列はデコード後も文字列としてモデルに保持しgift本文は変更しない', () => {
  const history = core.createAnonymousHistory()
  assert.equal(
    core.createDisplayModel(
      {
        service: 'twicas',
        data: {
          comment: '&lt;script&gt;alert(1)&lt;/script&gt;<img onerror=alert(2)>',
        },
      },
      history,
    ).text,
    '<script>alert(1)</script><img onerror=alert(2)>',
  )
  assert.equal(
    core.createDisplayModel(
      {
        service: 'twicas',
        data: { hasGift: true, speechText: 'Gift &gt; text' },
      },
      history,
    ).text,
    'Gift &gt; text',
  )
})

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const kickPresentation = require('../template/first-comment-big/kick-emote-presentation.js')

test('通常テキストはtextトークン1個になる', () => {
  assert.deepEqual(kickPresentation.parseKickContent('こんにちは'), [
    { type: 'text', value: 'こんにちは' },
  ])
})

test('通常Kickエモートを解析する', () => {
  assert.deepEqual(
    kickPresentation.parseKickContent(
      '[emote:5747999:collectiblesGoldenFIRE]',
    ),
    [
      {
        type: 'emote',
        id: '5747999',
        name: 'collectiblesGoldenFIRE',
      },
    ],
  )
})

test('配信者オリジナルエモートも通常エモートと同じ形式で解析する', () => {
  assert.deepEqual(
    kickPresentation.parseKickContent('[emote:5679209:chobitsukiorewa]'),
    [{ type: 'emote', id: '5679209', name: 'chobitsukiorewa' }],
  )
})

test('文字とエモートを元の順序で解析する', () => {
  const cases = [
    {
      content: '出発[emote:5747999:collectiblesGoldenFIRE]',
      expected: [
        { type: 'text', value: '出発' },
        {
          type: 'emote',
          id: '5747999',
          name: 'collectiblesGoldenFIRE',
        },
      ],
    },
    {
      content: '[emote:5679209:chobitsukiorewa]です',
      expected: [
        { type: 'emote', id: '5679209', name: 'chobitsukiorewa' },
        { type: 'text', value: 'です' },
      ],
    },
    {
      content: 'A[emote:111:foo]B',
      expected: [
        { type: 'text', value: 'A' },
        { type: 'emote', id: '111', name: 'foo' },
        { type: 'text', value: 'B' },
      ],
    },
  ]

  for (const { content, expected } of cases) {
    assert.deepEqual(kickPresentation.parseKickContent(content), expected)
  }
})

test('複数エモートと同一エモート連打をすべて保持する', () => {
  assert.deepEqual(
    kickPresentation.parseKickContent(
      'A[emote:111:foo]B[emote:222:bar]C',
    ),
    [
      { type: 'text', value: 'A' },
      { type: 'emote', id: '111', name: 'foo' },
      { type: 'text', value: 'B' },
      { type: 'emote', id: '222', name: 'bar' },
      { type: 'text', value: 'C' },
    ],
  )
  assert.deepEqual(
    kickPresentation.parseKickContent(
      '[emote:111:foo][emote:111:foo]',
    ),
    [
      { type: 'emote', id: '111', name: 'foo' },
      { type: 'emote', id: '111', name: 'foo' },
    ],
  )
})

test('不正ID・空名・不完全トークンは推測せずプレーンテキストに残す', () => {
  const inputs = [
    '[emote:abc:foo]',
    '[emote::foo]',
    '[emote:123:]',
    '[emote:123',
    '普通の[文字列]',
  ]

  for (const input of inputs) {
    assert.deepEqual(kickPresentation.parseKickContent(input), [
      { type: 'text', value: input },
    ])
  }
})

test('エモート名の危険な文字列は文字データとして保持する', () => {
  assert.deepEqual(
    kickPresentation.parseKickContent(
      '[emote:123:<img src=x onerror=alert(1)>]',
    ),
    [
      {
        type: 'emote',
        id: '123',
        name: '<img src=x onerror=alert(1)>',
      },
    ],
  )
})

test('画像URLは数字IDだけから固定ホストへ生成する', () => {
  assert.equal(
    kickPresentation.buildKickEmoteUrl('5747999'),
    'https://files.kick.com/emotes/5747999/original',
  )
  assert.equal(kickPresentation.buildKickEmoteUrl('abc'), null)
  assert.equal(kickPresentation.buildKickEmoteUrl('123/path'), null)
  assert.equal(kickPresentation.buildKickEmoteUrl(''), null)
})

test('Kickだけorigin.contentを優先して表示情報を作る', () => {
  const presentation = kickPresentation.createKickPresentation({
    service: 'kick',
    data: {
      origin: { content: '出発[emote:111:foo]' },
      speechText: '出発foo',
      comment: '<img src="unsafe">',
    },
  })

  assert.deepEqual(presentation, {
    tokens: [
      { type: 'text', value: '出発' },
      { type: 'emote', id: '111', name: 'foo' },
    ],
    fallbackText: '出発foo',
  })
  assert.equal(
    kickPresentation.createKickPresentation({
      service: 'youtube',
      data: { origin: { content: '[emote:111:foo]' } },
    }),
    null,
  )
})

test('origin.content欠落時はspeechText、commentの順でプレーンテキストへfallbackする', () => {
  const fromSpeech = kickPresentation.createKickPresentation({
    service: 'kick',
    data: { speechText: '読み上げ', comment: '<img src="unsafe">' },
  })
  assert.deepEqual(fromSpeech, {
    tokens: [{ type: 'text', value: '読み上げ' }],
    fallbackText: '読み上げ',
  })

  const fromComment = kickPresentation.createKickPresentation({
    service: 'kick',
    data: { comment: '<img src="unsafe">文字列のまま' },
  })
  assert.deepEqual(fromComment, {
    tokens: [{ type: 'text', value: '<img src="unsafe">文字列のまま' }],
    fallbackText: '<img src="unsafe">文字列のまま',
  })
})

test('利用できるKick表示元がなければ無視する', () => {
  assert.equal(
    kickPresentation.createKickPresentation({ service: 'kick', data: {} }),
    null,
  )
  assert.equal(
    kickPresentation.createKickPresentation({
      service: 'kick',
      data: { origin: { content: '   ' }, speechText: '', comment: '' },
    }),
    null,
  )
})

test('Kickでもgiftイベントは専用エモート表示の対象にしない', () => {
  assert.equal(
    kickPresentation.createKickPresentation({
      service: 'kick',
      data: {
        hasGift: true,
        origin: { content: '[emote:111:foo]' },
        speechText: 'gift text',
      },
    }),
    null,
  )
})

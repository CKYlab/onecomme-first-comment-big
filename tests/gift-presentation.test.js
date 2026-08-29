'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const giftPresentation = require('../template/first-comment-big/gift-presentation.js')

function makeGift(overrides = {}) {
  return {
    service: 'twicas',
    data: {
      comment: '<img class="gift-image" src="unsafe">Tea x 10 Tea x 10 (+🍡20)',
      hasGift: true,
      speechText: 'Tea x 10 Tea x 10 (+🍡20)',
      item: {
        name: 'Tea x 10',
        image: 'https://s01.example.test/tea.png',
      },
      ...overrides,
    },
  }
}

test('TwitCasting giftはitem.nameを優先してspeechTextの重複を表示しない', () => {
  assert.deepEqual(giftPresentation.createGiftPresentation(makeGift()), {
    text: 'Tea x 10 (+🍡20)',
    imageUrl: 'https://s01.example.test/tea.png',
    backgroundColor: '#ffffff',
    textColor: '#000000',
  })
})

test('speechText先頭のitem.nameだけを最大2回除去して残りを保持する', () => {
  const cases = [
    {
      itemName: 'お茶ｘ10',
      speechText: 'お茶ｘ10 お茶ｘ10 (+🍡20)',
      expected: 'お茶ｘ10 (+🍡20)',
    },
    {
      itemName: 'お茶爆100',
      speechText: 'お茶爆100 お茶爆100 (+🍡✨)',
      expected: 'お茶爆100 (+🍡✨)',
    },
    {
      itemName: 'お茶爆100',
      speechText: 'お茶爆100 お茶爆100 暑い中ありがとう(+🍡✨)',
      expected: 'お茶爆100 暑い中ありがとう(+🍡✨)',
    },
    {
      itemName: 'お茶',
      speechText: 'お茶 お茶 ありがとう！(+🍡2)',
      expected: 'お茶 ありがとう！(+🍡2)',
    },
    {
      itemName: 'Tea x 10',
      speechText: 'Tea x 10 Thanks',
      expected: 'Tea x 10 Thanks',
    },
    {
      itemName: 'Tea x 10',
      speechText: 'Tea x 10 Tea x 10 Tea x 10 remains',
      expected: 'Tea x 10 Tea x 10 remains',
    },
    {
      itemName: 'Tea x 10',
      speechText: 'Tea x 10 Thanks Tea x 10 again',
      expected: 'Tea x 10 Thanks Tea x 10 again',
    },
    {
      itemName: 'Tea',
      speechText: 'Teapot gift comment',
      expected: 'Tea Teapot gift comment',
    },
  ]

  for (const { itemName, speechText, expected } of cases) {
    assert.equal(
      giftPresentation.createGiftPresentation(
        makeGift({ item: { name: itemName }, speechText }),
      ).text,
      expected,
      speechText,
    )
  }
})

test('speechTextが使えない場合はitem.nameだけを表示する', () => {
  assert.equal(
    giftPresentation.createGiftPresentation(makeGift({ speechText: '' })).text,
    'Tea x 10',
  )
})

test('item.nameがない場合だけspeechTextへフォールバックする', () => {
  const comment = makeGift({
    item: { image: 'https://s01.example.test/tea.png' },
    speechText: '安全な読み上げテキスト',
  })

  assert.deepEqual(giftPresentation.createGiftPresentation(comment), {
    text: '安全な読み上げテキスト',
    imageUrl: 'https://s01.example.test/tea.png',
    backgroundColor: '#ffffff',
    textColor: '#000000',
  })
})

test('無料giftはcolorsやmeta.freeに関係なく白背景・黒文字になる', () => {
  const comment = makeGift({
    isFreeGift: true,
    colors: {
      bodyBackgroundColor: 'rgb(42, 96, 178)',
      bodyTextColor: 'rgb(255, 255, 255)',
    },
  })
  comment.meta = { free: false }

  const presentation = giftPresentation.createGiftPresentation(comment)
  assert.equal(presentation.backgroundColor, '#ffffff')
  assert.equal(presentation.textColor, '#000000')
})

test('有料giftはpriceで算出せずOneSDKのbody背景色・文字色をそのまま使用する', () => {
  const presentation = giftPresentation.createGiftPresentation(
    makeGift({
      price: 100,
      isFreeGift: false,
      colors: {
        bodyBackgroundColor: 'rgb(12, 34, 56)',
        bodyTextColor: 'rgb(210, 220, 230)',
      },
    }),
  )

  assert.equal(presentation.backgroundColor, 'rgb(12, 34, 56)')
  assert.equal(presentation.textColor, 'rgb(210, 220, 230)')
})

test('有料giftでもcolorsが欠落した場合は白背景・黒文字へfallbackする', () => {
  const presentation = giftPresentation.createGiftPresentation(
    makeGift({ isFreeGift: false, colors: null }),
  )

  assert.equal(presentation.backgroundColor, '#ffffff')
  assert.equal(presentation.textColor, '#000000')
})

test('giftのdata.commentに含まれるHTMLは表示テキストに使用しない', () => {
  const comment = makeGift({
    item: null,
    speechText: '',
  })

  assert.equal(giftPresentation.createGiftPresentation(comment), null)
})

test('画像URLはhttpまたはhttpsだけを許可する', () => {
  assert.equal(
    giftPresentation.createGiftPresentation(
      makeGift({ item: { name: 'HTTP item', image: 'http://example.test/item.png' } }),
    ).imageUrl,
    'http://example.test/item.png',
  )
  assert.equal(
    giftPresentation.createGiftPresentation(
      makeGift({ item: { name: 'JavaScript item', image: 'javascript:alert(1)' } }),
    ).imageUrl,
    null,
  )
  assert.equal(
    giftPresentation.createGiftPresentation(
      makeGift({ item: { name: 'Data item', image: 'data:image/png;base64,AAAA' } }),
    ).imageUrl,
    null,
  )
  assert.equal(
    giftPresentation.createGiftPresentation(
      makeGift({ item: { name: 'Relative item', image: '/item.png' } }),
    ).imageUrl,
    null,
  )
})

test('TwitCasting以外またはhasGift strict true以外は独自gift表示を作らない', () => {
  const otherService = makeGift()
  otherService.service = 'youtube'
  assert.equal(giftPresentation.createGiftPresentation(otherService), null)
  assert.equal(
    giftPresentation.createGiftPresentation(makeGift({ hasGift: 1 })),
    null,
  )
})

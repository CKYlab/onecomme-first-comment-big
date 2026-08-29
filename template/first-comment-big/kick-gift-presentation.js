;(function exposeKickGiftPresentation(root, factory) {
  'use strict'

  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentKickGiftPresentation = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createKickGiftPresentationApi() {
  'use strict'

  function isNonBlankString(value) {
    return typeof value === 'string' && value.trim().length > 0
  }

  function sanitizeHttpImageUrl(value) {
    if (!isNonBlankString(value)) return null

    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? parsed.href
        : null
    } catch {
      return null
    }
  }

  function formatKickAmount(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? `(${value})` : '(KICKs)'
    }

    if (typeof value === 'string') {
      const normalized = value.trim()
      return /^[0-9]+$/.test(normalized) && Number(normalized) > 0
        ? `(${normalized})`
        : '(KICKs)'
    }

    return '(KICKs)'
  }

  function createKickGiftPresentation(comment) {
    if (
      !comment ||
      comment.service !== 'kick' ||
      !comment.data ||
      typeof comment.data !== 'object' ||
      comment.data.hasGift !== true
    ) {
      return null
    }

    const data = comment.data
    const gift = data.gift && typeof data.gift === 'object' ? data.gift : null
    const colors =
      data.colors && typeof data.colors === 'object' ? data.colors : null
    const origin =
      data.origin && typeof data.origin === 'object' ? data.origin : null
    const originGift =
      origin && origin.gift && typeof origin.gift === 'object'
        ? origin.gift
        : null

    const imageUrls = []
    if (gift) {
      for (const candidate of [gift.static_url, gift.animated_url]) {
        const imageUrl = sanitizeHttpImageUrl(candidate)
        if (imageUrl && !imageUrls.includes(imageUrl)) imageUrls.push(imageUrl)
      }
    }

    return {
      amountText: formatKickAmount(originGift ? originGift.amount : null),
      message:
        origin && isNonBlankString(origin.message)
          ? origin.message.trim()
          : null,
      imageUrls,
      backgroundColor:
        colors && isNonBlankString(colors.bodyBackgroundColor)
          ? colors.bodyBackgroundColor
          : '#ffffff',
      textColor:
        colors && isNonBlankString(colors.bodyTextColor)
          ? colors.bodyTextColor
          : '#000000',
    }
  }

  return Object.freeze({
    createKickGiftPresentation,
    formatKickAmount,
    sanitizeHttpImageUrl,
  })
})

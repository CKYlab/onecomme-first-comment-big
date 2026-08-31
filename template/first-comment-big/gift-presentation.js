;(function exposeGiftPresentation(root, factory) {
  'use strict'

  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentGiftPresentation = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGiftPresentationApi() {
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

  function removeLeadingItemNames(speechText, itemName) {
    if (!isNonBlankString(speechText) || !isNonBlankString(itemName)) {
      return isNonBlankString(speechText) ? speechText.trim() : ''
    }

    const normalizedName = itemName.trim()
    let remaining = speechText.trim()

    for (let removed = 0; removed < 2; removed += 1) {
      if (!remaining.startsWith(normalizedName)) break

      const following = remaining.slice(normalizedName.length)
      if (following.length > 0 && !/^\s/u.test(following)) break
      remaining = following.trimStart()
    }

    return remaining
  }

  function createGiftPresentation(comment) {
    if (
      !comment ||
      comment.service !== 'twicas' ||
      !comment.data ||
      comment.data.hasGift !== true
    ) {
      return null
    }

    const data = comment.data
    const item = data.item && typeof data.item === 'object' ? data.item : null
    const itemName = item && isNonBlankString(item.name) ? item.name.trim() : null
    const speechText = isNonBlankString(data.speechText)
      ? data.speechText.trim()
      : null
    const remainingText =
      itemName && speechText
        ? removeLeadingItemNames(speechText, itemName)
        : speechText
    const text = itemName
      ? remainingText
        ? `${itemName} ${remainingText}`
        : itemName
      : speechText
    if (text === null) return null

    const colors =
      data.colors && typeof data.colors === 'object' ? data.colors : null
    const usePaidColors = data.isFreeGift !== true
    const backgroundColor =
      usePaidColors && colors && isNonBlankString(colors.bodyBackgroundColor)
        ? colors.bodyBackgroundColor
        : 'var(--gift-neutral-background, #ffffff)'
    const textColor =
      usePaidColors && colors && isNonBlankString(colors.bodyTextColor)
        ? colors.bodyTextColor
        : 'var(--gift-neutral-text-color, #000000)'

    return {
      text,
      imageUrl: item ? sanitizeHttpImageUrl(item.image) : null,
      backgroundColor,
      textColor,
    }
  }

  return Object.freeze({
    createGiftPresentation,
    removeLeadingItemNames,
    sanitizeHttpImageUrl,
  })
})

;(function exposeKickEmotePresentation(root, factory) {
  'use strict'

  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentKickEmotePresentation = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createKickEmotePresentationApi() {
  'use strict'

  const KICK_EMOTE_PATTERN = /\[emote:([0-9]+):([^\]\r\n]+)\]/g
  const KICK_EMOTE_URL_PREFIX = 'https://files.kick.com/emotes/'

  function isNonBlankString(value) {
    return typeof value === 'string' && value.trim().length > 0
  }

  function parseKickContent(content) {
    if (typeof content !== 'string' || content.length === 0) return []

    const tokens = []
    let textStart = 0

    for (const match of content.matchAll(KICK_EMOTE_PATTERN)) {
      if (match.index > textStart) {
        tokens.push({ type: 'text', value: content.slice(textStart, match.index) })
      }
      tokens.push({ type: 'emote', id: match[1], name: match[2] })
      textStart = match.index + match[0].length
    }

    if (textStart < content.length) {
      tokens.push({ type: 'text', value: content.slice(textStart) })
    }

    return tokens
  }

  function buildKickEmoteUrl(id) {
    return typeof id === 'string' && /^[0-9]+$/.test(id)
      ? `${KICK_EMOTE_URL_PREFIX}${id}/original`
      : null
  }

  function createKickPresentation(comment) {
    if (
      !comment ||
      comment.service !== 'kick' ||
      !comment.data ||
      typeof comment.data !== 'object' ||
      comment.data.hasGift === true
    ) {
      return null
    }

    const data = comment.data
    let tokens
    if (
      data.origin &&
      typeof data.origin === 'object' &&
      isNonBlankString(data.origin.content)
    ) {
      tokens = parseKickContent(data.origin.content)
    } else if (isNonBlankString(data.speechText)) {
      tokens = [{ type: 'text', value: data.speechText }]
    } else if (isNonBlankString(data.comment)) {
      tokens = [{ type: 'text', value: data.comment }]
    } else {
      return null
    }

    const fallbackText = tokens
      .map((token) => (token.type === 'emote' ? token.name : token.value))
      .join('')

    return { tokens, fallbackText }
  }

  return Object.freeze({
    buildKickEmoteUrl,
    createKickPresentation,
    parseKickContent,
  })
})

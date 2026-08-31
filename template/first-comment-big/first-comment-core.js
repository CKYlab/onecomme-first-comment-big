;(function exposeFirstCommentBigCore(root, factory) {
  'use strict'

  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.FirstCommentBigCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createFirstCommentBigCore() {
  'use strict'

  const STORAGE_KEY = 'onecomme.first-comment-big.anonymous-history.v1'
  const MAX_LIVES = 15
  const NAMED_HTML_ENTITIES = Object.freeze({
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
  })

  function isNonBlankString(value) {
    return typeof value === 'string' && value.trim().length > 0
  }

  function createAnonymousIdentity(service, liveId, name) {
    if (
      !isNonBlankString(service) ||
      !isNonBlankString(liveId) ||
      !isNonBlankString(name)
    ) {
      return null
    }
    return { service, liveId, name }
  }

  function decodeHtmlEntitiesOnce(value) {
    if (typeof value !== 'string' || value.length === 0) return value

    return value.replace(
      /&(?:amp|apos|gt|lt|quot|#(?:[0-9]+|[xX][0-9a-fA-F]+));/g,
      (entity) => {
        if (Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, entity)) {
          return NAMED_HTML_ENTITIES[entity]
        }

        const encodedNumber = entity.slice(2, -1)
        const hexadecimal = encodedNumber[0] === 'x' || encodedNumber[0] === 'X'
        const digits = hexadecimal ? encodedNumber.slice(1) : encodedNumber
        const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10)
        if (
          !Number.isInteger(codePoint) ||
          codePoint <= 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return entity
        }
        return String.fromCodePoint(codePoint)
      },
    )
  }

  function isOwnerComment(comment) {
    if (!comment || !comment.data || typeof comment.data !== 'object') {
      return false
    }

    const data = comment.data
    if (comment.service === 'twicas') return data.isOwner === true
    if (comment.service !== 'kick') return false

    const badges =
      data.origin &&
      data.origin.sender &&
      data.origin.sender.identity &&
      data.origin.sender.identity.badges
    return (
      Array.isArray(badges) &&
      badges.some(
        (badge) => badge && typeof badge === 'object' && badge.type === 'broadcaster',
      )
    )
  }

  function sanitizeOwnerImageUrl(value) {
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

  function normalizeStoredLives(value, maxLives) {
    if (!value || value.version !== 1 || !Array.isArray(value.lives)) return []

    const lives = []
    for (const candidate of value.lives) {
      if (
        !candidate ||
        !isNonBlankString(candidate.service) ||
        !isNonBlankString(candidate.liveId) ||
        !Array.isArray(candidate.names)
      ) {
        continue
      }

      const names = Array.from(new Set(candidate.names.filter(isNonBlankString)))
      if (names.length === 0) continue

      const existingIndex = lives.findIndex(
        (live) =>
          live.service === candidate.service && live.liveId === candidate.liveId,
      )
      if (existingIndex >= 0) {
        const existing = lives.splice(existingIndex, 1)[0]
        existing.names = Array.from(new Set([...existing.names, ...names]))
        lives.push(existing)
      } else {
        lives.push({ service: candidate.service, liveId: candidate.liveId, names })
      }
    }

    return lives.slice(-maxLives)
  }

  function createAnonymousHistory(options = {}) {
    const maxLives =
      Number.isInteger(options.maxLives) && options.maxLives > 0
        ? options.maxLives
        : MAX_LIVES
    const storage = options.storage || null
    const warn = typeof options.warn === 'function' ? options.warn : () => {}
    let storageAvailable =
      storage !== null &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function'
    let warningIssued = false
    let lives = []

    function warnOnce(error) {
      if (warningIssued) return
      warningIssued = true
      warn('[初コメBIG] localStorageを利用できないため、匿名履歴をメモリだけで管理します。', error)
    }

    if (storageAvailable) {
      try {
        const stored = storage.getItem(STORAGE_KEY)
        if (stored !== null) {
          try {
            lives = normalizeStoredLives(JSON.parse(stored), maxLives)
          } catch {
            lives = []
          }
        }
      } catch (error) {
        storageAvailable = false
        warnOnce(error)
      }
    }

    function toJSON() {
      return {
        version: 1,
        lives: lives.map((live) => ({
          service: live.service,
          liveId: live.liveId,
          names: [...live.names],
        })),
      }
    }

    function persist() {
      if (!storageAvailable) return
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(toJSON()))
      } catch (error) {
        storageAvailable = false
        warnOnce(error)
      }
    }

    function remember(identity) {
      if (!identity) return false
      const normalized = createAnonymousIdentity(
        identity.service,
        identity.liveId,
        identity.name,
      )
      if (!normalized) return false

      const liveIndex = lives.findIndex(
        (live) =>
          live.service === normalized.service && live.liveId === normalized.liveId,
      )
      let live
      if (liveIndex >= 0) {
        live = lives.splice(liveIndex, 1)[0]
      } else {
        live = { service: normalized.service, liveId: normalized.liveId, names: [] }
      }

      const isFirst = !live.names.includes(normalized.name)
      if (isFirst) live.names.push(normalized.name)
      lives.push(live)
      if (lives.length > maxLives) lives = lives.slice(-maxLives)
      persist()
      return isFirst
    }

    return Object.freeze({ remember, toJSON })
  }

  function selectText(data) {
    if (data.hasGift === true) {
      if (isNonBlankString(data.speechText)) return data.speechText
      if (data.item && isNonBlankString(data.item.name)) return data.item.name
      return null
    }
    return isNonBlankString(data.comment) ? data.comment : null
  }

  function createDisplayModel(comment, history, options = {}) {
    if (
      !comment ||
      typeof comment !== 'object' ||
      !comment.data ||
      typeof comment.data !== 'object'
    ) {
      return null
    }

    const data = comment.data
    const selectedText = selectText(data)
    if (selectedText === null) return null
    if (data.hasGift === true) {
      return { text: selectedText, isFirstComment: false }
    }

    const text = decodeHtmlEntitiesOnce(selectedText)
    if (isOwnerComment(comment)) {
      return {
        text,
        isFirstComment: false,
        isOwner: true,
        ownerImageUrl: sanitizeOwnerImageUrl(data.profileImage),
      }
    }

    if (comment.service === 'twicas' && data.isAnonymous === true) {
      const identity = createAnonymousIdentity(
        comment.service,
        data.liveId,
        data.name,
      )
      const firstObserved =
        identity && history && typeof history.remember === 'function'
          ? history.remember(identity)
          : false
      const isFirstComment =
        options.anonymousFirstCommentBig === true && firstObserved === true
      return { text, isFirstComment }
    }

    return { text, isFirstComment: data.isFirstTime === true }
  }

  return Object.freeze({
    MAX_LIVES,
    STORAGE_KEY,
    createAnonymousHistory,
    createDisplayModel,
    decodeHtmlEntitiesOnce,
    isOwnerComment,
    sanitizeOwnerImageUrl,
  })
})

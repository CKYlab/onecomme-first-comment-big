;(function exposeProbeCore(root, factory) {
  'use strict'

  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.OneSDKProbeCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProbeCore() {
  'use strict'

  const MISSING_VALUE = '[Missing]'

  function createSnapshot(value) {
    const ancestors = new WeakSet()

    function visit(current) {
      if (current === null) return null

      const type = typeof current
      if (type === 'string' || type === 'boolean') return current
      if (type === 'number') {
        return Number.isFinite(current) ? current : `[Number: ${String(current)}]`
      }
      if (type === 'bigint') return `[BigInt: ${String(current)}]`
      if (type === 'undefined') return '[Undefined]'
      if (type === 'function') return `[Function: ${current.name || 'anonymous'}]`
      if (type === 'symbol') return `[Symbol: ${current.description || ''}]`

      if (ancestors.has(current)) return '[Circular]'
      ancestors.add(current)

      try {
        if (current instanceof Date) {
          return Number.isNaN(current.getTime()) ? '[Date: Invalid]' : current.toISOString()
        }

        if (Array.isArray(current)) return current.map((item) => visit(item))

        const copy = {}
        let keys
        try {
          keys = Object.keys(current)
        } catch (error) {
          return `[Unserializable object: ${getErrorMessage(error)}]`
        }

        for (const key of keys) {
          try {
            copy[key] = visit(current[key])
          } catch (error) {
            copy[key] = `[Unserializable property: ${getErrorMessage(error)}]`
          }
        }
        return copy
      } finally {
        ancestors.delete(current)
      }
    }

    try {
      return visit(value)
    } catch (error) {
      return { __probeSnapshotError: getErrorMessage(error) }
    }
  }

  function getErrorMessage(error) {
    if (error && typeof error.message === 'string') return error.message
    return String(error)
  }

  function readPath(value, path) {
    let current = value
    for (const key of path) {
      if (
        current === null ||
        (typeof current !== 'object' && typeof current !== 'function') ||
        !Object.prototype.hasOwnProperty.call(current, key)
      ) {
        return MISSING_VALUE
      }
      try {
        current = current[key]
      } catch (error) {
        return `[Unreadable: ${getErrorMessage(error)}]`
      }
    }
    return current
  }

  function createSummary(comment) {
    return {
      service: readPath(comment, ['service']),
      'comment.id': readPath(comment, ['id']),
      'comment.data.id': readPath(comment, ['data', 'id']),
      'comment.data.liveId': readPath(comment, ['data', 'liveId']),
      'comment.data.userId': readPath(comment, ['data', 'userId']),
      'comment.data.name': readPath(comment, ['data', 'name']),
      'comment.data.displayName': readPath(comment, ['data', 'displayName']),
      'comment.data.screenName': readPath(comment, ['data', 'screenName']),
      'comment.data.isFirstTime': readPath(comment, ['data', 'isFirstTime']),
      'comment.data.isRepeater': readPath(comment, ['data', 'isRepeater']),
      'comment.data.meta': readPath(comment, ['data', 'meta']),
      'comment.data.meta.anonymity': readPath(comment, ['data', 'meta', 'anonymity']),
      'comment.data.isAnonymous': readPath(comment, ['data', 'isAnonymous']),
      'comment.data.comment': readPath(comment, ['data', 'comment']),
    }
  }

  function appendCapped(entries, value, limit) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 100
    entries.push(value)
    if (entries.length > safeLimit) entries.splice(0, entries.length - safeLimit)
    return entries
  }

  function formatJson(value) {
    try {
      return JSON.stringify(createSnapshot(value), null, 2)
    } catch (error) {
      return JSON.stringify({ __probeFormatError: getErrorMessage(error) }, null, 2)
    }
  }

  return Object.freeze({
    MISSING_VALUE,
    appendCapped,
    createSnapshot,
    createSummary,
    formatJson,
  })
})

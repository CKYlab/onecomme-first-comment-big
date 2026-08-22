;(function startOneSDKProbe() {
  'use strict'

  const MAX_LOG_ENTRIES = 100
  const core = window.OneSDKProbeCore
  const OneSDK = window.OneSDK
  const elements = {
    actionStatus: document.getElementById('action-status'),
    clearLogs: document.getElementById('clear-logs'),
    connectionStatus: document.getElementById('connection-status'),
    copyLogs: document.getElementById('copy-logs'),
    logCount: document.getElementById('log-count'),
    rawJson: document.getElementById('raw-json'),
    receivedAt: document.getElementById('received-at'),
    summaryBody: document.getElementById('summary-body'),
  }

  const requiredElements = Object.values(elements)
  const probeLog = []
  window.__oneSDKProbeLog = probeLog

  let disposed = false
  let subscriberId = null
  let statusTimer = null

  function setConnectionStatus(message) {
    if (elements.connectionStatus) elements.connectionStatus.textContent = message
  }

  function setActionStatus(message) {
    if (!elements.actionStatus) return
    elements.actionStatus.textContent = message
    window.clearTimeout(statusTimer)
    statusTimer = window.setTimeout(() => {
      elements.actionStatus.textContent = ''
    }, 4000)
  }

  function displayValue(value) {
    if (value !== null && typeof value === 'object') return core.formatJson(value)
    return String(value)
  }

  function renderEmptyState() {
    elements.logCount.textContent = '0'
    elements.receivedAt.textContent = 'No comments received'
    elements.rawJson.textContent = 'No comments received.'
    elements.summaryBody.replaceChildren()

    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.colSpan = 2
    cell.className = 'empty'
    cell.textContent = 'Waiting for a OneSDK comment…'
    row.append(cell)
    elements.summaryBody.append(row)
  }

  function renderEntry(entry) {
    elements.logCount.textContent = String(probeLog.length)
    elements.receivedAt.textContent = entry.receivedAt
    elements.rawJson.textContent = core.formatJson(entry.raw)
    elements.summaryBody.replaceChildren()

    for (const [field, value] of Object.entries(entry.summary)) {
      const row = document.createElement('tr')
      const fieldCell = document.createElement('td')
      const valueCell = document.createElement('td')
      fieldCell.textContent = field
      valueCell.textContent = displayValue(value)
      row.append(fieldCell, valueCell)
      elements.summaryBody.append(row)
    }
  }

  function printEntry(entry, index) {
    console.groupCollapsed(`[OneSDK Probe] Comment ${index} received at ${entry.receivedAt}`)
    console.table(
      Object.entries(entry.summary).map(([field, value]) => ({
        field,
        value: displayValue(value),
      })),
    )
    console.log('RAW detached snapshot', entry.raw)
    console.groupEnd()
  }

  function receiveComments(comments) {
    if (disposed || !Array.isArray(comments)) return

    for (const comment of comments) {
      // Capture first. No display model, anonymous decision, or field-derived filtering precedes this.
      const raw = core.createSnapshot(comment)
      const entry = {
        receivedAt: new Date().toISOString(),
        summary: core.createSummary(raw),
        raw,
      }

      core.appendCapped(probeLog, entry, MAX_LOG_ENTRIES)
      printEntry(entry, probeLog.length)
      renderEntry(entry)
    }
  }

  async function copyLogs() {
    const json = core.formatJson(probeLog)
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API is unavailable')
      }
      await navigator.clipboard.writeText(json)
      setActionStatus(`Copied ${probeLog.length} log entr${probeLog.length === 1 ? 'y' : 'ies'}.`)
    } catch (error) {
      console.warn('[OneSDK Probe] Clipboard copy failed. Full log JSON follows.', error)
      console.log(json)
      setActionStatus('Copy failed — full logs were printed to Console.')
    }
  }

  function clearLogs() {
    probeLog.length = 0
    renderEmptyState()
    setActionStatus('Logs cleared.')
    console.info('[OneSDK Probe] In-memory logs cleared.')
  }

  function dispose() {
    if (disposed) return
    disposed = true
    window.clearTimeout(statusTimer)
    window.removeEventListener('pagehide', dispose)
    elements.copyLogs.removeEventListener('click', copyLogs)
    elements.clearLogs.removeEventListener('click', clearLogs)

    if (subscriberId !== null && OneSDK && typeof OneSDK.unsubscribe === 'function') {
      try {
        OneSDK.unsubscribe(subscriberId)
      } catch (error) {
        console.warn('[OneSDK Probe] Failed to unsubscribe cleanly.', error)
      }
    }
    subscriberId = null
  }

  async function initialize() {
    if (!core || !OneSDK || requiredElements.some((element) => !element)) {
      throw new Error('Required OneSDK, probe core, or DOM elements are unavailable')
    }

    elements.copyLogs.addEventListener('click', copyLogs)
    elements.clearLogs.addEventListener('click', clearLogs)
    renderEmptyState()
    document.body.removeAttribute('hidden')

    setConnectionStatus('Waiting for OneSDK…')
    await OneSDK.ready()
    if (disposed) return

    const permissions =
      OneSDK.usePermission && OneSDK.PERM && OneSDK.PERM.COMMENT
        ? OneSDK.usePermission([OneSDK.PERM.COMMENT])
        : ['comments']

    await OneSDK.setup({
      mode: 'diff',
      disabledDelay: true,
      permissions,
    })
    if (disposed) return

    subscriberId = OneSDK.subscribe({
      action: 'comments',
      callback: receiveComments,
    })
    await OneSDK.connect()
    if (disposed) return
    setConnectionStatus('Connected — waiting for comments')
  }

  window.addEventListener('pagehide', dispose)
  initialize().catch((error) => {
    console.error('[OneSDK Probe] Initialization failed.', error)
    setConnectionStatus('Initialization failed — check Console')
    document.body.removeAttribute('hidden')
    dispose()
  })
})()

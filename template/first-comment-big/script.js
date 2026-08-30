;(function startFirstCommentBig() {
  'use strict'

  const MAX_COMMENT_ELEMENTS = 100
  const core = window.FirstCommentBigCore
  const giftPresentation = window.FirstCommentGiftPresentation
  const kickGiftPresentation = window.FirstCommentKickGiftPresentation
  const kickEmotePresentation = window.FirstCommentKickEmotePresentation
  const settingsClientFactory = window.FirstCommentBigSettingsClient
  const OneSDK = window.OneSDK
  const container = document.getElementById('comments')

  let disposed = false
  let subscriberId = null
  let settingsClient = null

  function warnStorage(message, error) {
    console.warn(message, error)
  }

  function applyGiftColors(element, gift) {
    element.style.backgroundColor = '#ffffff'
    element.style.color = '#000000'
    element.style.backgroundColor = gift.backgroundColor
    element.style.color = gift.textColor
  }

  let storage = null
  try {
    storage = window.localStorage
  } catch (error) {
    warnStorage(
      '[初コメBIG] localStorageを利用できないため、匿名履歴をメモリだけで管理します。',
      error,
    )
  }

  const history = core
    ? core.createAnonymousHistory({ storage, warn: warnStorage })
    : null

  function fitCommentsToViewport() {
    while (container.childElementCount > MAX_COMMENT_ELEMENTS) {
      container.lastElementChild.remove()
    }
    while (
      container.childElementCount > 1 &&
      container.scrollHeight > container.clientHeight
    ) {
      container.lastElementChild.remove()
    }
    container.scrollTop = 0
  }

  function startSettingsClient() {
    if (
      !settingsClientFactory ||
      typeof settingsClientFactory.createSettingsClient !== 'function'
    ) {
      console.warn(
        '[初コメBIG] 設定クライアントを読み込めないため既定表示を使用します。',
      )
      return
    }

    try {
      settingsClient = settingsClientFactory.createSettingsClient({
        rootElement: document.documentElement,
        fitCommentsToViewport,
      })
      void settingsClient.start().catch((error) => {
        console.warn(
          '[初コメBIG] 設定機能を開始できないため既定表示を使用します。',
          error,
        )
      })
    } catch (error) {
      console.warn(
        '[初コメBIG] 設定機能を開始できないため既定表示を使用します。',
        error,
      )
    }
  }

  function appendKickContent(element, presentation) {
    for (const token of presentation.tokens) {
      if (token.type === 'text') {
        element.append(
          document.createTextNode(core.decodeHtmlEntitiesOnce(token.value)),
        )
        continue
      }

      const imageUrl = kickEmotePresentation.buildKickEmoteUrl(token.id)
      if (!imageUrl) {
        element.append(document.createTextNode(token.name))
        continue
      }

      const image = document.createElement('img')
      image.className = 'kick-emote'
      image.alt = token.name
      image.referrerPolicy = 'no-referrer'
      image.addEventListener('load', fitCommentsToViewport, { once: true })
      image.addEventListener(
        'error',
        () => {
          image.replaceWith(document.createTextNode(token.name))
          fitCommentsToViewport()
        },
        { once: true },
      )
      image.src = imageUrl
      element.append(image)
    }
  }

  function appendKickGiftContent(element, presentation) {
    const header = document.createElement('span')
    header.className = 'kick-gift__header'

    if (presentation.imageUrls.length > 0) {
      const image = document.createElement('img')
      image.className = 'kick-gift__image'
      image.alt = ''
      image.referrerPolicy = 'no-referrer'

      let imageIndex = 0
      image.addEventListener('load', fitCommentsToViewport)
      image.addEventListener('error', () => {
        imageIndex += 1
        if (imageIndex < presentation.imageUrls.length) {
          image.src = presentation.imageUrls[imageIndex]
          return
        }
        image.remove()
        fitCommentsToViewport()
      })
      image.src = presentation.imageUrls[imageIndex]
      header.append(image)
    }

    const amount = document.createElement('span')
    amount.className = 'kick-gift__amount'
    amount.textContent = presentation.amountText
    header.append(amount)
    element.append(header)

    if (presentation.message) {
      const message = document.createElement('span')
      message.className = 'kick-gift__message'
      message.textContent = core.decodeHtmlEntitiesOnce(presentation.message)
      element.append(message)
    }
  }

  function renderModel(model, comment, kickPresentation, kickGift) {
    const element = document.createElement('p')
    element.className = model.isFirstComment ? 'comment comment--first' : 'comment'
    const gift = giftPresentation.createGiftPresentation(comment)

    if (kickGift) {
      element.classList.add('comment--kick-gift')
      applyGiftColors(element, kickGift)
      appendKickGiftContent(element, kickGift)
    } else if (gift) {
      element.classList.add('comment--gift')
      applyGiftColors(element, gift)
      if (gift.imageUrl) {
        const image = document.createElement('img')
        image.className = 'gift-image'
        image.alt = ''
        image.referrerPolicy = 'no-referrer'
        image.src = gift.imageUrl
        image.addEventListener('error', () => image.remove(), { once: true })
        element.append(image)
      }

      const text = document.createElement('span')
      text.className = 'comment-text'
      text.textContent = gift.text
      element.append(text)
    } else {
      let contentElement = element
      if (model.isOwner === true) {
        element.classList.add('comment--owner')
        if (model.ownerImageUrl) {
          const image = document.createElement('img')
          image.className = 'owner-image'
          image.alt = ''
          image.referrerPolicy = 'no-referrer'
          image.addEventListener('load', fitCommentsToViewport, { once: true })
          image.addEventListener(
            'error',
            () => {
              image.remove()
              fitCommentsToViewport()
            },
            { once: true },
          )
          image.src = model.ownerImageUrl
          element.append(image)
        }

        contentElement = document.createElement('span')
        contentElement.className = 'comment-text'
        element.append(contentElement)
      }

      if (kickPresentation) {
        appendKickContent(contentElement, kickPresentation)
      } else {
        contentElement.textContent = model.text
      }
    }

    container.prepend(element)
    fitCommentsToViewport()
  }

  function receiveComments(comments) {
    if (disposed || !Array.isArray(comments)) return

    for (const comment of comments) {
      const kickGift = kickGiftPresentation.createKickGiftPresentation(comment)
      const kickPresentation = kickEmotePresentation.createKickPresentation(comment)
      const modelInput = kickGift
        ? {
            ...comment,
            data: { ...comment.data, speechText: kickGift.amountText },
          }
        : kickPresentation
        ? {
            ...comment,
            data: { ...comment.data, comment: kickPresentation.fallbackText },
          }
        : comment
      const model = core.createDisplayModel(modelInput, history)
      if (model) renderModel(model, comment, kickPresentation, kickGift)
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true
    window.removeEventListener('pagehide', dispose)

    if (settingsClient && typeof settingsClient.stop === 'function') {
      try {
        settingsClient.stop()
      } catch (error) {
        console.warn('[初コメBIG] 設定機能の停止に失敗しました。', error)
      }
    }

    if (
      subscriberId !== null &&
      OneSDK &&
      typeof OneSDK.unsubscribe === 'function'
    ) {
      try {
        OneSDK.unsubscribe(subscriberId)
      } catch (error) {
        console.warn('[初コメBIG] OneSDKの購読解除に失敗しました。', error)
      }
    }
    subscriberId = null
  }

  async function initialize() {
    if (
      !core ||
      !giftPresentation ||
      !kickGiftPresentation ||
      !kickEmotePresentation ||
      !OneSDK ||
      !container
    ) {
      throw new Error(
        '必要なOneSDK、判定コア、gift表示、Kick表示、または表示領域を読み込めませんでした。',
      )
    }

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
    document.body.removeAttribute('hidden')
  }

  window.addEventListener('pagehide', dispose)
  startSettingsClient()
  initialize().catch((error) => {
    console.error('[初コメBIG] OneSDKの初期化に失敗しました。', error)
    document.body.removeAttribute('hidden')
    dispose()
  })
})()

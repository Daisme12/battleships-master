import {
  DEFAULT_SETTINGS,
  getModeLabel,
  loadSettings,
  saveSettings,
} from '../shared/settings.js'

const ROOM_INTENT_KEY = 'battleships-room-intent'

document.addEventListener('DOMContentLoaded', () => {
  const pageMode = document.body.dataset.page

  if (pageMode === 'mode-select') {
    bindModeSelection()
    return
  }

  if (pageMode === 'mode-config') {
    bindModeConfig()
  }
})

function bindModeSelection() {
  const modeLinks = document.querySelectorAll('[data-mode]')

  modeLinks.forEach(link => {
    link.addEventListener('click', () => {
      const current = loadSettings()
      saveSettings({
        ...current,
        mode: link.dataset.mode,
      })
    })
  })
}

function bindModeConfig() {
  const settings = loadSettings()
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode') === 'multiPlayer' ? 'multiPlayer' : 'singlePlayer'

  const title = document.querySelector('#config-title')
  const difficultyField = document.querySelector('#difficulty-field')
  const difficultyInput = document.querySelector('#difficulty')
  const turnSecondsInput = document.querySelector('#turn-seconds')
  const matchSecondsInput = document.querySelector('#match-seconds')
  const summary = document.querySelector('#menu-summary')
  const startLink = document.querySelector('#start-link')
  const roomSetup = document.querySelector('#multiplayer-room-setup')
  const menuCreateRoomButton = document.querySelector('#menu-create-room')
  const menuJoinRoomButton = document.querySelector('#menu-join-room')
  const menuJoinRoomCodeInput = document.querySelector('#menu-join-room-code')
  const menuRoomCodeDisplay = document.querySelector('#menu-room-code-display')
  const menuRoomStatus = document.querySelector('#menu-room-status')

  if (!turnSecondsInput || !matchSecondsInput || !summary || !startLink || !title) return

  title.textContent = `${getModeLabel(mode)} Settings`
  startLink.href = mode === 'multiPlayer' ? 'multiplayer.html' : 'singleplayer.html'

  if (mode === 'multiPlayer' && difficultyField) {
    difficultyField.style.display = 'none'
  }

  if (mode === 'multiPlayer') {
    roomSetup.style.display = 'grid'
    menuRoomCodeDisplay.style.display = 'block'
    menuRoomStatus.style.display = 'block'
    startLink.style.display = 'none'

    menuCreateRoomButton?.addEventListener('click', () => {
      persistSettings()
      window.sessionStorage.setItem(ROOM_INTENT_KEY, JSON.stringify({ action: 'create' }))
      window.location.href = 'multiplayer.html'
    })

    menuJoinRoomButton?.addEventListener('click', () => {
      const roomId = menuJoinRoomCodeInput.value.trim().toUpperCase()
      if (!roomId) {
        menuRoomStatus.textContent = 'Enter a room code first.'
        return
      }

      persistSettings()
      window.sessionStorage.setItem(ROOM_INTENT_KEY, JSON.stringify({ action: 'join', roomId }))
      window.location.href = 'multiplayer.html'
    })
  }

  const mergedSettings = {
    ...settings,
    mode,
  }

  if (difficultyInput) {
    difficultyInput.value = mergedSettings.difficulty
  }
  turnSecondsInput.value = mergedSettings.turnSeconds
  matchSecondsInput.value = mergedSettings.matchSeconds
  updateSummary(mergedSettings)

  difficultyInput?.addEventListener('change', persistSettings)
  turnSecondsInput.addEventListener('change', persistSettings)
  turnSecondsInput.addEventListener('input', persistSettings)
  matchSecondsInput.addEventListener('change', persistSettings)
  matchSecondsInput.addEventListener('input', persistSettings)
  startLink.addEventListener('click', persistSettings)

  function persistSettings() {
    const nextSettings = saveSettings({
      mode,
      difficulty: difficultyInput?.value || DEFAULT_SETTINGS.difficulty,
      turnSeconds: turnSecondsInput.value || DEFAULT_SETTINGS.turnSeconds,
      matchSeconds: matchSecondsInput.value || DEFAULT_SETTINGS.matchSeconds,
    })

    if (difficultyInput) {
      difficultyInput.value = nextSettings.difficulty
    }
    turnSecondsInput.value = nextSettings.turnSeconds
    matchSecondsInput.value = nextSettings.matchSeconds
    updateSummary(nextSettings)
  }

  function updateSummary(currentSettings) {
    const parts = [
      `${getModeLabel(mode)}`,
      `Turn ${currentSettings.turnSeconds}s`,
      `Match ${Math.floor(currentSettings.matchSeconds / 60)}m`,
    ]

    if (mode === 'singlePlayer') {
      parts.splice(1, 0, `AI ${currentSettings.difficulty}`)
    }

    summary.textContent = parts.join(' | ')
  }
}

export function loadRoomIntent() {
  try {
    const raw = window.sessionStorage.getItem(ROOM_INTENT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

export function clearRoomIntent() {
  window.sessionStorage.removeItem(ROOM_INTENT_KEY)
}

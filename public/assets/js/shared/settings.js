const STORAGE_KEY = 'battleships-settings'

export const DEFAULT_SETTINGS = {
  difficulty: 'medium',
  turnSeconds: 60,
  matchSeconds: 600,
  mode: 'singlePlayer',
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed = JSON.parse(raw)
    return normalizeSettings(parsed)
  } catch (error) {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  const normalized = normalizeSettings(settings)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function normalizeSettings(settings = {}) {
  const difficulty = ['easy', 'medium', 'hard'].includes(settings.difficulty)
    ? settings.difficulty
    : DEFAULT_SETTINGS.difficulty

  const turnSeconds = clamp(
    Number.parseInt(settings.turnSeconds, 10) || DEFAULT_SETTINGS.turnSeconds,
    10,
    180
  )

  const matchSeconds = clamp(
    Number.parseInt(settings.matchSeconds, 10) || DEFAULT_SETTINGS.matchSeconds,
    60,
    3600
  )

  const mode = ['singlePlayer', 'multiPlayer'].includes(settings.mode)
    ? settings.mode
    : DEFAULT_SETTINGS.mode

  return { difficulty, turnSeconds, matchSeconds, mode }
}

export function formatSettingsSummary(settings, gameMode) {
  const parts = [`Turn: ${settings.turnSeconds}s`, `Match: ${Math.floor(settings.matchSeconds / 60)}m`]

  if (gameMode === 'singlePlayer') {
    parts.unshift(`AI: ${capitalize(settings.difficulty)}`)
  }

  return parts.join(' | ')
}

export function getModeLabel(mode) {
  return mode === 'multiPlayer' ? 'Multiplayer' : 'Single Player'
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

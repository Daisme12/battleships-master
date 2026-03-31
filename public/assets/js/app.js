import { createAiController } from './ai/controller.js'
import { clearRoomIntent, loadRoomIntent } from './menu/menu.js'
import { createShipSetup } from './setup/shipSetup.js'
import { formatSettingsSummary, loadSettings } from './shared/settings.js'
import { BOARD_WIDTH, SHIP_DEFINITIONS, SHIP_LENGTHS } from './shared/ships.js'

document.addEventListener('DOMContentLoaded', () => {
  const gameMode = document.body.dataset.mode
  const isSinglePlayer = gameMode === 'singlePlayer'
  const settings = loadSettings()

  const userGrid = document.querySelector('.grid-user')
  const opponentGrid = document.querySelector('.grid-computer')
  const displayGrid = document.querySelector('.grid-display')
  const startButton = document.querySelector('#start')
  const randomizeButton = document.querySelector('#randomize')
  const rotateButton = document.querySelector('#rotate')
  const turnDisplay = document.querySelector('#whose-go')
  const infoDisplay = document.querySelector('#info')
  const timerDisplay = document.querySelector('#turn-timer')
  const matchTimerDisplay = document.querySelector('#match-timer')
  const settingsDisplay = document.querySelector('#settings')
  const setupButtons = document.querySelector('#setup-buttons')
  const userFleet = document.querySelector('#user-fleet')
  const enemyFleet = document.querySelector('#enemy-fleet')
  const roomStatus = document.querySelector('#room-status')
  const roomCodeDisplay = document.querySelector('#room-code-display')
  const gameOverModal = document.querySelector('#game-over-modal')
  const gameOverMessage = document.querySelector('#game-over-message')
  const playAgainButton = document.querySelector('#play-again')

  const width = BOARD_WIDTH
  const shipDefinitions = SHIP_DEFINITIONS
  const shipLengths = SHIP_LENGTHS

  const userSquares = []
  const opponentSquares = []
  const damage = {
    user: createDamageState(shipDefinitions),
    enemy: createDamageState(shipDefinitions),
  }
  const sunkMessages = {
    user: new Set(),
    enemy: new Set(),
  }

  let isHorizontal = true
  let isGameOver = false
  let allShipsPlaced = false
  let gameStarted = false
  let currentPlayer = 'user'
  let ready = false
  let enemyReady = isSinglePlayer
  let playerNum = 0
  let roomId = ''
  let lastShotId = null
  let isShotPending = false
  let turnTimeLeft = settings.turnSeconds
  let turnTimerId = null
  let turnToken = 0
  let timerOwner = null
  let matchTimeLeft = settings.matchSeconds
  let matchTimerId = null
  let aiTurnTimeoutId = null
  let infoMessageToken = 0

  const ai = isSinglePlayer
    ? createAiController({ difficulty: settings.difficulty, width })
    : null
  const socket = !isSinglePlayer && window.io ? window.io() : null
  let setupState = {
    allShipsPlaced: false,
    shipPlacements: {},
    selectedShipName: null,
    isHorizontal: true,
  }

  settingsDisplay.textContent = formatSettingsSummary(settings, gameMode)

  createBoard(userGrid, userSquares)
  createBoard(opponentGrid, opponentSquares)
  renderFleetTrackers(userFleet, 'user', shipDefinitions)
  renderFleetTrackers(enemyFleet, 'enemy', shipDefinitions)
  updateFleetTrackers()
  updateStartButtonState()
  renderTimer()
  renderMatchTimer()

  if (isSinglePlayer) {
    shipDefinitions.forEach(generateEnemyShip)
  }

  const shipSetup = createShipSetup({
    boardSquares: userSquares,
    displayGrid,
    shipDefinitions,
    width,
    infoDisplay,
    onChange: nextState => {
      setupState = nextState
      allShipsPlaced = nextState.allShipsPlaced
      updateStartButtonState()
      updateFleetTrackers()
    },
  })

  shipSetup.bind({
    rotateButton,
    randomizeButton,
  })

  if (!isSinglePlayer && !socket) {
    randomizeButton.disabled = true
    rotateButton.disabled = true
    startButton.disabled = true
    showStatusMessage('Multiplayer requires the Node server. Open /multiplayer.html from the app server port.')
    if (roomStatus) {
      roomStatus.textContent = 'Socket server not found. Run `node server.js` and open the game from that server.'
    }
    return
  }

  bindSetupControls()
  bindBoardInteractions()
  bindNavigationControls()

  if (!isSinglePlayer) {
    setupMultiplayer()
  }

  function bindSetupControls() {
    startButton.addEventListener('click', handleStart)
  }

  function bindNavigationControls() {
    if (playAgainButton) {
      playAgainButton.addEventListener('click', () => {
        window.location.reload()
      })
    }
  }

  function bindBoardInteractions() {
    opponentSquares.forEach(square => {
      square.addEventListener('click', () => {
        if (isGameOver || !gameStarted || currentPlayer !== 'user') return

        if (isSinglePlayer) {
          handlePlayerAttack(square.dataset.id)
          return
        }

        if (!ready || !enemyReady || isShotPending) return
        if (square.classList.contains('boom') || square.classList.contains('miss')) return

        isShotPending = true
        lastShotId = Number.parseInt(square.dataset.id, 10)
        socket.emit('fire', lastShotId)
      })
    })
  }

  function handleStart() {
    if (!allShipsPlaced) {
      showStatusMessage('Please place all ships before starting.')
      return
    }

    if (isSinglePlayer) {
      setupButtons.style.display = 'none'
      gameStarted = true
      showStatusMessage('Battle started.')
      startMatchTimer()
      refreshTurnState()
      return
    }

    if (!ready) {
      if (!roomId) {
        showStatusMessage('Create or join a room first.')
        return
      }
      ready = true
      playerReady(playerNum)
      socket.emit('player-ready')
      showStatusMessage(enemyReady ? 'Battle started.' : 'Waiting for the other player...')
    }

    if (ready && enemyReady) {
      setupButtons.style.display = 'none'
      gameStarted = true
      startMatchTimer()
      refreshTurnState()
    }
  }

  function setupMultiplayer() {
    startButton.disabled = true
    const roomIntent = loadRoomIntent()

    socket.on('room-created', payload => {
      handleRoomJoined(payload)
    })

    socket.on('room-joined', payload => {
      handleRoomJoined(payload)
    })

    socket.on('room-error', message => {
      setRoomStatus(message)
      showStatusMessage(message)
      clearRoomIntent()
    })

    socket.on('room-state', payload => {
      roomId = payload.roomId
      updateRoomStatus()

      enemyReady = false
      payload.players.forEach((player, index) => {
        setConnectionState(index, player.connected)
        playerReady(index, player.ready)
        if (index !== playerNum && player.ready) enemyReady = true
      })

      if (!payload.players[playerNum]?.connected) {
        ready = false
      }

      if (!payload.players.some((player, index) => index !== playerNum && player.connected)) {
        enemyReady = false
      }

      if (ready && enemyReady && payload.players.every(player => player.connected)) {
        gameStarted = true
        setupButtons.style.display = 'none'
        startMatchTimer()
        refreshTurnState()
      } else if (!payload.players.every(player => player.connected)) {
        gameStarted = false
        setupButtons.style.display = 'flex'
      }
    })

    socket.on('enemy-ready', num => {
      enemyReady = true
      playerReady(num, true)
      if (ready) {
        gameStarted = true
        setupButtons.style.display = 'none'
        showStatusMessage('Battle started.')
        startMatchTimer()
        refreshTurnState()
      }
    })

    socket.on('fire', id => {
      const result = applyShotToBoard(userSquares, 'user', id)
      socket.emit('fire-reply', result)

      if (!result.alreadyTried) {
        currentPlayer = result.hit ? 'enemy' : 'user'
        if (!isGameOver && !result.sunk) {
          showStatusMessage(result.hit
            ? 'Enemy hit your ship and keeps the turn.'
            : 'Enemy missed. Your turn.')
        }
      }

      refreshTurnState()
    })

    socket.on('fire-reply', result => {
      isShotPending = false

      if (result.alreadyTried) {
        showStatusMessage('Shot ignored because that square was already used.')
        refreshTurnState()
        return
      }

      paintOpponentShot(result)
      currentPlayer = result.hit ? 'user' : 'enemy'

      if (!isGameOver && !result.sunk) {
        showStatusMessage(result.hit
          ? 'Direct hit. Fire again.'
          : 'Missed shot. Enemy turn.')
      }

      refreshTurnState(result.hit)
    })

    socket.on('turn-timeout', () => {
      if (isGameOver || !gameStarted) return
      currentPlayer = 'user'
      showStatusMessage('Enemy ran out of time. Your turn.')
      refreshTurnState()
    })

    socket.on('timeout', () => {
      showStatusMessage('You have reached the 10 minute limit.')
      gameOver()
    })

    if (roomIntent?.action === 'create') {
      socket.emit('create-room')
      clearRoomIntent()
    } else if (roomIntent?.action === 'join' && roomIntent.roomId) {
      socket.emit('join-room', roomIntent.roomId)
      clearRoomIntent()
    } else {
      setRoomStatus('Go back to Multiplayer Settings to create or join a room.')
    }

    function handleRoomJoined(payload) {
      roomId = payload.roomId
      playerNum = Number.parseInt(payload.playerIndex, 10)
      currentPlayer = playerNum === 1 ? 'enemy' : 'user'
      startButton.disabled = !allShipsPlaced
      updateRoomStatus()
      showStatusMessage(`Joined room ${roomId} as Player ${playerNum + 1}.`)
    }
  }

  function setConnectionState(num, isConnected) {
    const playerSelector = `.p${Number.parseInt(num, 10) + 1}`
    const playerElement = document.querySelector(playerSelector)
    if (!playerElement) return
    playerElement.querySelector('.connected').classList.toggle('active', isConnected)
    if (Number.parseInt(num, 10) === playerNum) {
      playerElement.style.fontWeight = 'bold'
    }
  }

  function updateRoomStatus() {
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = `Room Code: ${roomId || '-'}`
    }

    if (!roomStatus) return
    roomStatus.textContent = roomId
      ? `Room ${roomId}. Share this code with the other player.`
      : 'Create a room or join an existing one before starting.'
  }

  function setRoomStatus(message) {
    if (!roomStatus) return
    roomStatus.textContent = message
  }

  function playerReady(num, isActive = true) {
    const playerSelector = `.p${Number.parseInt(num, 10) + 1} .ready`
    const readyIndicator = document.querySelector(playerSelector)
    if (!readyIndicator) return
    readyIndicator.classList.toggle('active', isActive)
  }

  function handlePlayerAttack(squareId) {
    const targetId = Number.parseInt(squareId, 10)
    const result = applyShotToBoard(opponentSquares, 'enemy', targetId)

    if (result.alreadyTried) return

    currentPlayer = result.hit ? 'user' : 'enemy'
    if (!result.sunk) {
      showStatusMessage(result.hit ? 'Direct hit. Fire again.' : 'Missed shot. Enemy turn.')
    }
    refreshTurnState(result.hit)

    if (!isGameOver && currentPlayer === 'enemy') {
      scheduleAiTurn()
    }
  }

  function scheduleAiTurn() {
    window.clearTimeout(aiTurnTimeoutId)
    aiTurnTimeoutId = window.setTimeout(() => {
      if (isGameOver || !gameStarted || currentPlayer !== 'enemy') return

      const shotId = ai.nextShot(userSquares)
      const result = applyShotToBoard(userSquares, 'user', shotId)
      ai.handleShotResult(result)

      if (result.alreadyTried) {
        scheduleAiTurn()
        return
      }

      currentPlayer = result.hit ? 'enemy' : 'user'
      if (!result.sunk) {
        showStatusMessage(result.hit ? 'Computer hit your ship and keeps firing.' : 'Computer missed. Your turn.')
      }
      refreshTurnState(result.hit)

      if (!isGameOver && currentPlayer === 'enemy') {
        scheduleAiTurn()
      }
    }, 700)
  }

  function applyShotToBoard(boardSquares, targetSide, squareId) {
    const square = boardSquares[squareId]
    if (!square) {
      return { id: squareId, hit: false, shipName: null, sunk: false, alreadyTried: true }
    }

    if (square.classList.contains('boom') || square.classList.contains('miss')) {
      return { id: squareId, hit: false, shipName: null, sunk: false, alreadyTried: true }
    }

    const shipName = getShipName(square)
    const hit = square.classList.contains('taken')

    square.classList.add(hit ? 'boom' : 'miss')

    let sunk = false
    if (hit && shipName) {
      damage[targetSide][shipName] += 1
      sunk = damage[targetSide][shipName] === shipLengths[shipName]
      updateFleetTrackers()
      announceShipState(targetSide, shipName, sunk)
    }

    checkForWins()

    return { id: squareId, hit, shipName, sunk, alreadyTried: false }
  }

  function paintOpponentShot(result) {
    const square = opponentSquares[result.id]
    if (!square || result.alreadyTried) return

    square.classList.add(result.hit ? 'boom' : 'miss')

    if (result.hit && result.shipName) {
      damage.enemy[result.shipName] += 1
      updateFleetTrackers()
      announceShipState('enemy', result.shipName, result.sunk)
      checkForWins()
    }
  }

  function announceShipState(targetSide, shipName, sunk) {
    if (!sunk) return
    if (sunkMessages[targetSide].has(shipName)) return

    sunkMessages[targetSide].add(shipName)
    showInfoMessage(
      targetSide === 'enemy'
        ? `You sunk the enemy ${shipName}.`
        : `The enemy sunk your ${shipName}.`,
      3000
    )
  }

  function checkForWins() {
    const enemyTotalDamage = Object.values(damage.enemy).reduce((total, value) => total + value, 0)
    const userTotalDamage = Object.values(damage.user).reduce((total, value) => total + value, 0)

    if (enemyTotalDamage === 17) {
      showStatusMessage('YOU WIN')
      gameOver()
      return
    }

    if (userTotalDamage === 17) {
      showStatusMessage(isSinglePlayer ? 'COMPUTER WINS' : 'ENEMY WINS')
      gameOver()
    }
  }

  function refreshTurnState(resetTurnTimer = false) {
    if (isGameOver || !gameStarted) {
      stopTurnTimer()
      timerOwner = null
      renderTimer()
      return
    }

    if (!isSinglePlayer && (!ready || !enemyReady)) {
      stopTurnTimer()
      timerOwner = null
      turnDisplay.textContent = 'Waiting for players'
      return
    }

    turnDisplay.textContent = currentPlayer === 'user'
      ? 'Your Go'
      : (isSinglePlayer ? 'Computer Go' : "Enemy's Go")

    if (resetTurnTimer || !turnTimerId || timerOwner !== currentPlayer) {
      startTurnTimer()
    } else {
      renderTimer()
    }
  }

  function startTurnTimer() {
    stopTurnTimer()
    turnTimeLeft = settings.turnSeconds
    timerOwner = currentPlayer
    renderTimer()

    const token = ++turnToken
    turnTimerId = window.setInterval(() => {
      if (token !== turnToken || isGameOver || !gameStarted) {
        stopTurnTimer()
        return
      }

      turnTimeLeft -= 1
      renderTimer()

      if (turnTimeLeft <= 0) {
        handleTurnTimeout(token)
      }
    }, 1000)
  }

  function stopTurnTimer() {
    window.clearInterval(turnTimerId)
    turnTimerId = null
  }

  function renderTimer() {
    timerDisplay.textContent = `Timer: ${Math.max(turnTimeLeft, 0)}s`
  }

  function showStatusMessage(message) {
    if (!settingsDisplay) return
    settingsDisplay.textContent = message
  }

  function showInfoMessage(message, autoClearMs = 0) {
    const token = ++infoMessageToken
    infoDisplay.classList.remove('active')
    infoDisplay.textContent = message
    void infoDisplay.offsetWidth
    infoDisplay.classList.add('active')

    if (!autoClearMs) return

    window.setTimeout(() => {
      if (token !== infoMessageToken || isGameOver) return
      infoDisplay.classList.remove('active')
      infoDisplay.textContent = ''
    }, autoClearMs)
  }

  function startMatchTimer() {
    if (matchTimerId) return

    renderMatchTimer()
    matchTimerId = window.setInterval(() => {
      if (isGameOver || !gameStarted) {
        stopMatchTimer()
        return
      }

      matchTimeLeft -= 1
      renderMatchTimer()

      if (matchTimeLeft <= 0) {
        showStatusMessage('Match time is over.')
        gameOver()
      }
    }, 1000)
  }

  function stopMatchTimer() {
    window.clearInterval(matchTimerId)
    matchTimerId = null
  }

  function renderMatchTimer() {
    if (!matchTimerDisplay) return
    const safeTime = Math.max(matchTimeLeft, 0)
    const minutes = Math.floor(safeTime / 60)
    const seconds = safeTime % 60
    matchTimerDisplay.textContent = `Match: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  function handleTurnTimeout(token) {
    if (token !== turnToken || isGameOver || !gameStarted) return

    stopTurnTimer()
    turnToken += 1

    if (currentPlayer === 'user') {
      showStatusMessage('Time out. You lost the turn.')

      if (isSinglePlayer) {
        currentPlayer = 'enemy'
        refreshTurnState()
        scheduleAiTurn()
      } else {
        currentPlayer = 'enemy'
        socket.emit('turn-timeout')
        refreshTurnState()
      }

      return
    }

    if (isSinglePlayer) {
      currentPlayer = 'user'
      refreshTurnState()
    }
  }

  function gameOver() {
    isGameOver = true
    gameStarted = false
    stopTurnTimer()
    stopMatchTimer()
    window.clearTimeout(aiTurnTimeoutId)
    startButton.disabled = true
    randomizeButton.disabled = true
    rotateButton.disabled = true
    showGameOverModal(settingsDisplay?.textContent || 'Battle finished.')
  }

  function showGameOverModal(message) {
    if (!gameOverModal || !gameOverMessage) return
    gameOverMessage.textContent = message
    gameOverModal.classList.add('active')
    gameOverModal.setAttribute('aria-hidden', 'false')
  }

  function updateStartButtonState() {
    startButton.disabled = !allShipsPlaced || (!isSinglePlayer && !roomId)
  }

  function generateEnemyShip(ship) {
    const randomDirection = Math.floor(Math.random() * ship.directions.length)
    const current = ship.directions[randomDirection]
    const direction = randomDirection === 0 ? 1 : width
    const randomStart = Math.abs(Math.floor(Math.random() * opponentSquares.length - (ship.length * direction)))

    const isTaken = current.some(index => opponentSquares[randomStart + index]?.classList.contains('taken'))
    const isAtRightEdge = current.some(index => (randomStart + index) % width === width - 1)
    const isAtLeftEdge = current.some(index => (randomStart + index) % width === 0)

    if (!isTaken && !isAtRightEdge && !isAtLeftEdge) {
      current.forEach(index => opponentSquares[randomStart + index].classList.add('taken', ship.name))
      return
    }

    generateEnemyShip(ship)
  }

  function createBoard(grid, squares) {
    for (let index = 0; index < width * width; index += 1) {
      const square = document.createElement('div')
      square.dataset.id = index
      grid.appendChild(square)
      squares.push(square)
    }
  }

  function renderFleetTrackers(container, side, shipsList) {
    container.innerHTML = shipsList.map(ship => `
      <div class="fleet-row">
        <span class="fleet-name">${ship.name}</span>
        <div class="fleet-segments" data-side="${side}" data-ship="${ship.name}">
          ${Array.from({ length: ship.length }, (_, index) => `<span class="fleet-segment" data-segment="${index}"></span>`).join('')}
        </div>
      </div>
    `).join('')
  }

  function updateFleetTrackers() {
    updateTrackerSide('user', userFleet)
    updateTrackerSide('enemy', enemyFleet)
  }

  function updateTrackerSide(side, container) {
    shipDefinitions.forEach(ship => {
      const segmentElements = container.querySelectorAll(`[data-side="${side}"][data-ship="${ship.name}"] .fleet-segment`)
      const placedCount = side === 'user'
        ? (setupState.shipPlacements[ship.name]?.positions.length || 0)
        : 0
      const damageCount = damage[side][ship.name]
      const isSunk = damageCount === ship.length

      segmentElements.forEach((element, index) => {
        element.classList.toggle('placed', index < placedCount)
        element.classList.toggle('hit', index < damageCount)
        element.classList.toggle('sunk', isSunk)
      })
    })
  }

  function createDamageState(shipsList) {
    return shipsList.reduce((state, ship) => {
      state[ship.name] = 0
      return state
    }, {})
  }

  function getShipName(square) {
    return shipDefinitions.find(ship => square.classList.contains(ship.name))?.name || null
  }
})

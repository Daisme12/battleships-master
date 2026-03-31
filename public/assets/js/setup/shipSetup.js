import { getShipNameFromElement } from '../shared/ships.js'

export function createShipSetup({
  boardSquares,
  displayGrid,
  shipDefinitions,
  width,
  infoDisplay,
  onChange,
}) {
  const shipLengths = Object.fromEntries(shipDefinitions.map(ship => [ship.name, ship.length]))
  const shipPlacements = {}
  let isHorizontal = true
  let selectedShip = null

  return {
    bind({
      rotateButton,
      randomizeButton,
    }) {
      rotateButton.addEventListener('click', rotateShips)
      randomizeButton.addEventListener('click', randomizeShips)

      displayGrid.addEventListener('mousedown', onShipPointerSelect)
      displayGrid.addEventListener('dragstart', onDragStart)

      boardSquares.forEach(square => {
        square.addEventListener('dragover', preventDefault)
        square.addEventListener('dragenter', preventDefault)
        square.addEventListener('drop', onBoardDrop)
        square.addEventListener('click', onBoardClick)
      })

      notifyChange()
    },

    hasAllShipsPlaced() {
      return Object.keys(shipPlacements).length === shipDefinitions.length
    },

    isShipPlaced(shipName) {
      return Boolean(shipPlacements[shipName])
    },

    clear() {
      clearBoardPlacements()
      clearShipPlacements()
      restoreShipDock()
      selectedShip = null
      notifyChange()
    },

    randomize() {
      randomizeShips()
    },
  }

  function rotateShips() {
    shipDefinitions.forEach(ship => {
      const shipElement = displayGrid.querySelector(`.${ship.name}-container`)
      if (shipElement) {
        shipElement.classList.toggle(`${ship.name}-container-vertical`)
      }
    })
    isHorizontal = !isHorizontal
    notifyChange()
  }

  function onShipPointerSelect(event) {
    const shipElement = event.target.closest('.ship')
    if (!shipElement || !displayGrid.contains(shipElement)) return

    const targetPart = event.target.id ? event.target.id : shipElement.firstElementChild.id
    selectedShip = buildSelectedShip(shipElement, targetPart)
    infoDisplay.textContent = `Selected ${selectedShip.name}. Click a square or drag to place it.`
    notifyChange()
  }

  function onDragStart(event) {
    const shipElement = event.target.closest('.ship')
    if (!shipElement || !displayGrid.contains(shipElement)) return

    selectedShip = buildSelectedShip(shipElement, event.target.id || shipElement.firstElementChild.id)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', selectedShip.name)
    }
    notifyChange()
  }

  function onBoardDrop(event) {
    event.preventDefault()
    if (!selectedShip) return
    placeSelectedShipAt(Number.parseInt(event.currentTarget.dataset.id, 10))
  }

  function onBoardClick(event) {
    if (!selectedShip) return
    placeSelectedShipAt(Number.parseInt(event.currentTarget.dataset.id, 10))
  }

  function preventDefault(event) {
    event.preventDefault()
  }

  function placeSelectedShipAt(baseId) {
    if (!selectedShip) return

    const positions = getPlacementPositions(baseId, selectedShip.length, isHorizontal, selectedShip.anchorIndex)
    if (!isPlacementValid(positions, isHorizontal)) {
      infoDisplay.textContent = 'Invalid position for that ship.'
      return
    }

    applyPlacement(positions, selectedShip.name, isHorizontal)
    if (displayGrid.contains(selectedShip.element)) {
      displayGrid.removeChild(selectedShip.element)
    }
    shipPlacements[selectedShip.name] = {
      positions: [...positions],
      horizontal: isHorizontal,
      length: selectedShip.length,
    }
    selectedShip = null

    if (Object.keys(shipPlacements).length === shipDefinitions.length) {
      infoDisplay.textContent = 'All ships placed. You can start now.'
    } else {
      infoDisplay.textContent = 'Ship placed.'
    }

    notifyChange()
  }

  function randomizeShips() {
    clearBoardPlacements()
    clearShipPlacements()
    selectedShip = null

    restoreShipDock()

    shipDefinitions.forEach(ship => {
      let placed = false
      while (!placed) {
        const horizontal = Math.random() < 0.5
        const startId = Math.floor(Math.random() * boardSquares.length)
        const positions = getPlacementPositions(startId, ship.length, horizontal, 0)

        if (!isPlacementValid(positions, horizontal)) continue

        applyPlacement(positions, ship.name, horizontal)
        const shipElement = displayGrid.querySelector(`.${ship.name}-container`)
        if (shipElement) {
          displayGrid.removeChild(shipElement)
        }
        shipPlacements[ship.name] = {
          positions: [...positions],
          horizontal,
          length: ship.length,
        }
        placed = true
      }
    })

    infoDisplay.textContent = 'Ships placed randomly.'
    notifyChange()
  }

  function buildSelectedShip(shipElement, partId) {
    const name = getShipNameFromElement(shipDefinitions, shipElement)
    const anchorIndex = Number.parseInt((partId || shipElement.firstElementChild.id).split('-').pop(), 10) || 0

    return {
      element: shipElement,
      name,
      length: shipLengths[name],
      anchorIndex,
    }
  }

  function getPlacementPositions(baseId, shipLength, horizontal, anchorIndex) {
    const startId = horizontal
      ? baseId - anchorIndex
      : baseId - (anchorIndex * width)

    return Array.from({ length: shipLength }, (_, index) => (
      horizontal ? startId + index : startId + (index * width)
    ))
  }

  function isPlacementValid(positions, horizontal) {
    if (!positions.length) return false
    if (positions.some(position => position < 0 || position >= boardSquares.length)) return false

    if (horizontal) {
      const row = Math.floor(positions[0] / width)
      if (positions.some(position => Math.floor(position / width) !== row)) return false
    }

    return !positions.some(position => boardSquares[position].classList.contains('taken'))
  }

  function applyPlacement(positions, shipName, horizontal) {
    positions.forEach((position, index) => {
      const directionClass = index === 0 ? 'start' : (index === positions.length - 1 ? 'end' : null)
      const classes = [
        'taken',
        horizontal ? 'horizontal' : 'vertical',
        shipName,
      ]

      if (directionClass) {
        classes.push(directionClass)
      }

      boardSquares[position].classList.add(...classes)
    })
  }

  function clearBoardPlacements() {
    boardSquares.forEach(square => {
      square.className = ''
    })
  }

  function restoreShipDock() {
    shipDefinitions.forEach(ship => {
      const selector = `.${ship.name}-container`
      if (displayGrid.querySelector(selector)) return
      if (shipPlacements[ship.name]) return

      const shipElement = document.createElement('div')
      shipElement.className = `ship ${ship.name}-container`
      shipElement.draggable = true

      for (let index = 0; index < ship.length; index += 1) {
        const cell = document.createElement('div')
        cell.id = `${ship.name}-${index}`
        shipElement.appendChild(cell)
      }

      if (!isHorizontal) {
        shipElement.classList.add(`${ship.name}-container-vertical`)
      }

      displayGrid.appendChild(shipElement)
    })
  }

  function clearShipPlacements() {
    Object.keys(shipPlacements).forEach(shipName => {
      delete shipPlacements[shipName]
    })
  }

  function notifyChange() {
    onChange({
      allShipsPlaced: Object.keys(shipPlacements).length === shipDefinitions.length,
      shipPlacements: cloneShipPlacements(shipPlacements),
      selectedShipName: selectedShip?.name || null,
      isHorizontal,
    })
  }

  function cloneShipPlacements(placements) {
    return Object.fromEntries(
      Object.entries(placements).map(([shipName, placement]) => [
        shipName,
        {
          positions: [...placement.positions],
          horizontal: placement.horizontal,
          length: placement.length,
        },
      ])
    )
  }
}

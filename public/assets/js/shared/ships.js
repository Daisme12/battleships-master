export const BOARD_WIDTH = 10

export const SHIP_DEFINITIONS = [
  { name: 'destroyer', length: 2, directions: [[0, 1], [0, BOARD_WIDTH]] },
  { name: 'submarine', length: 3, directions: [[0, 1, 2], [0, BOARD_WIDTH, BOARD_WIDTH * 2]] },
  { name: 'cruiser', length: 3, directions: [[0, 1, 2], [0, BOARD_WIDTH, BOARD_WIDTH * 2]] },
  { name: 'battleship', length: 4, directions: [[0, 1, 2, 3], [0, BOARD_WIDTH, BOARD_WIDTH * 2, BOARD_WIDTH * 3]] },
  { name: 'carrier', length: 5, directions: [[0, 1, 2, 3, 4], [0, BOARD_WIDTH, BOARD_WIDTH * 2, BOARD_WIDTH * 3, BOARD_WIDTH * 4]] },
]

export const SHIP_LENGTHS = Object.fromEntries(SHIP_DEFINITIONS.map(ship => [ship.name, ship.length]))

export function getShipNameFromElement(shipDefinitions, shipElement) {
  return shipDefinitions.find(ship => shipElement.classList.contains(`${ship.name}-container`) || shipElement.classList.contains(ship.name))?.name
    || shipElement.firstElementChild.id.split('-')[0]
}

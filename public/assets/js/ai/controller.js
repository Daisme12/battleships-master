export function createAiController({ difficulty, width }) {
  const triedShots = new Set()
  const hitsByShip = new Map()

  return {
    nextShot(boardSquares) {
      if (difficulty === 'easy') {
        return pickRandomShot(boardSquares, triedShots)
      }

      const targetedShot = difficulty === 'hard'
        ? pickHardShot(boardSquares, triedShots, hitsByShip, width)
        : pickMediumShot(boardSquares, triedShots, hitsByShip, width)

      if (targetedShot !== null) return targetedShot
      return pickRandomShot(boardSquares, triedShots)
    },

    handleShotResult(result) {
      triedShots.add(result.id)

      if (!result.hit || !result.shipName) return

      const existingHits = hitsByShip.get(result.shipName) || []
      if (!existingHits.includes(result.id)) {
        existingHits.push(result.id)
      }

      if (result.sunk) {
        hitsByShip.delete(result.shipName)
        return
      }

      hitsByShip.set(result.shipName, existingHits)
    },
  }
}

function pickMediumShot(boardSquares, triedShots, hitsByShip, width) {
  for (const hits of hitsByShip.values()) {
    const candidate = firstAvailable(getAdjacentCandidates(hits, width), boardSquares, triedShots)
    if (candidate !== null) return candidate
  }

  return null
}

function pickHardShot(boardSquares, triedShots, hitsByShip, width) {
  for (const hits of hitsByShip.values()) {
    const lineCandidates = getDirectionalCandidates(hits, width)
    const lineShot = firstAvailable(lineCandidates, boardSquares, triedShots)
    if (lineShot !== null) return lineShot

    const adjacentShot = firstAvailable(getAdjacentCandidates(hits, width), boardSquares, triedShots)
    if (adjacentShot !== null) return adjacentShot
  }

  return null
}

function getDirectionalCandidates(hits, width) {
  if (hits.length < 2) return []

  const sortedHits = [...hits].sort((a, b) => a - b)
  const sameRow = sortedHits.every(hit => Math.floor(hit / width) === Math.floor(sortedHits[0] / width))
  const step = sameRow ? 1 : width

  return [sortedHits[0] - step, sortedHits[sortedHits.length - 1] + step]
}

function getAdjacentCandidates(hits, width) {
  const candidates = []

  hits.forEach(hit => {
    const row = Math.floor(hit / width)
    const col = hit % width
    const nextCandidates = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
    ]

    nextCandidates.forEach(candidate => {
      if (candidate.row >= 0 && candidate.row < width && candidate.col >= 0 && candidate.col < width) {
        candidates.push(candidate.row * width + candidate.col)
      }
    })
  })

  return candidates
}

function firstAvailable(candidates, boardSquares, triedShots) {
  for (const candidate of candidates) {
    if (candidate < 0 || candidate >= boardSquares.length) continue
    if (triedShots.has(candidate)) continue
    if (boardSquares[candidate].classList.contains('boom') || boardSquares[candidate].classList.contains('miss')) continue
    return candidate
  }

  return null
}

function pickRandomShot(boardSquares, triedShots) {
  const available = boardSquares
    .map((_, index) => index)
    .filter(index => !triedShots.has(index))
    .filter(index => {
      const square = boardSquares[index]
      return !square.classList.contains('boom') && !square.classList.contains('miss')
    })

  if (!available.length) return 0

  const randomIndex = Math.floor(Math.random() * available.length)
  return available[randomIndex]
}

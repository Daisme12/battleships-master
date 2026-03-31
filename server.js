const express = require('express')
const path = require('path')
const http = require('http')
const PORT = process.env.PORT || 5500
const socketio = require('socket.io')
const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(express.static(path.join(__dirname, 'public')))

server.listen(PORT, () => console.log(`Server running on port ${PORT}`))

const rooms = new Map()

io.on('connection', socket => {
  socket.roomId = null
  socket.playerIndex = null

  socket.on('create-room', () => {
    const roomId = generateRoomId()
    rooms.set(roomId, {
      players: [socket.id, null],
      ready: [false, false],
    })

    socket.join(roomId)
    socket.roomId = roomId
    socket.playerIndex = 0

    socket.emit('room-created', { roomId, playerIndex: 0 })
    emitRoomState(roomId)
  })

  socket.on('join-room', inputRoomId => {
    const roomId = String(inputRoomId || '').trim().toUpperCase()
    const room = rooms.get(roomId)

    if (!room) {
      socket.emit('room-error', 'Room not found.')
      return
    }

    if (room.players[1]) {
      socket.emit('room-error', 'Room is full.')
      return
    }

    room.players[1] = socket.id
    room.ready[1] = false

    socket.join(roomId)
    socket.roomId = roomId
    socket.playerIndex = 1

    socket.emit('room-joined', { roomId, playerIndex: 1 })
    emitRoomState(roomId)
  })

  socket.on('player-ready', () => {
    const room = getSocketRoom(socket)
    if (!room) return

    room.ready[socket.playerIndex] = true
    socket.to(socket.roomId).emit('enemy-ready', socket.playerIndex)
    emitRoomState(socket.roomId)
  })

  socket.on('fire', id => {
    if (!socket.roomId) return
    socket.to(socket.roomId).emit('fire', id)
  })

  socket.on('fire-reply', result => {
    if (!socket.roomId) return
    socket.to(socket.roomId).emit('fire-reply', result)
  })

  socket.on('turn-timeout', () => {
    if (!socket.roomId) return
    socket.to(socket.roomId).emit('turn-timeout')
  })

  socket.on('disconnect', () => {
    const roomId = socket.roomId
    const playerIndex = socket.playerIndex
    if (!roomId || playerIndex === null) return

    const room = rooms.get(roomId)
    if (!room) return

    room.players[playerIndex] = null
    room.ready[playerIndex] = false

    if (!room.players[0] && !room.players[1]) {
      rooms.delete(roomId)
      return
    }

    emitRoomState(roomId)
  })

  setTimeout(() => {
    socket.emit('timeout')
    socket.disconnect()
  }, 600000)
})

function getSocketRoom(socket) {
  if (!socket.roomId) return null
  return rooms.get(socket.roomId) || null
}

function emitRoomState(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  io.to(roomId).emit('room-state', {
    roomId,
    players: room.players.map((playerId, index) => ({
      connected: Boolean(playerId),
      ready: room.ready[index],
    })),
  })
}

function generateRoomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let roomId = ''

  do {
    roomId = Array.from({ length: 5 }, () => (
      alphabet[Math.floor(Math.random() * alphabet.length)]
    )).join('')
  } while (rooms.has(roomId))

  return roomId
}

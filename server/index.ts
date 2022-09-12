import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { parse } from 'url'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {})

app.use(cors())
app.use(express.static('public'))

type Player = {
  id: string
}

type PositionEvent = {
  id: string
  x: number
  y: number
  size: number
}

const players: Record<string, Player> = {}

io.on('connection', (socket) => {
  const reqUrl = socket.request.url
  if (!reqUrl) {
    return
  }
  const parsed = parse(reqUrl, true)
  const id = parsed.query.id as string

  players[socket.id] = {
    id,
  }

  socket.on('position', (data: PositionEvent) => {
    socket.broadcast.emit('position', data)
  })

  socket.on('orb.removed', (id: string) =>
    socket.broadcast.emit('orb.removed', id)
  )

  socket.on('disconnect', (reason) => {
    console.log('Disconnected', reason)
  })
})

httpServer.listen(3000, () => console.log('Running'))

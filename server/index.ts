import { Server } from 'socket.io'
import { parse } from 'url'

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

const io = new Server({
  cors: {
    origin: '*',
    allowedHeaders: '*',
    credentials: true,
  },
})

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

  socket.on('destroyed', (id: string) => {
    socket.broadcast.emit('destroyed', id)
  })

  socket.on('disconnect', (reason) => {
    console.log('Disconnected', reason)
  })
})

io.listen(9090)

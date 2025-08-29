const tsConfig = require('../tsconfig.json')
import { register } from 'tsconfig-paths'

register({
  baseUrl: '.',
  paths: tsConfig.compilerOptions.paths
})
require('dotenv').config()
import express from 'express'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { Server } from 'socket.io'
import routes from '@/routes'
import { ChatSocket } from '@/service/socket'
import { socketMiddleware } from './middleware'

const PORT = process.env.PORT || 3000

const app = express()

app.use(bodyParser.json())
app.use(cookieParser())
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true
  })
)

app.use(bodyParser.urlencoded({ extended: true }))

app.use('/api', routes)

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

const io = new Server(server, {
  cors: {
    origin: `http://localhost:3000`,
    credentials: true
  }
})

io.use(socketMiddleware)

io.on('connection', (socket) => {
  const chatSocket = new ChatSocket(socket)
})

import { register } from 'tsconfig-paths'
const tsConfig = require('../tsconfig.json')
const baseUrl = '.'

register({
  baseUrl,
  paths: tsConfig.compilerOptions.paths
})

require('dotenv').config()
import express from 'express'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import routes from '@/routes'

const app = express()
const PORT = process.env.PORT || 3000

app.use(bodyParser.json())
app.use(cookieParser())
// set cors to all
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true
  })
)

app.use(bodyParser.urlencoded({ extended: true }))

app.use('/api', routes)

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

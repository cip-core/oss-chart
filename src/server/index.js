const express = require('express')
const bodyParser = require('body-parser')

const componentRoute = require('./component')
const stackRoute = require('./stack')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

const defaultComponent = 'k8s'

async function init() {
  try {
    await initDatabase()
  } catch (e) {
    console.error(e)
  }
  app.use(cors)
  app.use(preprocessRequest)
  app.use(logRequest)
  app.get('/', function(req, res) {
    res.redirect(`/components/${defaultComponent}`)
  })
  app.use(express.static(__dirname + '/../public'))
  app.use('/components', componentRoute)
  app.use('/stacks', stackRoute)

  return app
}

async function initDatabase() {
  const config = require('./config')
  const database = require('./database')

  const clientConfig = {
    user: config.POSTGRESQL_USER,
    host: config.POSTGRESQL_HOST,
    database: config.POSTGRESQL_DATABASE,
    password: config.POSTGRESQL_PASSWORD,
    port: parseInt(config.POSTGRESQL_PORT),
  }
  await database.init(clientConfig)
  if (config.RESET_DATABASE === 'true') {
    await database.dropTables()
  }
  await database.createTables()
}

async function homeUrl(req, res, next) {
  res.statusCode = 200
  await res.json({Status: 'Up'})
}

async function cors(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
}

function preprocessRequest(req, res, next) {
  const entries = Object.entries(req.body)
  if (entries.length > 0 && entries[0][1] === '') {
    req.body = JSON.parse(entries[0][0])
  }
  next()
}

function logRequest(req, res, next) {
    //logRequestParams(req)

    next()
}

function logRequestParams(req) {
    const obj = {
        headers: req.headers,
        url: req.url,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body,
    }
    console.log(obj)
}

init().then(app => {
    const port = 3000
    app.listen(port, () => {
        console.log(`[INFO] Listening on port ${port}`)
    })
}).catch(e => {
    console.error(`[FATAL] Error starting server`)
    console.error(e)
})

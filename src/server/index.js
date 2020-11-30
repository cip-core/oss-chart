const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const route = require('./route')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

const defaultComponent = 'k8s'

async function init() {
  app.use(cors)
  app.use(preprocessRequest)
  app.use(logRequest)
  app.get('/', function(req, res) {
    res.redirect(`/component/${defaultComponent}`)
  })
  app.use(express.static(__dirname + '/../public'))
  app.use('/component', route)

  return app
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
    logRequestParams(req)
    //logResponseBody(req, res)

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

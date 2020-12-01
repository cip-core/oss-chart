const path = require('path')
const fs = require('fs')
const { Client } = require('pg')

let client

async function init(clientConfig) {
  client = new Client(clientConfig)
  await client.connect()

  const filePath = 'init.sql'
  const sql = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' })
  try {
    const result = await client.query(sql)
    console.log(result)
  } catch (e) {
    console.error(e)
  }
}

module.exports = {
  init,
}
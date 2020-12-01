const path = require('path')
const fs = require('fs')
const { Client } = require('pg')

let client

async function init(clientConfig) {
  client = new Client(clientConfig)
  await client.connect()
}

async function createTables() {
  const filePath = 'init.sql'
  const sql = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' })
  return await client.query(sql);
}

async function selectFrom(table, columns, where) {
  const sql = `SELECT ${columns.join(', ')} \n` +
    `FROM ${table} \n` +
    `WHERE ${where.join(' AND \n')};`
  console.log(sql)
  return await client.query(sql)
}

async function insertInto(table, columns = [], rows = []) {
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) \n` +
    'VALUES \n' +
    `${rows.map(row => `(${row.join(', ')})`).join(',\n')} \n` +
    'RETURNING *;'
  console.log(sql)
  return await client.query(sql)
}

module.exports = {
  init,
  createTables,
  selectFrom,
  insertInto,
}
const path = require('path')
const fs = require('fs')
const { Client } = require('pg')

let client

async function init(clientConfig) {
  try {
    client = new Client(clientConfig)
    await client.connect()
  } catch (e) {
    client = undefined
    throw e
  }
}

async function createTables() {
  const filePath = 'init.sql'
  const sql = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' })
  if (client) return await client.query(sql);
}

async function dropTables() {
  const filePath = 'reset.sql'
  const sql = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' })
  if (client) return await client.query(sql);
}

async function selectFrom(table, columns, where) {
  const sql = `SELECT ${columns.join(', ')} \n` +
    `FROM ${table} \n` +
    `WHERE ${where.join(' AND \n')};`
  if (client) return await client.query(sql)
}

async function insertInto(table, columns = [], rows = []) {
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) \n` +
    'VALUES \n' +
    `${rows.map(row => `(${row.join(', ')})`).join(',\n')} ;`
  if (client) return await client.query(sql)
}

async function upsert(table, columns = [], rows = [], log = false) {
  const idColumn = columns[0]
  const valueColumn = columns[columns.length - 1]
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) \n` +
    'VALUES \n' +
    `${rows.map(row => `(${row.map(v =>`'${v.toString().replace(/'/g, '\\')}'`).join(', ')})`).join(',\n')} \n` +
    `ON CONFLICT (${idColumn}) \n` +
    'DO UPDATE SET \n' +
    `${valueColumn} = excluded.${valueColumn} ;`
  if (log) console.log(`= = = = =\n${sql}`)
  if (client) return await client.query(sql)
}

async function update(table, values = {}, conditions = []) {
  const sql = `UPDATE ${table} \n` +
    `SET ${Object.entries(values).map(entry => `${entry[0]} = ${entry[1]}`).join(',\n')} \n` +
    `WHERE ${conditions.join(' AND ')} ;`
  if (client) return await client.query(sql)
}

async function deleteFrom(table, conditions = [], log = false) {
  const sql = `DELETE FROM ${table} \n` +
    `WHERE ${conditions.join(' AND ')} ;`
  if (log) console.log(`= = = = =\n${sql}`)
  if (client) return await client.query(sql)
}

module.exports = {
  init,
  createTables,
  dropTables,
  selectFrom,
  insertInto,
  upsert,
  update,
  deleteFrom,
}
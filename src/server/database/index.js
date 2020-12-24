const path = require('path')
const fs = require('fs')
const { Client } = require('pg')

let client
let shouldLog

async function init(clientConfig) {
  try {
    client = new Client(clientConfig)
    await client.connect()
  } catch (e) {
    client = undefined
    throw e
  }
}

function setLogging(logging) {
  shouldLog = logging
}

function logQuery(sqlBegin, values, sqlEnd) {
  let subValues = []
  const displayedItems = 4
  if (values.length > displayedItems) {
    subValues.push(values[0], values[1])
    subValues.push(`... ${values.length - displayedItems} item(s) ...`)
    subValues.push(values[values.length - 2], values[values.length - 1])
  } else {
    subValues = values
  }
  const sqlValues = subValues.length > 0 ? `${subValues.join(',\n')} \n` : ''
  const sql = sqlBegin + sqlValues + sqlEnd
  console.log(`[${new Date().toISOString()}]\n${sql}`)
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
  const sql1 = `INSERT INTO ${table} (${columns.join(', ')}) \n` +
    'VALUES \n'
  const values = rows.map(row => `(${row.map(v =>`'${v.toString().replace(/'/g, '\\')}'`).join(', ')})`)
  const sql3 = `ON CONFLICT (${idColumn}) \n` +
    'DO UPDATE SET \n' +
    `${valueColumn} = excluded.${valueColumn} ;`

  if (shouldLog || log) logQuery(sql1, values, sql3)

  const sql2 = `${values.join(',\n')} \n`
  const sql = sql1 + sql2 + sql3

  if (client) return await client.query(sql)
}

async function update(table, values = {}, conditions = []) {
  const sql = `UPDATE ${table} \n` +
    `SET ${Object.entries(values).map(entry => `${entry[0]} = ${entry[1]}`).join(',\n')} \n` +
    `WHERE ${conditions.join(' AND ')} ;`
  if (client) return await client.query(sql)
}

async function deleteFrom(table, conditions = [], log = false) {
  const sql1 = `DELETE FROM ${table} \n`
  const sql2 = `WHERE ${conditions.join(' AND ')} ;`

  if (shouldLog || log) logQuery(sql1, [], sql2)
  if (client) return await client.query(sql1 + sql2)
}

module.exports = {
  init,
  setLogging,
  createTables,
  dropTables,
  selectFrom,
  insertInto,
  upsert,
  update,
  deleteFrom,
}
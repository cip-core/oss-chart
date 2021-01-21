const { Client } = require('pg')

const config = require('../config')

const clientConfig = {
  user: config.POSTGRESQL_USER,
  host: config.POSTGRESQL_HOST,
  database: config.POSTGRESQL_DATABASE,
  password: config.POSTGRESQL_PASSWORD,
  port: parseInt(config.POSTGRESQL_PORT),
}

const client = new Client(clientConfig)

async function test() {
  try {
    await client.connect()
    console.log(await selectFrom('components_cache', [
      'id',
      'component',
      'metrics',
      'company',
      'period',
      'value',
    ]))
    console.log(await selectFrom('companies', [
      'name',
    ]))
    console.log(await selectFrom('components', [
      'short',
      'name',
      'href',
    ]))
    console.log(await selectFrom('company_stacks', [
      'id',
      'parent',
      'name',
      'child',
    ]))
    console.log(await selectFrom('component_stacks', [
      'id',
      'parent',
      'name',
      'child',
    ]))
  } catch (e) {
    console.error(e)
  } finally {
    await client.end()
  }
}

async function selectFrom(table, columns, where) {
  const sql = `SELECT ${columns.join(', ')} \n` +
    `FROM ${table} \n` +
    (where ? `WHERE ${where.join(' AND \n')}` : '') +
    ';'
  if (client) return await client.query({
    text: sql,
    //rowMode: 'array',
  })
}

test()
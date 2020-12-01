const fs = require('fs')

const configFile = '../../config.json'

let config = {}
const variables = [
]
// Optional variables and their default values
const optionalVariables = {
  'POSTGRESQL_HOST': undefined,
  'POSTGRESQL_PORT': undefined,
  'POSTGRESQL_DATABASE': undefined,
  'POSTGRESQL_USER': undefined,
  'POSTGRESQL_PASSWORD': undefined,
}

if (fs.existsSync(__dirname + '/' + configFile)) {
  console.log(`[INFO] Loading "${configFile}" file...`)
  config = require('./' + configFile)
} else {
  console.log(`[INFO] "${configFile}" file not found, checking for environment variables...`)
  for (const variable of variables.concat(Object.keys(optionalVariables))) {
    const value = process.env[variable]
    if (value !== undefined) {
      config[variable] = value
    }
  }
}

for (const [optionalVariable, defaultValue] of Object.entries(optionalVariables)) {
  const definedValue = config[optionalVariable]
  if (definedValue === undefined) {
    console.log(`[INFO] Optional configuration variable ${optionalVariable} not defined, using default value "${defaultValue}"`)
    config[optionalVariable] = defaultValue
  }
}

let allVariables = true
for (const variable of variables) {
  const value = config[variable]
  if (value === undefined) {
    console.error(`[FATAL] Configuration variable ${variable} is missing.`)
    allVariables = false
  }
}

if (!allVariables) {
  console.error(`[FATAL] Cannot run the server due to missing configuration variable(s).`)
  process.exit()
}

module.exports = config
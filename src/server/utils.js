const axios = require('axios');
const HTMLParser = require('node-html-parser');

const database = require('./database');

let componentsCache;

const hostname = 'devstats.cncf.io';
const baseUrl = `https://${hostname}/`;

setInterval(updateComponents, 5 * 60 * 1000);

function queryToBody(query) {
  return {
    from: "1446545259582",
    to: new Date().getTime().toString(),
    queries: [
      {
        refId: "A",
        intervalMs: 86400000,
        maxDataPoints: 814,
        datasourceId: 1,
        rawSql: query,
        format: "table"
      }
    ]
  }
}

async function loadCompanies(component) {
  // retrieve companies list
  const response = await loadData(component, 'hcomcontributions', [ 'y10' ])
  return response.data.rows.map(company => company.name)
}

const localCache = {}

function shouldUpdateCache(cachedData, companies) {
  // no cache
  if (!cachedData) {
    return true
  }

  // missing company info in cache
  if (companies) {
    for (const company of companies) {
      if (cachedData.missing.indexOf(company) !== -1) {
        return true
      }
    }
  }

  return false
}

async function loadData(component, metrics, periods, companies) {
  const response = {}

  const cachedData = loadFromCache(component, metrics, periods)
  if (shouldUpdateCache(cachedData, companies)) {
    response.data = await loadFromDevstats(component, metrics, periods)
    const rowsToAdd = saveToLocalCache(component, metrics, response.data)
    if (rowsToAdd.length > 0) {
      await saveToDatabase(rowsToAdd)
    }
  } else {
    response.data = cachedData
  }
  //response.data.sort() // Sort alphabetically

  if (companies) {
    response.data.rows = response.data.rows.filter(company => companies.indexOf(company.name) !== -1)
  }
  return response
}

function loadFromCache(component, metrics, periods) {
  const componentCache = localCache[component]
  if (componentCache) {
    const metricsCache = componentCache[metrics]
    if (metricsCache) {
      const missingCompanies = []
      const rows = []
      for (const entry of Object.entries(metricsCache)) {
        let missing = false
        const row = {}
        const company = entry[0]
        const values = entry[1]
        row.name = company
        for (const p of periods) {
          const value = values[p]
          if (value !== undefined) {
            row[p] = value
          } else {
            missingCompanies.push(company)
            missing = true
            break
          }
        }
        if (missing) continue

        rows.push(row)
      }

      const data = {}

      data.columns = [ 'name' ].concat(periods)
      data.rows = rows
      data.missing = missingCompanies

      return data
    }
  }
}

async function loadFromDevstats(component, metrics, periods) {
  let query = `select name, value, period from \"shcom\" where series = '${metrics}' and period `
  if (periods.length > 1) {
    query += `in (${periods.map(p => `'${p}'`).join(', ')})`
  } else {
    query += `= '${periods[0]}'`
  }
  const response = await fetchData(component, query)
  return processData(response.data)
}

function saveToLocalCache(component, metrics, data) {
  let componentCache = localCache[component]
  if (!componentCache) {
    componentCache = {}
    localCache[component] = componentCache
  }
  let metricsCache = componentCache[metrics]
  if (!metricsCache) {
    metricsCache = {}
    componentCache[metrics] = metricsCache
  }

  const mainColumn = data.columns[0]
  const columns = data.columns.slice(1)
  const rowsToAdd = []
  for (const row of data.rows) {
    const company = row[mainColumn]
    let companyCache = metricsCache[company]
    if (!companyCache) {
      companyCache = {}
      metricsCache[company] = companyCache
    }

    const rowToAdd = [component, metrics, company]
    for (const period of columns) {
      const value = row[period] || 0
      rowsToAdd.push(rowToAdd.concat([period, value]))
      companyCache[period] = value
    }
  }

  return rowsToAdd
}

async function saveToDatabase(data) {
  return await database.replaceInto(
    'components_cache',
    [
      'component',
      'metrics',
      'company',
      'period',
      'value',
    ],
    data,
  )
}

async function fetchData(component, query) {
  const body = queryToBody(query)

  const url = `https://${component}.${hostname}/api/tsdb/query`
  console.log(`${url} : ${query}`)
  return await axios.post(url, body)
}

function processData(data) {
  const table = data.results['A'].tables[0]
  table.columns = table.columns.map(obj => obj.text)

  const mainColumn = table.columns[0]
  const dictValues = {}
  const keys = [mainColumn]
  table.rows.map(function(row) {
    const x = row[0]
    let obj = dictValues[x]
    if (!obj) {
      obj = {}
      obj[mainColumn] = x
      dictValues[x] = obj
    }

    const value = row[1]
    const name = row[2]
    if (name && value) {
      keys.indexOf(name) === -1 && keys.push(name)
      obj[name] = value
    }
  })

  const out = {}
  out.rows = Object.values(dictValues)
  out.columns = keys

  return out
}

async function loadComponents() {
  if (componentsCache === undefined) {
    await updateComponents();
  }
  return componentsCache;
}

async function updateComponents() {
  const promises = [];
  const components = {};

  const response = await axios.get(baseUrl);
  const document = HTMLParser.parse(response.data);
  const elements = document.querySelectorAll('table tr a');
  for (const element of elements) {
    const href = element.getAttribute('href');
    const firstChild = element.firstChild;
    if (firstChild.nodeType === 3) { // TextNode
      const searchBegin = '://';
      const beginIndex = href.indexOf(searchBegin) + searchBegin.length;
      const endIndex = href.indexOf('.' + hostname);
      components[href] = {
        name: firstChild.rawText,
        short: href.slice(beginIndex, endIndex),
      };
    } else if (firstChild.rawTagName === 'img') {
      promises.push(
        axios.get(`${baseUrl}/${firstChild.getAttribute('src')}`).then(function(response) {
          return {
            href: href,
            data: response.data,
          };
        })
      );
    }
  }

  const svgs = await Promise.all(promises);
  for (const svg of svgs) {
    const component = components[svg.href];
    if (component) component.svg = svg.data;
  }

  componentsCache = transformComponents(components);
  return componentsCache;
}

function transformComponents(components) {
  return Object.entries(components).map(function(entry) {
    const key = entry[0];
    const value = entry[1];
    value.href = key;
    return value;
  });
}

module.exports = {
  loadData,
  loadCompanies,
  loadComponents,
};
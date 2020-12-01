const axios = require('axios');
const HTMLParser = require('node-html-parser');

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
  const query = "select name from \"shcom\" where series = 'hcomcontributions' and period = 'y10'"
  return await fetchData(component, query)
}

async function loadData(component, metrics, periods, companies) {
  const query = `select name, value, period from \"shcom\" where series = '${metrics}' and period in (${periods.map(p => `'${p}'`).join(', ')})`
  const response = await fetchData(component, query)
  response.data = processData(response.data, companies)
  //response.data.sort() // Sort alphabetically

  return response
}

async function fetchData(component, query) {
  const body = queryToBody(query)

  const url = `https://${component}.${hostname}/api/tsdb/query`
  return await axios.post(url, body)
}

function processData(data, companies) {
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
    keys.indexOf(name) === -1 && keys.push(name)
    obj[name] = value
  })

  const out = {}
  const rows = []
  for (const key in dictValues) {
    if (companies.indexOf(key) !== -1) {
      rows.push(dictValues[key])
    }
  }
  out.rows = rows
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
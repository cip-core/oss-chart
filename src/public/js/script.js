const nValues = 7
const apiBaseUrl = window.location.origin.indexOf('file://') === 0 ? 'http://localhost:3000' : window.location.origin

const url = apiBaseUrl + '/api/tsdb/query'

const select = document.createElement('select')
select.setAttribute('id', 'select')
select.setAttribute('multiple', '')
select.setAttribute('size', '1')
const brands = ['Google', 'Microsoft', 'IBM']
for (const brand of brands) {
    const option = document.createElement('option')
    option.setAttribute('value', brand)
    option.innerHTML = brand
    select.append(option)
}
document.body.append(select)
let mySelect = new vanillaSelectBox("#select",{
    search: true,
    maxHeight: 400,
    disableSelectAll: false,
});
mySelect.enable()

main()

async function main() {
  createGraph('hcomcontributions')
  createGraph('hcomcontributors')
  createGraph('hcomprs')
  createGraph('hcomprcreators')
  createGraph('hcomprreviewers')
  createGraph('hcomcommits')
  createGraph('hcomcommitters')
}

async function createGraph(metric) {
  // Data to send via POST request to API
  const parameters = {
    from: "1446545259582",
    to: new Date().getTime().toString(),
    queries: [
      {
        refId: "A",
        intervalMs: 86400000,
        maxDataPoints: 814,
        datasourceId: 1,
        rawSql: createSQLQuery(metric, ['d', 'w', 'm', 'y']),
        format: "table"
      }
    ]
  }
  
  // Retrieve data from API - Contributions
  const data = await postData(url, parameters)
  // Build Chart
  const svg = buildChart(data)

  // Main div where elements are going to be stored
  const identifier = `#graph_${metric}`
  const div = d3.select(identifier)
      .append(() => svg.node())
  
}

function createSQLQuery(series, periods) {
  // original request
  // "select (row_number() over (order by value desc) -1) as \"Rank\", name, value from \"shcom\" where series = 'hcomprcreators' and period = 'm'",
  return `select name, value, period from \"shcom\" where series = '${series}' and period in (${periods.map(p => `'${p}'`).join(', ')})`
}

function preprocessData(data) {
  const table = data.results['A'].tables[0]
  table.columns = table.columns.map(obj => obj.text)

  const mainColumn = table.columns[0]
  const dictValues = {}
  const keys = [mainColumn]
  const rows = table.rows.map(function(row) {
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

  const out = Object.values(dictValues)
  out.columns = keys

  return out
}

function buildChart(data) {
  data = preprocessData(data)
  var columns = data.columns

  data = data.slice(1, nValues + 1) // Remove first element because of "All"

  // List of subgroups = header of the csv files = soil condition here
  var subgroups = columns.slice(1)
  
  let maxValue = 0
  for (const obj of data) {
    for (const key of Object.keys(obj)) {
      if (subgroups.indexOf(key) !== -1) {
        const value = obj[key]
        if (value > maxValue) maxValue = value
      }
    }
  }

  // List of groups = species here = value of the first column called group -> I show them on the X axis
  var groups = d3.map(data, function(d){return(d[columns[0]])}).keys()

  // set the dimensions and margins of the graph
  var margin = {top: 10, right: 30, bottom: 20, left: 50},
  width = data.length * 75 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  var svg = d3.create('svg')
  svg
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")"
    );

  // Add X axis
  var x = d3.scaleBand()
    .domain(groups)
    .range([0, width ])
    .padding([0.2])
  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).tickSize(0));

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([0, maxValue])
    .range([ height, 0 ]);
  svg.append("g")
    .call(d3.axisLeft(y));

  // Another scale for subgroup position?
  var xSubgroup = d3.scaleBand()
    .domain(subgroups)
    .range([0, x.bandwidth()])
    .padding([0.05])

  // color palette = one color per subgroup
  var color = d3.scaleOrdinal()
    .domain(subgroups)
    .range(['#e41a1c','#377eb8','#4daf4a', '#ffa500'])

  // Show the bars
  svg.append("g")
    .selectAll("g")
    // Enter in data = loop group per group
    .data(data)
    .enter()
    .append("g")
    .attr("transform", function(d) { return "translate(" + x(d[columns[0]]) + ",0)"; })
    .selectAll("rect")
    .data(function(d) { return subgroups.map(function(key) { return {key: key, value: d[key]}; }); })
    .enter().append("rect")
    .attr("x", function(d) { return xSubgroup(d.key); })
    .attr("y", function(d) { return y(d.value); })
    .attr("width", xSubgroup.bandwidth())
    .attr("height", function(d) { return height - y(d.value); })
    .attr("fill", function(d) { return color(d.key); });

  return svg
}

async function postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    /*
    mode: 'no-cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    */
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      //'Access-Control-Allow-Origin': '*',
      //'Connection': 'keep-alive',
      //'Host': 'k8s.devstats.cncf.io',
      //'Acept-Encoding': 'gzip, deflate, br',
      //'USer-Agent': 'PostmanRuntime/7.26.8',
    },
    /*
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'strict-origin-when-cross-origin', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    */
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}
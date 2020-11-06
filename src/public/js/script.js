const apiBaseUrl = window.location.origin.indexOf('file://') === 0 ? 'http://localhost:3000' : window.location.origin

const url = apiBaseUrl + '/api/tsdb/query'
const defaultCompanies = ['Google', 'Microsoft', 'IBM']

createMultipleSelectionList().then(function (dropdown) {
  // Set selected companies by default
  dropdown.setValue(defaultCompanies)

  const selectedCompanies = Array.from(dropdown.listElements).filter(element => element.className.indexOf('active') !== -1).map(element => element.getAttribute('data-value'))
  updateGraphs(selectedCompanies)
})

function updateGraphs(companies) {
  const divs = document.querySelectorAll('div.graph')
  for (const div of divs) {
    const id = div.getAttribute('id')
    updateGraph(div, id, companies)
  }
}

async function updateGraph(div, metrics, companies) {
  const periods = ['d', 'w', 'm', 'y']
  // SQL query to send
  const query = `select name, value, period from \"shcom\" where series = '${metrics}' and period in (${periods.map(p => `'${p}'`).join(', ')})`
  // Retrieve data from API
  const data = await postData(query)

  // Build Chart
  const svg = buildChart(data, companies)

  // Replace old chart
  d3.select(div).select('svg').remove()
  d3.select(div).append(() => svg.node())
}

async function createMultipleSelectionList() {
  // retrieve companies list
  const query = "select name from \"shcom\" where series = 'hcomcontributions' and period = 'y10'"

  const data = await postData(query)
  const companies = data.results['A'].tables[0].rows.slice(1).flat()
  //companies.sort() // Sort alphabetically

  const select = document.createElement('select')
  select.setAttribute('id', 'select')
  select.setAttribute('multiple', '')
  select.setAttribute('size', '1')

  for (const company of companies) {
    const option = document.createElement('option')
    option.setAttribute('value', company)
    option.innerHTML = company
    select.append(option)
  }

  const button = document.createElement('button')
  button.innerHTML = 'Update'

  const div = document.createElement('div')
  div.setAttribute('id', 'selection')

  div.append(select)
  div.append(button)

  document.body.prepend(div)

  const multipleSelection = new vanillaSelectBox("#select",{
      search: true,
      maxHeight: 400,
      disableSelectAll: true,
  });
  multipleSelection.enable()

  button.onclick = function (event) {
    const selectedCompanies = Array.from(multipleSelection.listElements).filter(element => element.className.indexOf('active') !== -1).map(element => element.getAttribute('data-value'))
    updateGraphs(selectedCompanies)
  }

  return multipleSelection
}

function preprocessData(data, companies) {
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

  let out = []
  for (const key in dictValues) {
    if (companies.indexOf(key) !== -1) {
      out.push(dictValues[key])
    }
  }
  out.columns = keys

  return out
}

function buildChart(data, companies) {
  data = preprocessData(data, companies)
  var columns = data.columns

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

async function postData(query) {
  // Data to send via POST request to API
  const data = {
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
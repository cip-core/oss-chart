const apiBaseUrl = window.location.href.split('?')[0]

let defaultCompanies;
const times = [
  {
    short: 'w',
    long: 'week',
  },
  {
    short: 'm',
    long: 'month',
  },
  {
    short: 'q',
    long: 'quarter',
  },
  {
    short: 'y',
    long: 'year',
  },
  {
    short: 'y10',
    long: 'decade',
  },
]

createMultipleSelectionList().then(function (dropdown) {
  // Set selected companies by default
  dropdown.setValue(defaultCompanies)

  const selectedCompanies = Array.from(dropdown.listElements).filter(element => element.className.indexOf('active') !== -1).map(element => element.getAttribute('data-value'))
  updateGraphs(selectedCompanies)
})

function updateGraphs(companies) {
  const divs = document.querySelectorAll('div.graph')
  for (const div of divs) {
    div.innerHTML = "" // Clear div
    const loading = createLoading()
    div.append(loading)
    const id = div.getAttribute('id')
    updateGraph(div, id, companies).then(function() {
      div.removeChild(loading)
    })
  }
}

async function updateGraph(div, metrics, companies) {
  const periods = times.map(t => t.short)
  // Retrieve data from API
  const data = await callApi('POST', `${apiBaseUrl}/${metrics}`, { periods, companies });

  // Remove old chart
  d3.select(div).select('svg').remove()

  if (data.rows.length > 0) {
    // Build Chart
    const svg = buildChart(div, data)
    // Put new chart
    d3.select(div).append(() => svg)
  }
}

async function createMultipleSelectionList() {
  const label = document.createElement('label')
  label.setAttribute('class', 'selectLabel')
  label.innerHTML = 'Companies :'

  const select = document.createElement('select')
  select.setAttribute('id', 'select')
  select.setAttribute('multiple', '')
  select.setAttribute('size', '1')

  const button = document.createElement('button')
  button.innerHTML = 'Update'

  const div = document.getElementById('selection')
  div.append(label)
  div.append(select)
  div.append(button)

  const selectionOptions = {
    search: true,
    maxHeight: 400,
    disableSelectAll: true,
    placeHolder: 'Loading...',
  }
  let multipleSelection = new vanillaSelectBox("#select", selectionOptions);

  const query = new URLSearchParams(window.location.search)
  const queryCompanies = query.get('companies');
  if (queryCompanies) {
    defaultCompanies = queryCompanies.split(',');
  } else {
    defaultCompanies = [];
  }

  const companies = await loadCompanies()
  for (const company of companies) {
    const option = document.createElement('option')
    option.setAttribute('value', company)
    option.innerHTML = company
    select.append(option)
  }

  multipleSelection.destroy()
  selectionOptions.placeHolder = 'Select item';
  multipleSelection = new vanillaSelectBox("#select", selectionOptions);

  button.onclick = function (event) {
    const selectedCompanies = Array.from(multipleSelection.listElements).filter(element => element.className.indexOf('active') !== -1).map(element => element.getAttribute('data-value'))
    const string = new URLSearchParams({
      companies: selectedCompanies.join(','),
    }).toString();
    window.history.pushState({}, '', apiBaseUrl + '?' + string);
    updateGraphs(selectedCompanies)
  }

  return multipleSelection
}

function sortByName(a, b) {
  const aName = a.toLowerCase();
  const bName = b.toLowerCase();

  if (aName === bName) return 0;

  const aLatin = isLatinLetter(aName[0]);
  const bLatin = isLatinLetter(bName[0]);

  if (aLatin && !bLatin) return -1;
  else if (!aLatin && bLatin) return 1;

  return aName < bName ? -1 : 1;
}

function isLatinLetter(letter) {
  return letter.toUpperCase() !== letter.toLowerCase()
}

async function loadCompanies() {
  const companies = await callApi('GET', `${window.location.origin}/companies`)
  companies.sort(sortByName) // Sort alphabetically

  return companies
}

function transformPercentage(data, subgroups) {
  const sums = {}
  for (const subgroup of subgroups) {
    for (const company of data) {
      const sum = sums[subgroup] || 0
      sums[subgroup] = sum + (company[subgroup] || 0) // count 0 if no value
    }
  }

  for (const subgroup of subgroups) {
    const subgroupTotal = sums[subgroup] || 1 // avoid divide by 0
    for (const company of data) {
      company[subgroup] = company[subgroup] || 0 // count 0 if no value
      const percentage = company[subgroup] / subgroupTotal * 100
      company[subgroup] = {
        value: company[subgroup],
        percentage: Math.round(percentage * 100) / 100,
      }
    }
  }

  return data
}

function getUpperLimit(data) {
  let maxPercentage = 0
  for (const company of data) {
    for (const object of Object.values(company)) {
      if (object.percentage && object.percentage > maxPercentage) {
        maxPercentage = object.percentage
      }
    }
  }
  return Math.ceil(maxPercentage / 10) * 10
}

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

function buildChart(parent, data) {
  var columns = data.columns
  data = data.rows

  // List of subgroups = header of the csv files = soil condition here
  var subgroups = columns.slice(1)
  // Sort columns according to "times" list
  const shortTimes = times.map(t => t.short)
  subgroups.sort(function(a, b) {
    return shortTimes.indexOf(a) < shortTimes.indexOf(b) ? 1 : -1
  })

  // Transform data to percentage
  data = transformPercentage(data, subgroups)
  data.sort(function(a, b) {
    for (const subgroup of subgroups) {
      const aValue = a[subgroup].percentage
      const bValue = b[subgroup].percentage
      if (aValue === bValue) continue
      return aValue < bValue ? 1 : -1
    }
    return 0
  })
  const maxPercentage = getUpperLimit(data)

  // List of groups = species here = value of the first column called group -> I show them on the X axis
  var groups = d3.map(data, function(d){return(d[columns[0]])}).keys()

  const yAxisLabelWidth = 10
  // set the dimensions and margins of the graph
  const margin = {top: 10, right: 0, bottom: 15, left: 30}
  margin.left += yAxisLabelWidth

  const svgWidth = Math.min(25 * subgroups.length * groups.length, parent.offsetWidth)
  const chartWidth = svgWidth - margin.left - margin.right
  let svgHeight = 270
  const chartHeight = svgHeight - margin.top - margin.bottom

  // append the svg object to the body of the page
  var svg = d3.create('svg')
  svg
    .attr("width", svgWidth)
    .attr("height", svgHeight)

  // Add X axis
  var x = d3.scaleBand()
    .domain(groups)
    .range([0, chartWidth ])
    .padding([1 / 5])

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([0, maxPercentage])
    .range([ chartHeight, 0 ]);

  // Another scale for subgroup position?
  var xSubgroup = d3.scaleBand()
    .domain(subgroups)
    .range([0, x.bandwidth()])
    .padding([0.05])

  // color palette = one color per subgroup
  var color = d3.scaleOrdinal()
    .domain(subgroups)
    .range(d3.schemeSet1)

  let lastMax = 0
  // Show the bars
  const chart = svg.append("g")
    .attr("class", "chart")
  chart.selectAll("g")
    // Enter in data = loop group per group
    .data(data)
    .enter()
    .append("g")
    .attr("transform", function(d) { return `translate(${x(d[columns[0]]) + margin.left}, ${margin.top})`; })
    .selectAll("rect")
    .data(function(d) {
      return subgroups.map(function(key) {
        const subgroupValue = d[key]
        return {
          key: key,
          value: subgroupValue.value,
          percentage: subgroupValue.percentage,
          updatedAt: d.updatedAt,
          isLast: d[columns[0]] === groups[groups.length - 1],
        };
      });
    })
    .enter().append("rect")
    .on("mouseover", function(d) {
      tooltip.transition()
        .duration(200)
        .style("opacity", .9);
      const time = times.filter(o => o.short === d.key)[0]
      tooltip.html(`Last ${time.long} : ${d.value} (${d.percentage}%)<br><i>Updated ${dateInterval(new Date(d.updatedAt), new Date())}</i>`)
        .style("left", (d3.event.pageX) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", function(d) {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    })
    .attr("x", function(d) { return xSubgroup(d.key); })
    .attr("y", function(d) { return y(d.percentage); })
    .attr("width", xSubgroup.bandwidth())
    .attr("height", function(d) {
      const height = chartHeight - y(d.percentage)
      if (d.isLast) lastMax = Math.max(lastMax, height)
      return height;
    })
    .attr("fill", function(d) { return color(d.key); });

  const size = xSubgroup.bandwidth()
  const spaceBetween = 5
  // Append legend
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${svgWidth + yAxisLabelWidth - 55 - spaceBetween - size}, 0)`)
    .selectAll("g")
    .data(subgroups)
    .enter()
  legend.append("rect")
    .attr("x", 0)
    .attr("y", function(d,i){ return 0 + i * (size + spaceBetween)}) // 0 is where the first dot appears. 5 is the distance between dots
    .attr("width", size)
    .attr("height", size)
    .style("fill", function(d){ return color(d)})
  legend.append("text")
    .attr("class", "legendText")
    .attr("x", size + spaceBetween)
    .attr("y", function(d,i){ return 0 + i * (size + spaceBetween) + (size / 2)}) // 0 is where the first dot appears. 5 is the distance between dots
    .style("fill", function(d){ return color(d)})
    .text(function(d){
      const time = times.filter(o => o.short === d)[0]
      return time.long[0].toUpperCase() + time.long.slice(1)
    })
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle")

  const legendHeight = (size + spaceBetween) * subgroups.length - spaceBetween
  const sum = lastMax + legendHeight + margin.bottom + spaceBetween
  if (sum > svgHeight) {
    svg.attr("height", sum)
    chart.attr('transform', `translate(0, ${sum - svgHeight})`)
    margin.top += sum - svgHeight
  }

  svg.append("g")
    .attr("transform", `translate(${margin.left}, ${chartHeight + margin.top})`)
    .call(d3.axisBottom(x).tickSize(0));
  svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", yAxisLabelWidth)
    .attr("x", 0 - (chartHeight / 2))
    .attr("font-size", 10)
    .style("text-anchor", "middle")
    .text("Percentage");

  return svg.node()
}

function dateInterval(dateFrom, dateTo) {
  const diff = new Date(Math.abs(dateTo - dateFrom));
  const years = diff.getUTCFullYear() - 1970;
  const months = diff.getUTCMonth();
  const days = diff.getUTCDate() - 1;
  const weeks = Math.floor(days / 7);

  const rules = [
    { interval: 'year', value: years },
    { interval: 'month', value: months % 12 },
    { interval: 'week', value: weeks % 4 },
    { interval: 'day', value: days % 7 },
    { interval: 'hour', value: diff.getUTCHours() },
    { interval: 'minute', value: diff.getUTCMinutes() },
  ];
  let firstEncountered = false;
  let outputString = '';
  for (const rule of rules) {
    if (!firstEncountered) {
      if (rule.value > 0) {
        outputString += `${rule.value} ${rule.interval}${rule.value > 1 ? 's' : ''}\n`;
        firstEncountered = true;
      }
    } else {
      if (rule.value > 0) {
        outputString += `${rule.value} ${rule.interval}${rule.value > 1 ? 's' : ''}\n`;
      }
      break;
    }
  }
  return (outputString || 'few seconds ') + 'ago';
}

async function callApi(method, url, data) {
  // Default options are marked with *
  const config = {
    method: method, // *GET, POST, PUT, DELETE, etc.
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
  };

  if (data) config.body = JSON.stringify(data);

  const response = await fetch(url, config);
  if (!response.ok) {
    throw new Error("HTTP status " + response.status);
  }

  return response.json(); // parses JSON response into native JavaScript objects
}

function createLoading() {
  const div = document.createElement('div')
  div.setAttribute('class', 'lds-ring')
  for (let i = 0; i < 4; i++) div.append(document.createElement('div'))
  return div
}
const apiBaseUrl = '%%API_BASE_URL%%'
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
];

function createLoading() {
  const div = document.createElement('div')
  div.setAttribute('class', 'lds-ring')
  for (let i = 0; i < 4; i++) div.append(document.createElement('div'))
  return div
}

function getExceptedKind(kind) {
  const kinds = {
    companies: 'components',
    components: 'companies',
    stack: 'companies',
  };

  return kinds[kind];
}

async function updateGraph(div, tooltip) {
  const item = div.getAttribute('data-name');
  const kind = div.getAttribute('data-kind');

  const expectedData = getExceptedKind(kind);
  const body = {}

  const periods = div.getAttribute('data-periods');
  if (periods) body.periods = periods.split(',');

  if (!expectedData) return;
  else if (expectedData === 'components') {
    const stack = div.getAttribute('data-stack');
    const components = div.getAttribute('data-components');
    if (components) body.components = components.split(',')
    else if (stack) body.stack = stack
  } else {
    const companies = div.getAttribute('data-companies');
    if (companies) body.companies = companies.split(',')
  }
  const metric = div.getAttribute('data-metric');

  // Retrieve data from API
  const response = await callApi('POST', `${apiBaseUrl}/${kind === 'stack' ? 'stacks' : kind}/${item}/${metric}`, body);

  // Remove old chart
  d3.select(div).select('svg').remove()

  if (response.data.rows.length > 0) {
    // Build Chart
    const svg = buildChart(div, response.data, times.filter(t => periods.indexOf(t.short) !== -1), tooltip)
    // Put new chart
    d3.select(div).append(() => svg)
  }
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

function buildChart(parent, data, periods, tooltip) {
  var columns = data.columns
  data = data.rows

  // List of subgroups = header of the csv files = soil condition here
  var subgroups = columns.slice(1)
  // Sort columns according to "times" list
  const shortTimes = periods.map(t => t.short)
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
          name: d.name,
          short: d.short,
          isLast: d[columns[0]] === groups[groups.length - 1],
        };
      });
    })
    .enter().append("rect")
    .on("mouseover", function(d) {
      d3.select(this).style("cursor", "pointer")
      tooltip.transition()
        .duration(200)
        .style("opacity", .9);
      const time = periods.filter(o => o.short === d.key)[0]
      tooltip.html(`Last ${time.long} : ${d.value} (${d.percentage}%)<br>`
        + `<i>Updated ${dateInterval(new Date(d.updatedAt), new Date())}</i><br>`
        + `Click for more details`
      )
        .style("left", (d3.event.pageX) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", function(d) {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    })
    .on("click", function(d) {
      const pathArray = window.location.pathname.split('/')
      const stack = pathArray.slice(0, pathArray.length - 1)
      const currentKind = parent.getAttribute('data-kind')
      const exceptedKind = getExceptedKind(currentKind)
      const query = {}
      query['dataName'] = d.short || d.name
      query[currentKind] = parent.getAttribute('data-name')
      const endUrl = `/${exceptedKind}?${new URLSearchParams(query).toString()}`
      window.location.href = window.location.origin + stack.join('/') + endUrl
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
      const time = periods.filter(o => o.short === d)[0]
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

function updateGraphs() {
  let tooltip = d3.select("#graphTooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "graphTooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }
  const divs = document.querySelectorAll('div.graph')
  for (const div of divs) {
    div.innerHTML = "" // Clear div
    const loading = createLoading()
    div.append(loading)
    updateGraph(div, tooltip).finally(function() {
      div.removeChild(loading)
    })
  }
}

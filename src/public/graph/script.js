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

function createErrorMessage(text) {
  const element = document.createElement('text')
  element.setAttribute('class', 'graphErrorMessage')
  element.innerHTML = text
  return element
}

function getExceptedKind(kind) {
  const kinds = {
    companies: 'components',
    components: 'companies',
    stack: 'companies',
  };

  return kinds[kind];
}

async function updateGraph(div, tooltip, loading) {
  const item = div.getAttribute('data-name');
  const kind = div.getAttribute('data-kind');

  const expectedData = getExceptedKind(kind);
  const body = {}

  const periods = div.getAttribute('data-periods');
  if (periods) body.periods = periods.split(',');

  if (!expectedData) throw new TypeError(`data-kind "${kind}" is not recognized`);
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
  const response = await longCall('POST', `${apiBaseUrl}/${kind === 'stack' ? 'stacks' : kind}/${item}/${metric}`, body, loading);

  // Remove old chart
  d3.select(div).select('svg').remove()

  if (response.data.rows.length > 0) {
    // Build Chart
    let periodsDict = {}
    const periodsArray = times.filter(t => periods.indexOf(t.short) !== -1)
    for (const p of periodsArray) {
      periodsDict[p.short] = p.long
    }
    buildChart(div, response.data, periodsDict, tooltip)
  }
}

function longCall(method, url, body, loading) {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async function() {
      const call = callApi(method, url, body)
      try {
        const response = await timeout(20000, call);
        if (response.updating) {
          let text = loading.querySelector('text')
          if (!text) {
            text = document.createElement('text')
            loading.append(text)
          }
          text.innerHTML = "Updating cache<br>" + `(~${Math.floor(response.wait / 1000)} sec.)`
        } else {
          clearInterval(intervalId)
          resolve(response)
        }
      } catch (e) {
        clearInterval(intervalId)
        reject(e)
      }
    }, refreshRate)
  })
}

function timeout(ms, promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request has timed out. The server is fetching data, please try again in a minute'))
    }, ms)

    promise
      .then(value => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(reason => {
        clearTimeout(timer)
        reject(reason)
      })
  })
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

const colorPalette = d3.schemeSet1;
colorPalette[5] = '#e8c500'; // change yellow to dark yellow
colorPalette.push('#303030'); // add dark grey

function invertData(data, subgroups) {
  let newSubgroups = data.map(d => d.name)
  const dict = {}
  for (const row of data) {
    for (const subgroup of subgroups) {
      let values = dict[subgroup]
      if (!values) {
        values = {}
        dict[subgroup] = values
      }
      const rowSubgroup = row[subgroup]
      rowSubgroup.short = row.short
      values[row.name] = rowSubgroup
    }
  }

  data = Object.entries(dict).map(function (entry) {
    return Object.assign({name: entry[0]}, entry[1])
  })
  subgroups = newSubgroups

  return {
    data,
    subgroups,
    columns: ["name"].concat(subgroups),
  }
}

function buildChart(parent, data, periods, tooltip) {
  let invertedData = parent.getAttribute('data-inverted') !== null

  let columns = data.columns
  data = data.rows

  // List of subgroups = header of the csv files = soil condition here
  let subgroups = columns.slice(1)
  // Sort columns according to "times" list
  const shortTimes = Object.keys(periods)
  subgroups.sort(function (a, b) {
    return shortTimes.indexOf(a) < shortTimes.indexOf(b) ? 1 : -1
  })

  // Transform data to percentage
  data = transformPercentage(data, subgroups)
  data.sort(function (a, b) {
    for (const subgroup of subgroups) {
      const aValue = a[subgroup].percentage
      const bValue = b[subgroup].percentage
      if (aValue === bValue) continue
      return aValue < bValue ? 1 : -1
    }
    return 0
  })

  const limitElements = parent.getAttribute('data-limit') || 10
  data = data.slice(0, limitElements)
  const maxPercentage = getUpperLimit(data)

  if (invertedData) {
    const output = invertData(data, subgroups)
    data = output.data
    subgroups = output.subgroups
    columns = output.columns
  }

  const firstColumn = columns[0]
  // List of groups = species here = value of the first column called group -> I show them on the X axis
  let groups = d3.map(data, function(d){return(d[firstColumn])}).keys()
  if (invertedData) {
    groups = groups.map(p => periods[p])
  }

  const legendDiv = document.createElement('div')
  legendDiv.classList.add('svgLegend')
  const chartDiv = document.createElement('div')
  chartDiv.classList.add('svgChart')
  const leftAxisDiv = document.createElement('div')
  leftAxisDiv.classList.add('svgAxis')

  const containerDiv = document.createElement('div')
  containerDiv.classList.add('svgContainer')

  containerDiv.append(leftAxisDiv)
  containerDiv.append(chartDiv)
  containerDiv.append(legendDiv)

  parent.append(containerDiv)

  // set the dimensions and margins of the graph
  const margin = {top: 10, right: 0, bottom: 15, left: 30, yAxisLabelWidth: 10}
  margin.left += margin.yAxisLabelWidth

  let svgWidth = Math.min(25 * subgroups.length * groups.length * (1 + 2 / subgroups.length), parent.offsetWidth)
  svgWidth = Math.max(svgWidth, 10 * subgroups.length * groups.length * (1 + 2 / subgroups.length))
  let svgHeight = 270

  let color = d3.scaleOrdinal()
    .domain(subgroups)
    .range(colorPalette)

  const chartHeight = svgHeight - margin.top - margin.bottom
  // Add Y axis
  let y = d3.scaleLinear()
      .domain([0, maxPercentage])
      .range([ chartHeight, 0 ]);

  const svg1 = drawLeftAxis(y, svgHeight, margin)
  const svg3 = drawLegend(subgroups, color, 15, invertedData ? undefined : periods)

  // Draw left axis
  d3.select(leftAxisDiv).append(() => svg1.node())
  const bbox = svg1.node().getBBox()
  const leftAxisPadding = 1.5
  svg1.attr('width', bbox.width + leftAxisPadding)
      .attr('height', bbox.height + 5)

  // Draw legend
  d3.select(legendDiv).append(() => svg3.node())
  const legendWidth = svg3.node().getBBox().width
  svg3.attr('width', legendWidth)

  const chartWidth = svgWidth - margin.left - margin.right - legendWidth - leftAxisPadding - 1
  // Add X axis
  let x = d3.scaleBand()
      .domain(groups)
      .range([0, chartWidth - margin.left ])
      .padding([1 / (subgroups.length + 1)])
  let xSubgroup = d3.scaleBand()
      .domain(subgroups)
      .range([0, x.bandwidth()])
      .padding([0.05])

  // Build chart SVG
  let svg2 = d3.create('svg')
  svg2
      .attr("width", chartWidth - margin.left)
      .attr("height", svgHeight)

  // Show the bars
  const chart = svg2.append("g")
    .attr("class", "chart")

  let chartRect = chart.selectAll("g")
  // Enter in data = loop group per group
    .data(data)
    .enter()
    .append("g");

  if (invertedData) {
    chartRect.attr("transform", function(d) { return `translate(${x(periods[d[firstColumn]])}, ${margin.top})`; })
  } else {
    chartRect.attr("transform", function(d) { return `translate(${x(d[firstColumn])}, ${margin.top})`; })
  }

  chartRect = chartRect.selectAll("rect")
    .data(function(d) {
      return subgroups.map(function(key) {
        const subgroupValue = d[key]
        const out = {
          key: key,
          value: subgroupValue.value,
          percentage: subgroupValue.percentage,
          updatedAt: d.updatedAt,
          name: d.name,
          short: d.short,
          isLast: d[firstColumn] === groups[groups.length - 1],
        }
        if (invertedData) out.short = subgroupValue.short || key
        return out;
      });
    })
    .enter().append("rect")
  chartRect.attr("fill", function(d) { return color(d.key); })
    .attr("x", function(d) { return xSubgroup(d.key); })
    .attr("y", function(d) { return y(d.percentage); })
    .attr("width", xSubgroup.bandwidth())
    .attr("height", function(d) {
      return chartHeight - y(d.percentage);
    })
    .on("mouseout", function(d) {
      fadeOutTooltip(tooltip)
    })

  if (invertedData) {
    chartRect.on("mouseover", function (d) {
      d3.select(this).style("cursor", "pointer")
      tooltip.transition()
          .duration(200)
          .style("opacity", .9);
      const text = `${d.key} : ${d.value} (${d.percentage}%)<br>`
          + `<i>Updated ${dateInterval(new Date(d.updatedAt), new Date())}</i><br>`
          + `Click for more details`
      tooltip.html(text)
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
    })
  } else {
    chartRect.on("mouseover", function (d) {
      d3.select(this).style("cursor", "pointer")
      tooltip.transition()
          .duration(200)
          .style("opacity", .9);
      const time = periods[d.key]
      const text = `Last ${time} : ${d.value} (${d.percentage}%)<br>`
          + `<i>Updated ${dateInterval(new Date(d.updatedAt), new Date())}</i><br>`
          + `Click for more details`
      tooltip.html(text)
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
    })
  }

  const currentKind = parent.getAttribute('data-kind')
  const expectedKind = getExceptedKind(currentKind)

  if (parent.getAttribute('data-clickable') !== null) {
    chartRect.on("click", function (d) {
      const query = {}
      query[currentKind] = currentKind === 'stack' ? parent.getAttribute('data-name') : 'all'
      query['dataName'] = d.short || d.name
      if (invertedData) query['dataInverted'] = invertedData

      openInNewPage(parent, expectedKind, query)
    })
  } else {
    chartRect.on("click", async function (d) {
      const query = {}
      query['data-kind'] = expectedKind
      query[`data-${currentKind}`] = currentKind === 'stack' ? parent.getAttribute('data-name') : 'all'
      query['data-name'] = d.short || d.name
      if (invertedData) query['data-inverted'] = ''

      fadeOutTooltip(tooltip)

      const page = await reloadSamePage(parent, expectedKind, query)
      updatePageTitle(page, query['data-kind'], query['data-name'])
      updateGraphs({ keepComment: false, handleRedirect: false })
    })
  }

  d3.select(chartDiv).append(() => svg2.node())

  const lines = {}
  lines.max = 0
  svg2.append("g")
    .attr("transform", `translate(${0}, ${chartHeight + margin.top})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll(".tick text")
    .call(wrap, x.bandwidth(), lines)

  svgHeight = svgHeight + lines.max * 11
  svg2.attr("height", svgHeight)
  containerDiv.style.height = `${svgHeight + 20}px`
  containerDiv.style.maxWidth = `${svgWidth - margin.left}px`
}

function drawLeftAxis(y, height, margin) {
  const svg = d3.create('svg')
  svg.attr('height', height)
  svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(d3.axisLeft(y));

  svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", margin.yAxisLabelWidth)
      .attr("x", 0 - ((height - margin.top - margin.bottom) / 2))
      .attr("font-size", 10)
      .style("text-anchor", "middle")
      .text("Percentage");

  return svg;
}

function drawLegend(subgroups, color, size, periods) {
  const spaceBetween = 5

  // Create SVG
  let svg = d3.create('svg')

  let legend = svg.append("g")
      .attr("class", "legend")
  //.attr("transform", `translate(${svgWidth + yAxisLabelWidth - 55 - spaceBetween - size}, 0)`)

  const legendWidth = 35 + spaceBetween + size
  const legendHeight = (size + spaceBetween) * subgroups.length - spaceBetween
  svg.attr("width", legendWidth)
  svg.attr("height", legendHeight)

  legend = legend.selectAll("g")
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
        if (!periods) return d
        const time = periods[d]
        return time[0].toUpperCase() + time.slice(1)
      })
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")

  return svg
}

function wrap(text, width, lines) {
  text.each(function() {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1, // ems
      y = text.attr("y"),
      dy = parseFloat(text.attr("dy")),
      tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        if (line.length > 0) {
          tspan.text(line.join(" "));
          line = [word];
        } else {
          tspan.text(word);
          line = [];
        }
        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(line.join(" "));
        if (lineNumber > lines.max) {
          lines.max = lineNumber
        }
      }
    }
  });
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

function insertDefaultComment(parent) {
  const element = document.createElement('text')
  element.setAttribute('class', 'graphComment default')
  element.innerHTML = "Because graph has been updated, the following comment may not be valid anymore:"

  parent.insertBefore(element, parent.firstChild)
  return element
}

function fadeOutTooltip(tooltip) {
  tooltip.transition()
      .duration(500)
      .style("opacity", 0);
}

function openInNewPage(parent, kind, query) {
  const pathArray = window.location.pathname.split('/')
  const stack = pathArray.slice(0, pathArray.length - 1)
  const endUrl = `/${kind}?${new URLSearchParams(query).toString()}`
  window.open(window.location.origin + stack.join('/') + endUrl, '_self')
}

async function reloadSamePage(parent, kind, query) {
  const queryString = new URLSearchParams(window.location.search)
  for (const key of Object.keys(query)) {
    queryString.set(key, query[key])
  }
  queryString.set('graphRedirected', 'true')
  window.history.pushState({}, '', window.location.href.split('?')[0] + '?' + queryString)

  const page = parent.parentElement

  const loading = createLoading()
  loading.style.margin = '0 auto'
  page.innerHTML = ''
  page.appendChild(loading)

  try {
    const response = await fetch(`${apiBaseUrl}/graph/template.html`)
    page.innerHTML = await response.text()
  } catch (e) {
    page.removeChild(loading)
  }

  window.scrollTo(0, 0)

  const attributes = parent.attributes
  const graphDiv = document.createElement('div')
  for (const attr of attributes) {
    const name = attr.name
    if (name === 'class' || name.indexOf('data-') === 0) {
      graphDiv.setAttribute(name, attr.value)
    }
  }
  for (const key of Object.keys(query)) {
    graphDiv.setAttribute(key, query[key])
  }

  page.appendChild(graphDiv)
  return page
}

const refreshRate = 2000

async function updatePageTitle(page, kind, dataName) {
  const title = page.querySelectorAll('h2')[0]
  if (kind === 'companies') {
    const intervalId = setInterval(async function() {
      const companies = await loadCompanies()
      if (!companies.updating) {
        clearInterval(intervalId)
        const company = companies.filter(name => name === dataName)[0]
        if (company) {
          title.innerHTML = `Analysis of contributions of ${company}`;
        }
      }
    }, refreshRate)
  } else if (kind === 'stack') {
    const stack = await loadStack(dataName)
    if (stack) {
      title.innerHTML = `Analysis of contributions to ${stack.name}`
    }
  } else if (kind === 'components') {
    const intervalId = setInterval(async function() {
      const components = await loadComponents()
      if (!components.updating) {
        clearInterval(intervalId)
        const component = components.filter(component => component.short === dataName)[0]
        if (component) {
          title.innerHTML = `Analysis of contributions to ${component.name}${component.svg}`
          document.getElementById('itemLink').href = component.href
        }
      }
    }, refreshRate)
  }
}

function sortByName(a, b) {
  const aName = (a.name || a).toLowerCase();
  const bName = (b.name || b).toLowerCase();

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

async function loadComponents() {
  const components = await callApi('GET', `${apiBaseUrl}/components`)
  if (components.updating) return components
  components.sort(sortByName) // Sort alphabetically

  return components
}

async function loadCompanies() {
  const companies = await callApi('GET', `${apiBaseUrl}/companies`)
  if (companies.updating) return companies
  companies.sort(sortByName) // Sort alphabetically

  return companies
}

async function loadStack(name) {
  return await callApi('GET', `${apiBaseUrl}/stacks/${name}/details`)
}

async function updateGraphPromise(div, tooltip, keepComment) {
  const svgContainer = div.querySelector('.svgContainer')
  if (svgContainer) svgContainer.remove()

  if (!keepComment) {
    const defaultComment = div.querySelector('.graphComment.default')
    if (!defaultComment) {
      const comments = div.querySelectorAll('.graphComment')
      for (const comment of comments) {
        const classes = comment.getAttribute('class').split(' ')
        if (classes.indexOf('edited') === -1) classes.push('edited')
        comment.setAttribute('class', classes.join(' '))
      }
      if (comments.length > 0) insertDefaultComment(div)
    }
  }

  const loading = createLoading()
  div.append(loading)
  try {
    await updateGraph(div, tooltip, loading)
  } catch(e) {
    div.append(createErrorMessage(e.message))
    console.error(e)
  } finally {
    div.removeChild(loading)
  }
}

async function updateGraphs({ keepComment = true, handleRedirect = true, batches = 10 }) {
  let tooltip = d3.select("#graphTooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "graphTooltip")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }

  if (handleRedirect) {
    const queryString = new URLSearchParams(window.location.search)
    if (queryString.get('graphRedirected') === 'true') {
      const graph = document.querySelector('div.graph')
      const query = {}
      for (const key of queryString.keys()) {
        if (key.indexOf('data-') === 0) {
          query[key] = queryString.get(key)
        }
      }
      const page = await reloadSamePage(graph, query['data-kind'], query)
      updatePageTitle(page, query['data-kind'], query['data-name'])
    }
    if (queryString.get('dataInverted') === 'true') {
      const graphs = document.querySelectorAll('div.graph')
      graphs.forEach(graph => graph.setAttribute('data-inverted', ''))
    }
  }

  const divs = document.querySelectorAll('div.graph')
  const promises = []
  for (const div of divs) {
    promises.push(updateGraphPromise(div, tooltip, keepComment))
    if (promises.length >= batches) {
      await Promise.allSettled(promises)
      while (promises.length > 0) promises.pop()
    }
  }

  if (promises.length > 0) await Promise.allSettled(promises)
}

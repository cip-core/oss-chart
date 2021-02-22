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

async function updateGraph(div, tooltip) {
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
  const call = callApi('POST', `${apiBaseUrl}/${kind === 'stack' ? 'stacks' : kind}/${item}/${metric}`, body);
  const response = await timeout(20000, call);

  // Remove old chart
  d3.select(div).select('svg').remove()

  if (response.data.rows.length > 0) {
    // Build Chart
    buildChart(div, response.data, times.filter(t => periods.indexOf(t.short) !== -1), tooltip)
  }
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

function buildChart(parent, data, periods, tooltip) {
  const firstDiv = document.createElement('div')
  firstDiv.classList.add('svgLegend')
  const secondDiv = document.createElement('div')
  secondDiv.classList.add('svgChart')
  const containerDiv = document.createElement('div')
  containerDiv.classList.add('svgContainer')
  containerDiv.append(firstDiv)
  containerDiv.append(secondDiv)

  let columns = data.columns
  data = data.rows

  // List of subgroups = header of the csv files = soil condition here
  let subgroups = columns.slice(1)
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

  const limitElements = parent.getAttribute('data-limit') || 10
  data = data.slice(0, limitElements)
  const maxPercentage = getUpperLimit(data)

  // List of groups = species here = value of the first column called group -> I show them on the X axis
  let groups = d3.map(data, function(d){return(d[columns[0]])}).keys()
  //groups = groups.map(name => name.split(" ").join('\n'))

  const yAxisLabelWidth = 10
  // set the dimensions and margins of the graph
  const margin = {top: 10, right: 0, bottom: 15, left: 30}
  margin.left += yAxisLabelWidth

  let svgWidth = Math.min(25 * subgroups.length * groups.length * (1 + 2 / subgroups.length), parent.offsetWidth)
  svgWidth = Math.max(svgWidth, 10 * subgroups.length * groups.length * (1 + 2 / subgroups.length))
  const chartWidth = svgWidth - margin.left - margin.right
  let svgHeight = 270
  const chartHeight = svgHeight - margin.top - margin.bottom

  // append the svg object to the body of the page
  let svg2 = d3.create('svg')
  svg2
    .attr("width", svgWidth)
    .attr("height", svgHeight)

  // Add X axis
  let x = d3.scaleBand()
    .domain(groups)
    .range([0, chartWidth ])
    .padding([1 / (subgroups.length + 1)])

  // Add Y axis
  let y = d3.scaleLinear()
    .domain([0, maxPercentage])
    .range([ chartHeight, 0 ]);

  // Another scale for subgroup position?
  let xSubgroup = d3.scaleBand()
    .domain(subgroups)
    .range([0, x.bandwidth()])
    .padding([0.05])

  // color palette = one color per subgroup
  let color = d3.scaleOrdinal()
    .domain(subgroups)
    .range(d3.schemeSet1)

  let lastMax = 0
  // Show the bars
  const chart = svg2.append("g")
    .attr("class", "chart")
  const chartRect = chart.selectAll("g")
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
  chartRect.attr("fill", function(d) { return color(d.key); })
    .attr("x", function(d) { return xSubgroup(d.key); })
    .attr("y", function(d) { return y(d.percentage); })
    .attr("width", xSubgroup.bandwidth())
    .attr("height", function(d) {
      const height = chartHeight - y(d.percentage)
      if (d.isLast) lastMax = Math.max(lastMax, height)
      return height;
    })
    .on("mouseout", function(d) {
      fadeOutTooltip(tooltip)
    })

  chartRect.on("mouseover", function (d) {
    d3.select(this).style("cursor", "pointer")
    tooltip.transition()
        .duration(200)
        .style("opacity", .9);
    const time = periods.filter(o => o.short === d.key)[0]
    const text = `Last ${time.long} : ${d.value} (${d.percentage}%)<br>`
        + `<i>Updated ${dateInterval(new Date(d.updatedAt), new Date())}</i><br>`
        + `Click for more details`
    tooltip.html(text)
        .style("left", (d3.event.pageX) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
  })

  const currentKind = parent.getAttribute('data-kind')
  const expectedKind = getExceptedKind(currentKind)

  if (parent.getAttribute('data-clickable') !== null) {
    chartRect.on("click", function (d) {
      const query = {}
      query[currentKind] = currentKind === 'stack' ? parent.getAttribute('data-name') : 'all'
      query['dataName'] = d.short || d.name

      openInNewPage(parent, expectedKind, query)
    })
  } else {
    chartRect.on("click", async function (d) {
      const query = {}
      query['data-kind'] = expectedKind
      query[`data-${currentKind}`] = currentKind === 'stack' ? parent.getAttribute('data-name') : 'all'
      query['data-name'] = d.short || d.name

      fadeOutTooltip(tooltip)

      const page = await reloadSamePage(parent, expectedKind, query)
      updatePageTitle(page, query['data-kind'], query['data-name'])
      updateGraphs(false, false)
    })
  }

  const size = xSubgroup.bandwidth()
  const spaceBetween = 5
  // Append legend
  let svg1 = d3.create('svg')
  let legend = svg1.append("g")
    .attr("class", "legend")
    //.attr("transform", `translate(${svgWidth + yAxisLabelWidth - 55 - spaceBetween - size}, 0)`)

  const legendWidth = 35 + spaceBetween + size
  const legendHeight = (size + spaceBetween) * subgroups.length - spaceBetween
  const sum = lastMax + legendHeight + margin.bottom + spaceBetween
  if (sum > svgHeight) {
    if (svgWidth + legendWidth < parent.offsetWidth) {
      //svg.attr("width", svgWidth + legendWidth)
      legend = legend.attr("transform", `translate(${svgWidth}, 0)`)
    } else {
      //svg.attr("height", sum)
      chart.attr('transform', `translate(0, ${sum - svgHeight})`)
      margin.top += sum - svgHeight
    }
    svgHeight = sum
  }
  svg1.attr("width", legendWidth)
  svg1.attr("height", legendHeight)

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
      const time = periods.filter(o => o.short === d)[0]
      return time.long[0].toUpperCase() + time.long.slice(1)
    })
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle")


  svg2.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`)
    .call(d3.axisLeft(y));

  svg2.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", yAxisLabelWidth)
    .attr("x", 0 - (chartHeight / 2))
    .attr("font-size", 10)
    .style("text-anchor", "middle")
    .text("Percentage");

  parent.append(containerDiv)

  d3.select(firstDiv).append(() => svg1.node())
  d3.select(secondDiv).append(() => svg2.node())

  const lines = {}
  lines.max = 0
  svg2.append("g")
    .attr("transform", `translate(${margin.left}, ${chartHeight + margin.top})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll(".tick text")
    .call(wrap, x.bandwidth(), lines)

  svgHeight = svgHeight + lines.max * 11
  svg2.attr("height", svgHeight)
  containerDiv.style.height = `${svgHeight + 20}px`
  containerDiv.style.maxWidth = `${svgWidth}px`
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

async function updatePageTitle(page, kind, dataName) {
  const title = page.querySelectorAll('h2')[0]
  if (kind === 'companies') {
    const company = (await loadCompanies()).filter(name => name === dataName)[0]
    if (company) {
      title.innerHTML = `Analysis of contributions of ${company}`;
    }
  } else if (kind === 'stack') {
    const stack = await loadStack(dataName)
    if (stack) {
      title.innerHTML = `Analysis of contributions to ${stack.name}`
    }
  } else if (kind === 'components') {
    const component = (await loadComponents()).filter(component => component.short === dataName)[0]
    if (component) {
      title.innerHTML = `Analysis of contributions to ${component.name}${component.svg}`
      document.getElementById('itemLink').href = component.href
    }
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
  components.sort(sortByName) // Sort alphabetically

  return components
}

async function loadCompanies() {
  const companies = await callApi('GET', `${apiBaseUrl}/companies`)
  companies.sort(sortByName) // Sort alphabetically

  return companies
}

async function loadStack(name) {
  return await callApi('GET', `${apiBaseUrl}/stacks/${name}/details`)
}

async function updateGraphs(keepComment = false, handleRedirect = true) {
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
      console.log(graph)
      const query = {}
      for (const key of queryString.keys()) {
        if (key.indexOf('data-') === 0) {
          query[key] = queryString.get(key)
        }
      }
      const page = await reloadSamePage(graph, query['data-kind'], query)
      updatePageTitle(page, query['data-kind'], query['data-name'])
    }
  }

  const divs = document.querySelectorAll('div.graph')
  for (const div of divs) {
    if (keepComment) {
      const svg = div.querySelector('svg')
      if (svg) svg.remove()
    } else {
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
    const timeoutId = setTimeout(function() {
      const text = document.createElement('text');
      text.innerHTML = "Updating cache";
      loading.append(text);
    }, 5000)
    updateGraph(div, tooltip).catch(function(e) {
      div.append(createErrorMessage(e.message))
      console.error(e)
    }).finally(function() {
      clearTimeout(timeoutId)
      div.removeChild(loading)
    })
  }
}

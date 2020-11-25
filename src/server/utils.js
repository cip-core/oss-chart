const axios = require('axios');
const HTMLParser = require('node-html-parser');

let componentsCache;

const hostname = 'devstats.cncf.io';
const baseUrl = `https://${hostname}/`;

setInterval(updateComponents, 5 * 60 * 1000);

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
  loadComponents,
};
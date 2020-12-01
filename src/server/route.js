const path = require('path');
const fs = require('fs');
const express = require('express');
const HTMLParser = require('node-html-parser');

const utils = require('./utils');

const router = express.Router();

//router.get('/*', officialApi); // Not used by API
router.get('/:component', renderPage);
router.post('/:component/companies', listCompanies);
router.post('/:component/:metrics', officialApi);

async function renderPage(req, res, next) {
  const component = req.params.component;

  const components = await utils.loadComponents();
  for (const c of components) {
    if (c.short === component) {
      const filePath = 'index.html';
      const html = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' });
      const document = HTMLParser.parse(html);
      document.querySelector('#componentName').set_content(c.name);
      if (c.svg) document.querySelector('#h1Title').appendChild(c.svg);
      document.querySelector('#componentLink').setAttribute('href', c.href);
      return await res.send(document.toString());
    }
  }

  await res.json({message: `Component "${component}" does not exist`});
}

async function listCompanies(req, res, next) {
  const component = req.params.component
  const companies = await utils.loadCompanies(component)
  console.log(companies.data.res['A'].tables[0].rows)
  await res.json(companies.data.results['A'].tables[0].rows.slice(1).flat())
}

async function officialApi(req, res, next) {
  const component = req.params.component;
  const metrics = req.params.metrics;

  const { periods, companies } = req.body;

  let response = undefined;
  try {
    const components = await utils.loadComponents();
    for (const c of components) {
      if (c.short === component) {
        response = await utils.loadData(
          component,
          metrics,
          periods,
          companies,
        );
        break;
      }
    }
  } catch (e) {
    response = e.response;
  }

  res.statusCode = response.status;
  res.statusText = response.statusText;
  await res.json(response.data);
}

module.exports = router;

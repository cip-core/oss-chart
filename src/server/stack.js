const path = require('path');
const fs = require('fs');
const express = require('express');
const HTMLParser = require('node-html-parser');

const utils = require('./utils');

const router = express.Router({
  mergeParams: true,
});

router.get('/', mainPage);

router.get('/components', getComponentStacks);
router.post('/components', createComponentStack);
router.put('/components/:name', updateComponentStack);
router.delete('/components/:name', deleteComponentStack);

router.get('/:component', renderPage);
router.post('/:component/companies', listCompanies);
router.post('/:component/:metrics', officialApi);

async function getComponentStacks(req, res, next) {
  const components = await utils.loadComponents();
  const stacks = await utils.getComponentStacks();
  for (const stack of stacks) {
    stack.components = stack.components.map(function (short) {
      if (short.short) return short;
      return components.filter(component => component.short === short)[0];
    })
  }

  return await res.json(stacks);
}

async function createComponentStack(req, res, next) {
  const body = req.body;
  const response = await utils.saveComponentStacksToDatabase(body);
  await res.json(response);
}

async function updateComponentStack(req, res, next) {
  const name = req.params.name;
  const body = req.body;
  body.name = name;

  await utils.deleteComponentStackFromDatabase(body.name);
  const response = await utils.saveComponentStacksToDatabase(body);
  await res.json(response);
}

async function deleteComponentStack(req, res, next) {
  const name = req.params.name;

  const response = await utils.deleteComponentStackFromDatabase(name);
  await res.json(response);
}

async function mainPage(req, res, next) {
  const filePath = 'stack.html';
  const html = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' });
  return await res.send(html);
}

async function renderPage(req, res, next) {
  const component = req.params.component;

  const components = await utils.loadComponents();
  for (const c of components) {
    if (c.short === component) {
      const filePath = 'component.html';
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
  await res.json(companies)
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
    console.error(e)
    response = e.response;
    res.statusCode = response.status;
    res.statusText = response.statusText;
  }

  await res.json(response.data);
}

module.exports = router;


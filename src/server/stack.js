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

router.get('/:stack', renderPage);
router.post('/:stack/companies', listCompanies);
router.post('/:stack/:metrics', officialApi);

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
  const filePath = 'stackMenu.html';
  const html = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' });
  return await res.send(html);
}

async function renderPage(req, res, next) {
  const stackName = req.params.stack;

  const stack = await utils.loadStacks(stackName);
  if (stack) {
    const filePath = 'stack.html';
    const html = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' });
    const document = HTMLParser.parse(html);
    document.querySelector('#componentName').set_content(stack.name);
    if (stack.svg) document.querySelector('#h1Title').appendChild(stack.svg);
    if (stack.href) document.querySelector('#componentLink').setAttribute('href', stack.href);
    return await res.send(document.toString());
  }

  res.statusCode = 404;
  await res.json({message: `Stack "${stackName}" does not exist`});
}

async function listCompanies(req, res, next) {
  const stackName = req.params.stack

  const stack = await utils.loadStacks(stackName);
  if (stack) {
    const companies = []
    for (const component of stack.components) {
      companies.push(... await utils.loadCompanies(component))
    }

    return await res.json(companies.filter((value, index, self) => self.indexOf(value) === index))
  }

  res.statusCode = 404
  await res.json({message: `Stack "${stackName}" does not exist`});
}

async function officialApi(req, res, next) {
  const stackName = req.params.stack;
  const metrics = req.params.metrics;

  const { periods, companies } = req.body;

  try {
    const stack = await utils.loadStacks(stackName);
    if (stack) {
      const response = Object.assign({}, stack)
      const rows = []
      let columns = []

      for (const component of response.components) {
        const data = Object.assign({}, await utils.loadData(component, metrics, periods, companies))
        columns = data.data.columns

        for (const column of columns.slice(1)) {
          for (const company of data.data.rows) {
            const companyIndex = rows.map(c => c.name).indexOf(company.name)
            if (companyIndex === -1) {
              rows.push(company)
            } else {
              const companyData = rows[companyIndex]
              companyData[column] = (companyData[column] || 0) + (company[column] || 0)
              companyData.updatedAt = company.updatedAt
            }
          }
        }
      }

      response.data = { rows, columns }
      return await res.json(response);
    }

    res.statusCode = 404;
    await res.json({message: `Stack "${stackName}" does not exist`});
  } catch (e) {
    console.error(e)
    res.statusCode = 500;
    res.statusText = 'Error';
  }
}

module.exports = router;


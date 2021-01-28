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

router.get('/:stack/details', getDetails);
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
  const { name, components } = req.body;

  let errorMessage = '';
  if (name === undefined) {
    errorMessage = 'Missing "name" parameter'
  } else if (components === undefined) {
    errorMessage = 'Missing "components" parameter'
  } else {
    const short = name.toLowerCase().replace(/ /g, '-');
    const body = {
      short,
      name,
      components,
    };
    body.data = await utils.saveComponentStacksToDatabase(body);
    await res.json(body);
  }

  if (errorMessage) {
    res.statusCode = 400
    await res.json({message: errorMessage});
  }
}

async function updateComponentStack(req, res, next) {
  const short = req.params.name;
  const { components } = req.body;


  let errorMessage = '';
  if (components === undefined) {
    errorMessage = 'Missing "components" parameter'
  } else {
    const stack = await utils.deleteComponentStackFromDatabase(short);
    const body = {
      short,
      name: stack.name,
      components,
    };
    body.data = await utils.saveComponentStacksToDatabase(body);
    await res.json(body);
  }

  if (errorMessage) {
    res.statusCode = 400;
    await res.json({message: errorMessage});
  }
}

async function deleteComponentStack(req, res, next) {
  const short = req.params.name;

  const response = await utils.deleteComponentStackFromDatabase(short);
  if (response) {
    return await res.json(response);
  }

  res.statusCode = 404;
  await res.json({message: `Stack "${short}" does not exist`});
}

async function mainPage(req, res, next) {
  const filePath = 'stackMenu.html';
  const html = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' });
  return await res.send(html);
}

async function getDetails(req, res, next) {
  const stackName = req.params.stack;

  const stack = await utils.loadStacks(stackName);
  if (stack) {
    return await res.json(stack);
  }

  res.statusCode = 404;
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
              const companyData = {
                name: company.name,
                updatedAt: company.updatedAt,
              }
              companyData[column] = company[column] || 0
              rows.push(companyData)
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


const path = require('path');
const fs = require('fs');
const express = require('express');
const HTMLParser = require('node-html-parser');

const utils = require('./utils');

const router = express.Router({
  mergeParams: true,
});

router.get('/', getCompanies);
router.get('/:company', renderPage);
router.post('/:company/:metrics', officialApi);

async function getCompanies(req, res, next) {
  const companies = await utils.loadCompanies()
  await res.json(companies)
}

async function renderPage(req, res, next) {
  const company = req.params.company;

  const companies = await utils.loadCompanies();
  const index = companies.indexOf(company);
  if (index === -1) {
    res.statusCode = 404;
    return await res.json({message: `Company "${company}" does not exist`});
  }

  const filePath = 'company.html';
  const html = fs.readFileSync(path.join(__dirname, filePath), { encoding: 'utf8' });
  const document = HTMLParser.parse(html);
  document.querySelector('#companyName').set_content(company);
  return await res.send(document.toString());
}

async function officialApi(req, res, next) {
  const company = req.params.company;
  const metrics = req.params.metrics;

  let { periods, stack, components } = req.body;
  if (stack) {
    const stackData = await utils.loadStacks(stack);
    if (stackData) {
      components = stackData.components;
    } else {
      res.statusCode = 404;
      return await res.json({message: `Stack "${stack}" does not exist`});
    }
  }

  try {
    const response = {
      rows: [],
      columns: [],
    };
    const componentsData = await utils.loadComponents();
    const componentsShort = componentsData.map(component => component.short);
    for (const component of components) {
      const index = componentsShort.indexOf(component);
      if (index === -1) continue;
      const componentData = componentsData[index];
      const data = await utils.loadData(
        component,
        metrics,
        periods,
        [ company ],
      )
      data.data.rows.map(function (row) {
        row.name = componentData.name;
        row.short = componentData.short;
        return row;
      });
      response.columns.push(...data.data.columns);
      response.rows.push(...data.data.rows);
    }
    response.columns = response.columns.filter((value, index, self) => self.indexOf(value) === index);

    return await res.json(response);
  } catch (e) {
    console.error(e)
    const response = e.response;
    res.statusCode = response.status;
    res.statusText = response.statusText;
    await res.json(response.data);
  }
}

module.exports = router;


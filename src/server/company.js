const express = require('express');

const utils = require('./utils');

const router = express.Router({
  mergeParams: true,
});

router.get('/', getCompanies);
router.post('/:company/:metrics', officialApi);

async function getCompanies(req, res, next) {
  const companies = await utils.loadCompanies()
  await res.json(companies)
}

async function officialApi(req, res, next) {
  const company = req.params.company;
  const metrics = req.params.metrics;

  let { periods, stack, components = [] } = req.body;
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
    const componentsData = utils.loadComponents();
    if (componentsData.updating) return await res.json(componentsData);

    const componentsShort = componentsData.map(component => component.short);
    const allComponents = components[0] === 'all';
    if (allComponents) components = componentsShort;
    components = components.filter(c => c !== 'all')

    let updating = undefined
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
      if (data.updating) {
        if (!updating) await res.json(data)
        updating = data
      }
      data.data.rows.map(function (row) {
        row.name = componentData.name;
        row.short = componentData.short;
        return row;
      });
      response.columns.push(...data.data.columns);
      response.rows.push(...data.data.rows);
    }
    response.columns = response.columns.filter((value, index, self) => self.indexOf(value) === index);

    if (!updating) return await res.json({ data: response });
  } catch (e) {
    console.error(e)
    const response = e.response;
    res.statusCode = response.status;
    res.statusText = response.statusText;
    await res.json(response.data);
  }
}

module.exports = router;


const express = require('express');

const utils = require('./utils');

const router = express.Router({
  mergeParams: true,
});

router.get('/', getComponents);
router.post('/:component/:metrics', officialApi);

async function getComponents(req, res, next) {
  const components = await utils.loadComponents();
  await res.json(components.filter(component => component.short !== 'all'));
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


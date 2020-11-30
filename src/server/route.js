const path = require('path');
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const HTMLParser = require('node-html-parser');

const utils = require('./utils');

const router = express.Router();

//router.get('/*', officialApi); // Not used by API
router.get('/:component', renderPage);
router.post('/:component/*', officialApi);

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

async function officialApi(req, res, next) {
  const component = req.params.component;
  const url = req.params['0'];

  let response = undefined;
  try {
    const components = await utils.loadComponents();
    for (const c of components) {
      if (c.short === component) {
        response = await axios({
          method: req.method,
          url: `${c.href}/${url}`,
          data: req.body,
        });
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


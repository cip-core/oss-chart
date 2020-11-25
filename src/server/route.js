const express = require('express');
const axios = require('axios');

const instance = axios.create({
  baseURL: 'https://k8s.devstats.cncf.io',
});
const router = express.Router();

//router.get('/*', officialApi); // Not used by API
router.post('/*', officialApi);

async function officialApi(req, res, next) {
  const url = req.params['0'];

  let response = undefined;
  try {
    response = await instance({
      method: req.method,
      url: url,
      data: req.body,
    });
  } catch (e) {
    response = e.response;
  }

  res.statusCode = response.status;
  res.statusText = response.statusText;
  await res.json(response.data);
}

module.exports = router;


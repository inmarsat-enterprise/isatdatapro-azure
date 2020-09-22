// Token management: check/notify expiry; generate new builder

// Get templates, compare against this lib; upload new from lib
const https = require('https')
const proxyEnv = require('../local.settings.json').Values;

const apiHost = process.env.IOTC_APPLICATION_URL || proxyEnv.IOTC_APPLICATION_URL;
const apiKey = process.env.IOTC_BUILDER_TOKEN || proxyEnv.IOTC_BUILDER_TOKEN;
const deviceListApi = '/api/preview/devices';
const deviceTemplateListApi = '/api/preview/deviceTemplates';

const apiGet = (options) => new Promise((resolve, reject) => {
  https.get(options, (response) => {
    let body = ''
    response.on('data', (chunk) => body += chunk)
    response.on('end', () => resolve(body))
  }).on('error', reject)
})

async function getDevices() {
  const deviceOptions = {
    hostname: `${apiHost}`,
    path: `${deviceListApi}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `${apiKey}`
    }
  };
  const { value: devices } = JSON.parse(await apiGet(deviceOptions));
  return devices;
}

async function getDeviceTemplates() {
  const dtdlOptions = {
    hostname: `${apiHost}`,
    path: `${deviceTemplateListApi}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `${apiKey}`
    }
  };
  const { value: deviceTemplates } = JSON.parse(await apiGet(dtdlOptions));
  return deviceTemplates;
}

module.exports = { getDevices, getDeviceTemplates };
// IoT Central REST API calls for Device Templates

// Get templates, compare against this lib; upload new from lib
const https = require('https')
const { capabilityModels, interfaces } = require('./deviceTemplates');

let tempEnv;
if (!process.env.IOTC_APPLICATION_URL) {
  const { IOTC_APPLICATION_URL, IOTC_BUILDER_TOKEN } =
      require('../local.settings.json').Values;
  tempEnv = {
    IOTC_APPLICATION_URL: IOTC_APPLICATION_URL,
    IOTC_BUILDER_TOKEN: IOTC_BUILDER_TOKEN,
  };
}

const apiHost = process.env.IOTC_APPLICATION_URL || tempEnv.IOTC_APPLICATION_URL;
const apiKey = process.env.IOTC_BUILDER_TOKEN || tempEnv.IOTC_BUILDER_TOKEN;
const deviceApiPath = '/api/preview/devices';
const deviceTemplateApiPath = '/api/preview/deviceTemplates';

/**
 * Intefaces to the IoT Central REST API
 * @private
 * @param {Object} options Request options including path, method
 * @param {string} reqBody The body content as a string
 * @returns {Promise}
 */
const api = (options, reqBody) => new Promise((resolve, reject) => {
  let postData;
  options.hostname = `${apiHost}`;
  options.headers = {
    'Content-Type': 'application/json',
    'Authorization': `${apiKey}`
  };
  if (reqBody) {
    postData = JSON.stringify(reqBody);
    options.headers['Content-Length'] = Buffer.byteLength(postData);
  }
  const req = https.request(options, (res) => {
    let resBody = '';
    res.on('data', (chunk) => resBody += chunk);
    res.on('end', () => resolve(resBody));
  });
  req.on('error', (e) => { reject(e) });
  if (reqBody) req.write(postData);
  req.end();
})

/**
 * Retrieves all devices from the application
 * @returns {Object[]} A list of devices
 */
async function getDevices() {
  const deviceOptions = {
    path: `${deviceApiPath}`,
    method: 'GET',
  };
  const res = JSON.parse(await api(deviceOptions));
  if (res.error) throw new Error(res.error);
  return res.value;
}

/**
 * Returns properties of a specific device
 * @param {string} id The unique ID of the device in IoT Central
 * @returns {Object} the properties
 */
async function getDeviceProperties(id) {
  if (!id) throw new Error(`Missing device unique id`);
  const getPropOptions = {
    path: `${deviceApiPath}/${id}/properties`,
    method: 'GET',
  };
  const res = JSON.parse(await api(getPropOptions));
  if (res.error) throw new Error(res.error);
  return res;
}

/**
 * Returns a word-formatted string from snake_ or camelCase
 * @private
 * @param {string} uglyName The name to convert to pretty
 * @returns {string}
 */
function prettyName(uglyName) {
  let camelCase = uglyName.replace(/([_][a-z])/ig, ($1) => {
    return $1.toUpperCase().replace('_', '');
  });
  let toWords = camelCase.replace(/([A-Z])/g, ($1) => {
    return ` ${$1}`;
  });
  return toWords[0].toUpperCase() + toWords.substring(1);
}

/**
 * Creates an IOT Central template from a Device Capability Model
 * @param {Object} capabilityModel A device capability model DTDL v1
 * @returns {Object} the template wrapper to send to the API
 */
function buildTemplate(template) {
  if (template.capabilityModel.comment &&
      template.capabilityModel.comment.includes(
          'retrieve from deviceCapabilityModels')) {
    for (let model in capabilityModels) {
      if (template.capabilityModel['@id'] === capabilityModels[model]['@id']) {
        template.capabilityModel = capabilityModels[model];
        break;
      }
    }
  }
  for (let i=0; i < template.capabilityModel.implements.length; i++) {
    let interface = template.capabilityModel.implements[i];
    if (interface.schema.comment &&
        interface.schema.comment.includes('retrieve from interfaces')) {
      for (const t in interfaces) {
        if (interface.schema['@id'] === interfaces[t].schema['@id']) {
          template.capabilityModel.implements[i].schema = interfaces[t].schema;
          break;
        }
      }
    }
  }
  if (!template.id) template.id = `urn:example:api:deviceTemplate:1`;
  return template;
}

/**
 * Provisions a device template in IoT Central
 * @param {Object} template A DTDLv1 device capability model
 * @returns {string} template ID
 */
async function setDeviceTemplate(template) {
  const builtTemplate = buildTemplate(template);
  const setOptions = {
    path: `${deviceTemplateApiPath}/${builtTemplate.id}`,
    method: 'PUT',
  };
  const res = JSON.parse(await api(setOptions, builtTemplate));
  if (res.error) throw new Error(res.error.message);
  return res.id;
}

/**
 * 
 * @param {Object} template 
 */
async function removeDeviceTemplate(template) {
  const removeOptions = {
    path: `${deviceTemplateApiPath}/${template['@id']}`,
    method: 'DELETE',
  };
  const res = JSON.parse(await api(removeOptions));
  if (res.error) throw new Error(res.error.message);
  return res.approved;
}

/**
 * Retrieves provisioned device templates from IoT Central application
 * @returns {Object[]} list
 */
async function listDeviceTemplates() {
  const getOptions = {
    path: `${deviceTemplateApiPath}`,
    method: 'GET',
  };
  const res = JSON.parse(await api(getOptions));
  if (res.error) throw new Error(res.error);
  return res.value;
}

async function updateDeviceTemplates(context) {
  const templatesInRepo = require('./deviceTemplates/templates');
  const templatesInCentral = await listDeviceTemplates();
  for (const templateName in templatesInRepo) {
    for (let i=0; i < templatesInCentral.length; i++) {
      if (templatesInRepo[templateName].id === templatesInCentral[i].id) {
        delete templatesInRepo[templateName];
        break;
      }
    }
  }
  for (const templateName in templatesInRepo) {
    await setDeviceTemplate(templatesInRepo[templateName]);
    context.log(`Updated device template ${templateName}`);
  }
}

module.exports = {
  getDevices,
  getDeviceProperties,
  listDeviceTemplates,
  setDeviceTemplate,
  removeDeviceTemplate,
  buildTemplate,
  updateDeviceTemplates,
};

/* Comment this line to test
(async () => {
  const templates = require('./deviceTemplates/templates');
  try {
    for (let template in templates) {
      console.log(await setDeviceTemplate(templates[template]));
    }
    console.log(await listDeviceTemplates());
  } catch (e) {
    console.log(e.stack);
  }
})();
// */
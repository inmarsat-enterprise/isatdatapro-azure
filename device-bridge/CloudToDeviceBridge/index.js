/* Periodically connects to IOT Central for each provisioned device 
 * to check for commands/desired properties
 * TODO: determine a way to multiplex a connection to listen simultaneously
 * for all devices commands and property changes for a few minutes every 
 * few minutes
 */
const checkDesiredPropertiesCommands = require('../lib/idpDeviceInterfaceBridge');
const { getDevices, updateDeviceTemplates } = require('../lib/iotcDcmApi');
const { templates } = require('../lib/deviceTemplates');

const manufacturerCodes = ['SKY', 'HON'];

/**
 * Returns the Mobile ID from a provisioned device ID
 * @private
 * @param {string} deviceId Unique provisioned device ID containing Mobile ID
 * @returns {string} mobileId
 */
function extractMobileId(deviceId) {
  let mobileId;
  for (let m=0; m < manufacturerCodes.length; m++) {
    if (deviceId.includes(manufacturerCodes[m])) {
      const index = deviceId.search(manufacturerCodes[m]);
      mobileId = deviceId.substring(index - 8, index + 7);
      break;
    }
  }
  return mobileId;
}

module.exports = async function (context, timer) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  try {
    if (timer.IsPastDue) {
      context.log(`${thisFunction.name} timer past due!`);
    }
    context.log(`${thisFunction.name} timer triggered at ${callTime}`);
    // TODO: check templates in library and push any new ones/versions
    await updateDeviceTemplates(context);
    const provisionedDevices = await getDevices();
    for (let d=0; d < provisionedDevices.length; d++) {
      const device = {};
      for (let template in templates) {
        if (templates[template].id === provisionedDevices[d].instanceOf) {
          device.id = provisionedDevices[d].id;
          device.model = template;
          device.mobileId = extractMobileId(device.id);
          break;
        }
      }
      if (device.id) {
        await checkDesiredPropertiesCommands(context, device);
      } else {
        context.log.verbose(`Device ${provisionedDevices[d].id} not templated`);
      }
    }
  } catch (err) {
    context.log(err.message, err.stack);
  }
};
/* Periodically connects to IOT Central for each provisioned device 
 * to check for commands/desired properties
 * TODO: determine a way to multiplex a connection to listen simultaneously
 * for all devices commands and property changes for a few minutes every 
 * few minutes
 */
const checkDesiredPropertiesCommands = require('../lib/idpDeviceInterfaceBridge');
const { getDevices } = require('../lib/iotcDcmApi');
//const getKeyVaultSecret = require('../lib/keyvault');
const { templates } = require('../lib/deviceTemplates');

const manufacturerCodes = ['SKY', 'HON'];

/**
 * Returns the Mobile ID from a device ID
 * @private
 * @param {string} deviceId Unique device ID containing Mobile ID
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
    const provisionedDevices = await getDevices();
    provisionedDevices.forEach(provisionedDevice => {
      const device = {};
      for (let template in templates) {
        if (templates[template].id === provisionedDevice.instanceOf) {
          device.id = provisionedDevice.id;
          device.model = template;
          device.mobileId = extractMobileId(device.id);
          break;
        }
      }
      await checkDesiredPropertiesCommands(context, device);
    });
  } catch (err) {
    context.log(err.message, err.stack);
  } finally {
  }
};
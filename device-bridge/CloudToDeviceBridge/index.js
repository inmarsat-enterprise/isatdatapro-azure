/* Periodically connects to IOT Central for each provisioned device 
 * to check for offline commands and desired properties changes
 * TODO: determine a way to multiplex a connection to listen simultaneously
 * for all devices commands and property changes for a few minutes every 
 * few minutes
 */
const updateDevice = require('../lib/idpDeviceInterfaceBridge').azureIotDeviceBridge;
const { listDevices, updateDeviceTemplates, extractMobileId } = require('../lib/iotcDeviceApi');
const { templates } = require('../lib/deviceTemplates');

/**
 * Periodically checks the IoT Hub for new offline commands or properties
 * @param {Object} context The Azure Function context
 * @param {Object} timer An Azure Function Timer trigger
 */
module.exports = async function (context, timer) {
  const callTime = new Date().toISOString();
  context.bindings.outputEvent = [];
  try {
    if (timer.IsPastDue) {
      context.log.warn(`${__filename} timer past due!`);
    }
    context.log.verbose(`${__filename} >>>> entry (timer) at ${callTime}`);
    // Check templates in library and push any new or updates
    await updateDeviceTemplates(context);
    const provisionedDevices = await listDevices();
    for (let d=0; d < provisionedDevices.length; d++) {
      const device = {};
      for (let template in templates) {
        if (templates[template].id === provisionedDevices[d].instanceOf) {
          device.id = provisionedDevices[d].id;
          device.modelName = template;
          device.mobileId = extractMobileId(device.id);
          break;
        }
      }
      if (device.id) {
        await updateDevice(context, device);
      } else {
        context.log.warn(`Device ${provisionedDevices[d].id} not templated`);
      }
    }
  } catch (err) {
    context.log.error(err.stack);
  } finally {
    const runTime = new Date() - new Date(callTime);
    context.log.verbose(`${__filename} <<<< exit (runtime: ${runTime})`);
  }
};

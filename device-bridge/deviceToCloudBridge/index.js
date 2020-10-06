// Triggers on NewReturnMessage eventgrid event
const handleMessage = require('../lib/idpDeviceInterfaceBridge');
const { getDevices } = require('../lib/iotcDcmApi');
//const getKeyVaultSecret = require('../lib/keyvault');
const deviceModels = require('../lib/deviceModels');
const { templates } = require('../lib/deviceTemplates');

const defaultDeviceIdFormat =
    process.env.IOTC_DFLT_DEVICE_ID_FORMAT || 'idp-${mobileId}';

async function getDeviceMeta(mobileId) {
  const provisionedDevices = await getDevices();
  const device = {};
  for (let d=0; d < provisionedDevices.length; d++) {
    if (provisionedDevices[d].id.includes(mobileId)) {
      for (let template in templates) {
        if (templates[template].id === provisionedDevices[d].instanceOf) {
          device.id = provisionedDevices[d].id;
          device.model = template;
          device.mobileId = mobileId;
          break;
        }
      }
    }
    if (device.model) break;
  }
  if (!device.model) device.model = 'idpDefault';
  if (!device.id) {
    device.id = defaultDeviceIdFormat.replace('${mobileId}', mobileId);
  }
  if (!device.mobileId) device.mobileId = mobileId;
  return device;
}

module.exports = async function (context, eventGridEvent) {
  context.log.verbose(`Device-to-cloud bridge triggered`
      + ` by ${JSON.stringify(eventGridEvent)}`);
  let parsed;
  let device;
  //if (eventGridEvent.eventType === 'NewReturnMessage') {
  const message = eventGridEvent.data;
  let mobileId = message.mobileId;
  device = await getDeviceMeta(mobileId);
  if (device.model in deviceModels) {
    parsed = deviceModels[device.model].parse(context, message);
  } else {
    throw new Error(`Could not find model: ${device.model}`);
  }
  //}
  try {
    //TODO: move parsing to engine
    await handleMessage(context, device,
        parsed.telemetry, parsed.reportedProperties, parsed.timestamp);
  } catch (e) {
    context.log.error(e.stack);
  }
};

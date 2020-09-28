// Triggers on NewReturnMessage eventgrid event
const handleMessage = require('../lib/engine');
const { getDevices } = require('../lib/iotcApi');
//const getKeyVaultSecret = require('../lib/keyvault');
const deviceModels = require('../lib/deviceModels');
const { templates } = require('../lib/deviceTemplates');

const defaultDeviceIdFormat =
    process.env.IOTC_DFLT_DEVICE_ID_FORMAT || 'idp-${mobileId}';

const supportedCodecServiceIds = {
  0: "other",
  255: "telemetry",
  101: "reportedProperties",
  102: "commands",
};

module.exports = async function (context, eventGridEvent) {
  context.log.verbose(`IOTC bridge received ${JSON.stringify(eventGridEvent)}`);
  const returnMessage = eventGridEvent.data;
  if (!(returnMessage.codecServiceId in supportedCodecServiceIds)) return;
  let mobileId = returnMessage.mobileId;
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
  let parsed;
  if (!device.model) device.model = 'idpDefault';
  if (!device.id) {
    device.id = defaultDeviceIdFormat.replace('${mobileId}', mobileId);
  }
  if (!device.mobileId) device.mobileId = mobileId;
  if (device.model in deviceModels) {
    parsed = deviceModels[device.model].parse(context, returnMessage);
  } else {
    throw new Error(`Could not find model: ${device.model}`);
  }
  try {
    //TODO: move parsing to engine
    await handleMessage(context, device,
        parsed.telemetry, parsed.reportedProperties, parsed.timestamp);
  } catch (e) {
    context.log.error(e.stack);
  }
};

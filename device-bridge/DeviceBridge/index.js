// Triggers on NewReturnMessage eventgrid event
const handleMessage = require('../lib/engine');
const { getDevices } = require('../lib/iotcApi');
//const getKeyVaultSecret = require('../lib/keyvault');
const deviceModels = require('../lib/deviceModels');
const { devices: deviceTemplates } = require('../lib/deviceCapabilityModels');

const supportedCodecServiceIds = {
  0: "other",
  100: "telemetry",
  101: "reportedProperties",
  102: "commands",
};

const legacyTemplates = [
  'urn:l9nx1tdyc:n8i416avrr',
];

module.exports = async function (context, eventGridEvent) {
  context.log.verbose(`IOTC bridge received ${JSON.stringify(eventGridEvent)}`);
  const returnMessage = eventGridEvent.data;
  if (!(returnMessage.codecServiceId in supportedCodecServiceIds)) return;
  let device = { deviceId: `idp-${returnMessage.mobileId}` };
  const provisionedDevices = await getDevices();
  let template;
  for (let d=0; d < provisionedDevices.length; d++) {
    if (provisionedDevices[d].id === device.deviceId) {
      template = provisionedDevices[d].instanceOf;
      if (legacyTemplates.includes(template)) {
        template = 'urn:example:inmarsat-idp:ut:inmarsatPnpDevKit';
      }
      break;
    }
  }
  let parsed;
  if (template) {
    for (dtName in deviceTemplates) {
      if (deviceTemplates[dtName]['@id'] === template) {
        parsed = deviceModels[dtName].parse(context, returnMessage);
        break;
      }
    }
  }
  if (!parsed) {
    parsed = deviceModels['idpDefault'].parse(context, returnMessage);
  }
  try {
    await handleMessage(context, device, 
        parsed.telemetry, parsed.reportedProperties, parsed.timestamp);
  } catch (e) {
    context.log.error(e.stack);
  }
};

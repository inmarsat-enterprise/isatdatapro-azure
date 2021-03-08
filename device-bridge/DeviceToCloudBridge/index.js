/* Triggers on NewReturnMessage or OtaCommandResponse eventgrid events
 * or MailboxQuery or SatelliteGatewayQuery events
 * Parses the event data based on a device model definition which maps 
 * data into telemetry and reported properties
 */
const handleMessage = require('../lib/idpDeviceInterfaceBridge');
const { getDevices } = require('../lib/iotcDcmApi');
const deviceModels = require('../lib/deviceModels');
const { templates } = require('../lib/deviceTemplates');
const util = require('../lib/utilities');

const defaultDeviceIdFormat =
    process.env.IOTC_DFLT_DEVICE_ID_FORMAT || 'idp-${mobileId}';

/**
 * Looks up the provisioned device template for a device based on the 
 * IDP mobile ID to map to a device model
 * @param {string} identifier Unique satellite modem ID
 * @returns {{ id: string, model: string, mobileId: string }}
 */
async function getDeviceMeta(identifier) {
  const provisionedDevices = await getDevices();
  const device = {};
  for (let d=0; d < provisionedDevices.length; d++) {
    if (provisionedDevices[d].id.includes(identifier)) {
      for (let template in templates) {
        if (templates[template].id === provisionedDevices[d].instanceOf) {
          device.id = provisionedDevices[d].id;
          device.model = template;
          //device.mobileId = mobileId;
          break;
        }
      }
    }
    if (device.model) break;
  }
  return device;
}

module.exports = async function (context, eventGridEvent) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  context.log.verbose(`${thisFunction.name} >>>> entry triggered`
      + ` by ${JSON.stringify(eventGridEvent)}`);
  let parsed;
  let device;
  const data = eventGridEvent.data;
  const eventType = eventGridEvent.eventType;
  switch (eventType) {
    case 'NewReturnMessage':
    case 'OtaCommandResponse':
      device = await getDeviceMeta(data.mobileId);
      if (!device.model) device.model = 'idpDefault';
      if (!device.id) {
        device.id = defaultDeviceIdFormat.replace('${mobileId}', mobileId);
        context.log.warning(`Assigned device.id ${device.id}`);
      }
      if (!device.mobileId) device.mobileId = data.mobileId;
      break;
    case 'MailboxQuery':
    case 'SatelliteGatewayQuery':
      device = await getDeviceMeta(eventGridEvent.data.name);
      if (!device.id) {
        if (eventType === 'MailboxQuery') {
          const operator = data.satelliteGatewayName.toLowerCase();
          const tag = operator.includes('orbc') ? 'gatewayAccount' : 'mailbox';
          device.id = `${operator}-${tag}-${data.mailboxId}`;
          device.model = 'mailbox';
        } else {
          device.id = `${data.name}-mgs`;
          device.model = 'satelliteGateway';
        }
      }
      break;
    default:
      throw new Error(`Unsupported event ${eventGridEvent.eventType}`);
  }
  if (device.model in deviceModels) {
    parsed = deviceModels[device.model].parse(context, data);
    context.log.verbose(`Parsed: ${JSON.stringify(parsed)}`);
  } else {
    throw new Error(`Could not find model: ${device.model}`);
  }
  try {
    //TODO: move parsing to engine
    await handleMessage(context, device,
        parsed.telemetry, parsed.reportedProperties, parsed.timestamp);
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    const runTime = new Date() - new Date(callTime);
    context.log.verbose(`${__filename} <<<< exit (runtime: ${runTime})`);
  }
};

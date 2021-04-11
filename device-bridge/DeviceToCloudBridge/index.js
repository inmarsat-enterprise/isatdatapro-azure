/* Triggers on NewReturnMessage or OtaCommandResponse eventgrid events.
 * Parses the event data based on a device model definition which maps 
 * data into telemetry and reported properties.
 */
const handleEvent = require('../lib/idpDeviceInterfaceBridge');
const { getDevices } = require('../lib/iotcDcmApi');
const deviceModels = require('../lib/deviceModels');
const { templates } = require('../lib/deviceTemplates');
const _ = require('lodash');

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
          break;
        }
      }
    }
    if (device.model) break;
  }
  return device;
}

/**
 * Processes standard mobile-originated messages and OTA command completion.
 * @param {object} context Azure Function context for logging, etc
 * @param {object} eventGridEvent The triggering Event
 */
module.exports = async function (context, eventGridEvent) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  context.log.verbose(`${thisFunction.name} >>>> entry triggered`
      + ` by ${JSON.stringify(eventGridEvent.eventType)}`);
  let device;
  try {
    const { data, eventType } = eventGridEvent;
    switch (eventType) {

      case 'NewReturnMessage':
        context.log.verbose(`Received message ${data.messageId}` +
            ` from ${data.mobileId}`);
        device = await getDeviceMeta(data.mobileId);
        if (!device.model) {
          context.log.warn(`Device not provisioned: using idpDefault model`);
          //TODO: Trigger a workflow for operator to manually provision device
          device.model = 'idpDefault';
        }
        if (!device.id) {
          device.id = defaultDeviceIdFormat.replace('${mobileId}', data.mobileId);
          context.log.warn(`Assigned device.id ${device.id}`);
        }
        device.mobileId = data.mobileId;
        context.log.verbose(`Attempting to parse message ID ${data.messageId}`);
        const parsed = deviceModels[device.model].parse(context, data);
        context.log.verbose(`Parsed: ${JSON.stringify(parsed)}`);
        _.merge(device, parsed);
        break;
      
      case 'OtaCommandComplete':
        context.log.info(eventGridEvent.subject);
        device = await getDeviceMeta(data.mobileId);
        device.mobileId = data.mobileId;
        if (data.completion) {
          let ac = 200;
          let ad = 'completed'
          if ('reason' in data) {
            switch (data.reason) {
              case 'ERROR':
                ac = 500;
                break;
              default:
                // Other codes imply OTA message timeout
                ac = 408;
            }
            ad = data.reason;
          }
          device.patch = {};
          device.patch[data.completion.property] = {
            value: data.completion.value,
            ac: ac,
            ad: ad,
            av: data.completion.av,
          };

        } else {
          context.log.verbose(`No completion data available`)
          // TODO something special for offline command completion?
        }
        break;
        
      /* TODO: future manage mailboxes and satellite message gateway via IOTC
      case 'MailboxQuery':
        // Similar processing as SatelliteGatewayQuery
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
      */
      
      default:
        throw new Error(`Unsupported event ${eventGridEvent.eventType}`);
    }
    if (device.model in deviceModels) {
      await handleEvent(context, device);
    } else {
      throw new Error(`Could not find model: ${device.model}`);
    }
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    const runTime = new Date() - new Date(callTime);
    context.log.verbose(`${__filename} <<<< exit (runtime: ${runTime})`);
  }
};

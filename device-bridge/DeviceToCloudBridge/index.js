/* Triggers on NewReturnMessage or OtaCommandResponse eventgrid events.
 * Parses the event data based on a library device model definition which maps 
 * data into telemetry and reported properties.
 */
const processEventData = require('../lib/idpDeviceInterfaceBridge').azureIotDeviceBridge;
const { getDeviceMeta } = require('../lib/iotcDeviceApi');
const deviceModels = require('../lib/deviceModels');
const _ = require('lodash');

/**
 * Processes standard mobile-originated messages and OTA command completion.
 * @param {object} context Azure Function context for logging, etc
 * @param {object} eventGridEvent The triggering Event
 */
module.exports = async function (context, eventGridEvent) {
  const callTime = new Date().toISOString();
  context.log.verbose(`${__filename} >>>> entry triggered` +
      ` by ${JSON.stringify(eventGridEvent.eventType)}`);
  context.bindings.outputEvent = [];
  const { data, eventType } = eventGridEvent;
  try {
    let device = await getDeviceMeta(data.mobileId);
    if (!device) {
      context.log.warn(`Not processing data from ${data.mobileId}` +
          ` since no matching device found in IOT Central`);
    } else {
      switch (eventType) {
        case 'NewReturnMessage':
          context.log.verbose(`Processing NewReturnMessage ${data.messageId}` +
              ` from ${device.id}`);
          const parsed = deviceModels[device.modelName].parse(context, data);
          context.log.verbose(`Parsed: ${JSON.stringify(parsed)}`);
          _.merge(device, parsed);
          break;
        case 'OtaCommandComplete':
          context.log.info(`Processing OtaCommandComplete:` +
              ` ${eventGridEvent.subject}`);
          if (data.completion) {
            let ac = 200;
            let ad = 'completed'
            if ('reason' in data) {
              switch (data.reason) {
                case 'NO_ERROR':
                  break;
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
            context.log.warn(`No completion data available for event:` +
                ` ${eventGridEvent.subject}`);
            // TODO something special for offline command completion?
          }
          break;
        default:
          throw new Error(`Unsupported event ${eventGridEvent.eventType}`);
      }
      if (device.modelName in deviceModels) {
        await processEventData(context, device);
      } else {
        throw new Error(`Could not find model: ${device.modelName}`);
      }
    }
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    const runTime = new Date() - new Date(callTime);
    context.log.verbose(`${__filename} <<<< exit (runtime: ${runTime})`);
  }
};

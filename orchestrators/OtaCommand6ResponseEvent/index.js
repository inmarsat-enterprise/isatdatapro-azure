const uuid = require('uuid').v4;

const testMode = process.env.testMode;
const funcName = 'OtaCommand7ResponseEvent';

module.exports = async function(context, eventData) {
  if (!eventData.response) throw new Error(`${funcName} missing response`);
  if (!eventData.commandMeta) throw new Error(`${funcName} missing commandMeta`);
  const { response, commandMeta } = eventData;
  const { otaCommandId } = commandMeta;
  try {
    const event = {
      id: uuid(),
      dataVersion: '2.0',
      subject: `Command response for ${otaCommandId}`,
      data: Object.assign({}, response, commandMeta),
      eventType: 'OtaCommandResponse',
      eventTime: response.receiveTimeUtc,
    };
    if (!testMode) {
      context.log.info(`${funcName} publishing to EventGrid` +
          ` ${JSON.stringify(event)} for Device Bridge`);
      context.bindings.outputEvent = event;
    } else {
      context.log.warn('testMode enabled not publishing to EventGrid' +
          ` ${JSON.stringify(event)}`);
    }
    return { eventType: event.eventType, id: event.id };
  } catch (e) {
    context.log.error(e.toString());
  }
};
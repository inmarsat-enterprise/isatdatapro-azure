const uuid = require('uuid').v4;

const testMode = process.env.testMode;
const funcName = 'OtaCommand7ResponseEvent';

module.exports = async function(context, eventData) {
  if (!eventData.response) throw new Error(`${funcName} missing response`);
  if (!eventData.commandMeta) throw new Error(`${funcName} missing commandMeta`);
  const { response, commandMeta } = eventData;
  const { otaCommandId } = commandMeta;
  try {
    const responseEvent = {
      id: uuid(),
      dataVersion: '2.0',
      subject: `Command response for ${otaCommandId}`,
      data: Object.assign({}, response, commandMeta),
      eventType: 'OtaCommandResponse',
      eventTime: response.receiveTimeUtc,
    };
    if (!testMode) {
      context.log.info(`${funcName} publishing to EventGrid` +
          ` ${JSON.stringify(responseEvent)} for Device Bridge`);
      context.bindings.outputEvent = responseEvent;
    } else {
      context.log.warn('testMode enabled not publishing to EventGrid' +
          ` ${JSON.stringify(responseEvent)}`);
    }
    return responseEvent.id;
  } catch (e) {
    context.log.error(e.toString());
  }
};
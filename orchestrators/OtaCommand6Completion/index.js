const uuid = require('uuid').v4;

const testMode = (process.env.testMode === 'true');
const funcName = 'OtaCommand6Completion';

module.exports = async function(context, eventData) {
  if (!eventData.delivered) throw new Error(`${funcName} missing delivered`);
  if (!eventData.commandMeta) throw new Error(`${funcName} missing commandMeta`);
  const { delivered, commandMeta, response } = eventData;
  const { otaCommandId, mobileId, completion } = commandMeta;
  try {
    const event = {
      id: uuid(),
      dataVersion: '2.0',
      eventType: 'OtaCommandComplete',
      subject: `OtaCommand ${otaCommandId} to ${mobileId}` +
          ` ${delivered.success ? 'delivered' : 'failed'}` +
          `${response ? ' with response' : ''}`,
      data: {
        otaCommandId: otaCommandId,
        mobileId: mobileId,
        completion: completion,
        delivered: delivered,
        response: response,
      },
      eventTime: response ? response.mailboxTimeUtc : delivered.deliveryTime,
    };
    delete event.data.completion.response;   //redundant
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
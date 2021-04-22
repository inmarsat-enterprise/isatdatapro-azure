const uuid = require('uuid').v4;

const testMode = process.env.testMode;
const funcName = 'OtaCommand5Completion';

module.exports = async function(context, eventData) {
  if (!eventData.delivered) throw new Error(`${funcName} missing delivered`);
  if (!eventData.commandMeta) throw new Error(`${funcName} missing commandMeta`);
  const { delivered, commandMeta } = eventData;
  const { otaCommandId } = commandMeta;
  try {
    const completionEvent = {
      id: uuid(),
      dataVersion: '2.0',
      data: Object.assign({}, commandMeta),
      eventType: 'OtaCommandComplete',
      eventTime: delivered.deliveryTime,
    };
    delete completionEvent.data.command;
    if (delivered.success) {
      context.log.verbose(`Command ${otaCommandId} delivered`);
      completionEvent.subject = `Command delivered: ${otaCommandId}`;
      completionEvent.data.commandDeliveredTime = delivered.deliveryTime;
    } else {
      context.log.warn(`Command ${otaCommandId} failed`)
      completionEvent.subject = `Command failed: ${otaCommandId}`;
      completionEvent.data.commandFailedTime = delivered.deliveryTime;
    }
    if (!testMode) {
      context.log.info(`${funcName} publishing to EventGrid` +
          ` ${JSON.stringify(completionEvent)} for Device Bridge`);
      context.bindings.outputEvent = completionEvent;
    } else {
      context.log.warn('testMode enabled not publishing to EventGrid' +
          ` ${JSON.stringify(completionEvent)}`);
    }
    return completionEvent.id;
  } catch (e) {
    context.log.error(e.toString());
  }
};
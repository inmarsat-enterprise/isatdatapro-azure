const uuid = require('uuid').v4;

const testMode = process.env.testMode;
const funcName = 'OtaCommand5Completion';

module.exports = async function(context, eventData) {
  if (!eventData.delivered) throw new Error(`${funcName} missing delivered`);
  if (!eventData.commandMeta) throw new Error(`${funcName} missing commandMeta`);
  const { delivered, commandMeta } = eventData;
  const { otaCommandId } = commandMeta;
  try {
    const event = {
      id: uuid(),
      dataVersion: '2.0',
      data: Object.assign({}, commandMeta),
      eventType: 'OtaCommandComplete',
      eventTime: delivered.deliveryTime,
    };
    delete event.data.command;
    if (delivered.success) {
      context.log.verbose(`Command ${otaCommandId} delivered`);
      event.subject = `Command delivered: ${otaCommandId}`;
      event.data.commandDeliveredTime = delivered.deliveryTime;
    } else {
      context.log.warn(`Command ${otaCommandId} failed`)
      event.subject = `Command failed: ${otaCommandId}`;
      event.data.commandFailedTime = delivered.deliveryTime;
    }
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
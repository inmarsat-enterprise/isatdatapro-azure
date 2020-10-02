const idp = require('isatdatapro-microservices');
const submitForwardMessage = idp.submitForwardMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');
const uuid = require('uuid').v4;

module.exports = async function (context, eventGridEvent) {
  context.log(`Function triggered by ${JSON.stringify(eventGridEvent)}`);
  try {
    const { mobileId, command } = eventGridEvent.data;
    const submitUuid = eventGridEvent.data.uuid ? eventGridEvent.data.uuid : null;
    //TODO: append a submitter UUID to the EventGrid published event
    function onNewForwardMessage(message) {
      const event = {
        id: uuid(),
        subject: `New forward message ${message.messageId} to ${message.mobileId}`,
        dataVersion: '2.0',
        eventType: 'NewForwardMessage',
        data: Object.assign({ submitUuid: submitUuid }, message),
        eventTime: new Date().toISOString()
      };
      console.log(`Publishing ${JSON.stringify(event)}`);
      context.bindings.outputEvent.push(event);
    }
    eventHandler.on('NewForwardMessage', onNewForwardMessage);
    eventHandler.on('ApiOutage', eventGrid.onApiOutage);
    eventHandler.on('ApiRecovery', eventGrid.onApiRecovery);
    const success = await submitForwardMessage(mobileId, command);
    context.log(`Success: ${success}`);
  } catch (e) {
    context.log.error(e);
  } finally {
    eventHandler.off('NewForwardMessage', onNewForwardMessage);
    eventHandler.off('ApiOutage', eventGrid.onApiOutage);
    eventHandler.off('ApiRecovery', eventGrid.onApiRecovery);
  }
};
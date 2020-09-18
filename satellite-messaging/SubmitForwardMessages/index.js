const idp = require('isatdatapro-microservices');
const submitForwardMessage = idp.submitForwardMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  context.log(`Function triggered by ${JSON.stringify(eventGridEvent)}`);
  try {
    const { mobileId, command } = eventGridEvent.data;
    eventHandler.on('NewForwardMessage', eventGrid.onNewForwardMessage);
    eventHandler.on('ApiOutage', eventGrid.onApiOutage);
    eventHandler.on('ApiRecovery', eventGrid.onApiRecovery);
    const success = await submitForwardMessage(mobileId, command);
    context.log(`Success: ${success}`);
  } catch (e) {
    context.log.error(e);
  } finally {
    eventHandler.off('NewForwardMessage', eventGrid.onNewForwardMessage);
    eventHandler.off('ApiOutage', eventGrid.onApiOutage);
    eventHandler.off('ApiRecovery', eventGrid.onApiRecovery);
  }
};
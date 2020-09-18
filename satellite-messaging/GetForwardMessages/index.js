const idp = require('isatdatapro-microservices');
const getForwardMessages = idp.getForwardMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  try {
    eventHandler.on('NewMobile', eventGrid.onNewMobile);
    eventHandler.on('ApiOutage', eventGrid.onApiOutage);
    eventHandler.on('ApiRecovery', eventGrid.onApiRecovery);
    const messageId = eventGridEvent.data.messageId;
    const mailboxId = eventGridEvent.data.mailboxId;
    await getForwardMessages(mailboxId, messageId);
  } catch (err) {
    context.log(err.message, err.stack);
  } finally {
    eventHandler.off('NewMobile', eventGrid.onNewMobile);
    eventHandler.off('ApiOutage', eventGrid.onApiOutage);
    eventHandler.off('ApiRecovery', eventGrid.onApiRecovery);
  }
};
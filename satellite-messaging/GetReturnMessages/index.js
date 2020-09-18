const idp = require('isatdatapro-microservices');
const getReturnMessages = idp.getReturnMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

module.exports = async function (context, timer) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  try {
    eventHandler.on('NewReturnMessage', eventGrid.onNewReturnMessage);
    eventHandler.on('NewMobile', eventGrid.onNewMobile);
    eventHandler.on('ApiOutage', eventGrid.onApiOutage);
    eventHandler.on('ApiRecovery', eventGrid.onApiRecovery);
    if (timer.IsPastDue) {
      context.log(`${thisFunction.name} timer past due!`);
    }
    context.log(`${thisFunction.name} timer triggered at ${callTime}`);
    await getReturnMessages();
  } catch (err) {
    context.log(err.message, err.stack);
  } finally {
    eventHandler.off('NewReturnMessage', eventGrid.onNewReturnMessage);
    eventHandler.off('NewMobile', eventGrid.onNewMobile);
    eventHandler.off('ApiOutage', eventGrid.onApiOutage);
    eventHandler.off('ApiRecovery', eventGrid.onApiRecovery);
  }
};
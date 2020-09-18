const idp = require('isatdatapro-microservices');
const getForwardStatuses = idp.getForwardStatuses;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

module.exports = async function (context, timer) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  try {
    eventHandler.on('ForwardMessageStateChange',
        eventGrid.onForwardMessageStateChange);
    eventHandler.on('OtherClientForwardSubmission',
        eventGrid.onOtherClientForwardSubmission);
    eventHandler.on('ApiOutage', eventGrid.onApiOutage);
    eventHandler.on('ApiRecovery', eventGrid.onApiRecovery);
    if (timer.IsPastDue) {
      context.log(`${thisFunction.name} timer past due!`);
    }
    context.log(`${thisFunction.name} timer triggered at ${callTime}`);
    await getForwardStatuses();
  } catch (err) {
    context.log(err.message, err.stack);
  } finally {
    eventHandler.off('ForwardMessageStateChange',
        eventGrid.onForwardMessageStateChange);
    eventHandler.off('OtherClientForwardSubmission',
        eventGrid.onOtherClientForwardSubmission);
    eventHandler.off('ApiOutage', eventGrid.onApiOutage);
    eventHandler.off('ApiRecovery', eventGrid.onApiRecovery);
  }
};
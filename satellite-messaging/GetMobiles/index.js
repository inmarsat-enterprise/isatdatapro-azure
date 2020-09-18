const idp = require('isatdatapro-microservices');
const getMobiles = idp.getMobiles;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  try {
    eventHandler.on('ApiOutage', eventGrid.onApiOutage);
    eventHandler.on('ApiRecovery', eventGrid.onApiRecovery);
    const mailboxId = eventGridEvent.data.mailboxId;
    if (timer.IsPastDue) {
      context.log(`${thisFunction.name} timer past due!`);
    }
    context.log(`${thisFunction.name} timer triggered at ${callTime}`);
    await getMobiles();
  } catch (err) {
    context.log(err.message, err.stack);
  } finally {
    eventHandler.off('ApiOutage', eventGrid.onApiOutage);
    eventHandler.off('ApiRecovery', eventGrid.onApiRecovery);
  }
};
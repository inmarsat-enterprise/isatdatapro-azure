const idp = require('isatdatapro-microservices');

module.exports = async function (context, eventGridEvent) {
  context.log(`${__filename} called with ${JSON.stringify(eventGridEvent)}`);
  try {
    await idp.updateSatelliteGateway(eventGridEvent.data);
  } catch (e) {
    context.log(e.stack);
  }
};
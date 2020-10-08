const idp = require('isatdatapro-microservices');

module.exports = async function (context, eventGridEvent) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  try {
    await idp.updateSatelliteGateway(eventGridEvent.data);
  } catch (e) {
    context.log(e.stack);
  }
};
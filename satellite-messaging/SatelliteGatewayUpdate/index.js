const idp = require('isatdatapro-microservices');
const { eventGrid, getFunctionName } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  const funcName = getFunctionName(__filename);
  context.log.verbose(`${funcName} called`
      + ` with ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType !== 'SatelliteGatewayUpdate') {
    throw new Error(`Triggered by wrong event ${eventGridEvent.eventType}`);
  }
  let satelliteGateway;
  let changes = false;
  try {
    const category = 'SatelliteGateway';
    const { name, url } = eventGridEvent.data;
    const filter = {
      include: {
        name: name,
      },
    };
    const exists = await idp.getEntity(category, filter);
    if (exists.length > 0) {
      satelliteGateway = exists[0];
      for (const propName in eventGridEvent.data) {
        if (satelliteGateway.hasOwnProperty(propName) &&
            satelliteGateway[propName] !== eventGridEvent.data[propName]) {
          changes = true;
        }
      }
    } else {
      changes = true;
    }
    if (changes) {
      await idp.updateSatelliteGateway(eventGridEvent.data);
      satelliteGateway = await idp.getEntity(category, filter)[0];
    } else {
      context.log.warn(`No changes to satellite gateways in database`);
    }
    const eventType = 'SatelliteGatewayQuery';
    const subject = `Satellite Gateway query for ${satelliteGateway.name}`;
    const data = satelliteGateway;
    const eventTime = (new Date()).toISOString();
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log(`${funcName} publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent = event;
  } catch (e) {
    context.log.error(e.stack);
  }
};
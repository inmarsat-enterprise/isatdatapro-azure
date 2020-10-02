// Orchestrator Client
const df = require('durable-functions');
const { clientGetStatusAll } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  context.log(`Received event: ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType === 'NewReturnMessage') {
    const client = df.getClient(context);
    const message = eventGridEvent.data;
    let instances = await clientGetStatusAll(context, client);
    for (let i=0; i < instances.length; i++) {
      //context.log(`${new Date().toISOString()}: ${JSON.stringify(instances[i])}`);
      if (instances[i].customStatus.state === 'awaitingResponse' &&
          instances[i].customStatus.mobileId === message.mobileId &&
          instances[i].customStatus.codecServiceId === message.codecServiceId &&
          instances[i].customStatus.codecMessageId === message.codecMessageId) {
        const eventData = message;
        await client.raiseEvent(instances[i].instanceId, 'ResponseReceived',
            eventData);
        break;
      }
    }
  }
};
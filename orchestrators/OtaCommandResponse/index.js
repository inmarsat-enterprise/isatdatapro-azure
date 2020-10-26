// Orchestrator Client
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  const funcName = getFunctionName(__filename);
  if (eventGridEvent.eventType === 'NewReturnMessage') {
    const client = df.getClient(context);
    const message = eventGridEvent.data;
    let instances = await clientGetStatusAll(context, client);
    for (let i=0; i < instances.length; i++) {
      if ((instances[i].customStatus.state === 'awaitingResponse' ||
          instances[i].customStatus.state === 'awaitingCompletion') &&
          instances[i].customStatus.mobileId === message.mobileId &&
          instances[i].customStatus.codecServiceId === message.codecServiceId &&
          instances[i].customStatus.codecMessageId === message.codecMessageId) {
        const eventData = message;
        context.log.verbose(`${funcName} raising event ResponseReceived with`
            + ` ${eventData}`);
        await client.raiseEvent(instances[i].instanceId, 'ResponseReceived',
            eventData);
        break;
      }
    }
  }
};
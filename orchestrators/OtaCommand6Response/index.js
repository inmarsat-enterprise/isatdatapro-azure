// Orchestrator Client
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  try {
    const funcName = getFunctionName(__filename);
    if (eventGridEvent.eventType === 'NewReturnMessage') {
      const client = df.getClient(context);
      const message = eventGridEvent.data;
      context.log.verbose(`Triggered by return message ${message.messageId}` +
          ` from ${message.mobileId}`);
      let instances = await clientGetStatusAll(context, client);
      for (let i=0; i < instances.length; i++) {
        const { instanceId, customStatus } = instances[i];
        if (!customStatus) {
          context.log.warn(`No customStatus for instance ${instanceId}`);
          continue;
        }
        if (customStatus.state === 'awaitingResponse' &&
            customStatus.mobileId === message.mobileId &&
            customStatus.codecServiceId === message.codecServiceId &&
            customStatus.codecMessageId === message.codecMessageId) {
          context.log.info(`${funcName} raising event ResponseReceived with` +
              ` ${message}`);
          await client.raiseEvent(instanceId, 'ResponseReceived', message);
          break;
        }
      }
    }
  } catch (e) {
    context.log.error(e.toString());
  }
};
// Orchestrator Client
/**
 * Listens for NewForwardMessage matching pending command's submitUuid
 * Passes the messageId to the orchestrator to match against state changes
 */
const df = require('durable-functions');
const { clientGetStatusAll } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  //context.log(`Received event: ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType === 'NewForwardMessage') {
    const client = df.getClient(context);
    const { submitUuid, messageId } = eventGridEvent.data;
    //: work around terminated instances bug by flushing history
    let instances = await clientGetStatusAll(context, client);
    for (let i=0; i < instances.length; i++) {
      if (instances[i].customStatus.submitUuid &&
          instances[i].customStatus.submitUuid === submitUuid) {
        const eventData = { messageId: messageId };
        await client.raiseEvent(instances[i].instanceId, 'CommandSending',
            eventData);
        break;
      }
    }
  }
};
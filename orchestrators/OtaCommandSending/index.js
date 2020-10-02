// Orchestrator Client
const df = require("durable-functions");

module.exports = async function (context, eventGridEvent) {
  context.log(`Received event: ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType === 'NewForwardMessage') {
    const client = df.getClient(context);
    const { submitUuid, messageId } = eventGridEvent.data;
    if (submitUuid) {
      //
    }
    //: work around terminated instances bug by flushing history
    let instances = await client.getStatusAll();
    if (typeof instances === 'string') {
      instances = instances.replace(/undefined/g, 'null');
      instances = JSON.parse(instances);
      instances.forEach(async (instance) => {
        await client.purgeInstanceHistory(instance.instanceId);
      });
    }
    for (let i=0; i < instances.length; i++) {
      context.log(`${new Date().toISOString()}: ${JSON.stringify(instances[i])}`);
      if (instances[i].customStatus.submitUuid && instances[i].customStatus.submitUuid === submiUuid) {
        const eventData = { messageId: messageId };
        await client.raiseEvent(instances[i].instanceId, 'CommandSending', eventData);
        break;
      }
    }
  }
};
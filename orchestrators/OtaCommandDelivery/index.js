// Orchestrator Client
const df = require("durable-functions");

module.exports = async function (context, eventGridEvent) {
  context.log(`Received event: ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType === 'ForwardMessageStateChange') {
    const client = df.getClient(context);
    const { messageId, newState } = eventGridEvent.data;
    if (newState === 'DELIVERED' || newState === 'FAILED') {
      //TODO detect failure
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
      if (instances[i].customStatus.messageId && instances[i].customStatus.messageId === messageId) {
        const eventData = {
          success: true,
          deliveryTime: eventGridEvent.eventTime,   //should be a state time in the original event
        };
        await client.raiseEvent(instances[i].instanceId, 'CommandDelivered', eventData);
        break;
      }
    }
  }
};
// Orchestrator Client
const df = require('durable-functions');
const { clientGetStatusAll } = require('../SharedCode');

const successStates = [
  'DELIVERED',
];
const failedStates = [
  'FAILED_DELIVERY',
  'TIMED_OUT',
];
const completedStates = successStates.concat(failedStates);

module.exports = async function (context, eventGridEvent) {
  //context.log(`Received event: ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType === 'ForwardMessageStateChange') {
    const client = df.getClient(context);
    const { messageId, newState } = eventGridEvent.data;
    if (completedStates.includes(newState)) {
      //: work around terminated instances bug by flushing history
      let instances = await clientGetStatusAll(context, client);
      for (let i=0; i < instances.length; i++) {
        if (instances[i].customStatus.messageId &&
            instances[i].customStatus.messageId === messageId) {
          const eventData = {
            success: successStates.includes(newState) ? true : false,
            deliveryTime: eventGridEvent.data.stateTimeUtc,
          };
          await client.raiseEvent(instances[i].instanceId, 'CommandDelivered',
              eventData);
          break;
        }
      }
    }
  }
};
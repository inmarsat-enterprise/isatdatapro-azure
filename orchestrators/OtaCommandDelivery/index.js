// Orchestrator Client
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

const successStates = [
  'DELIVERED',
];
const failedStates = [
  'ERROR',
  'FAILED_DELIVERY',
  'TIMED_OUT',
];
const completedStates = successStates.concat(failedStates);

module.exports = async function (context, eventGridEvent) {
  try {
    const funcName = getFunctionName(__filename);
    if (eventGridEvent.eventType === 'ForwardMessageStateChange') {
      const { messageId, newState, reason } = eventGridEvent.data;
      if (completedStates.includes(newState)) {
        context.log.verbose(`${funcName} received forward message ${messageId}`
            + ` with state ${newState}`);
        const client = df.getClient(context);
        //: work around terminated instances bug by flushing history
        let instances = await clientGetStatusAll(context, client);
        for (let i=0; i < instances.length; i++) {
          if (instances[i].customStatus.messageId &&
              instances[i].customStatus.messageId === messageId) {
            const eventData = {
              success: successStates.includes(newState) ? true : false,
              reason: reason,
              deliveryTime: eventGridEvent.data.stateTimeUtc,
            };
            context.log.verbose(`${funcName} raising event CommandDelivered with`
                + ` ${JSON.stringify(eventData)}`);
            await client.raiseEvent(instances[i].instanceId, 'CommandDelivered',
                eventData);
            break;
          }
        }
      }
    }
  } catch (e) {
    context.log.error(e.toString());
  }
};
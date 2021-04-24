// Orchestrator Client
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

const funcName = 'OtaCommandDelivery';

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
    //const funcName = getFunctionName(__filename);
    if (eventGridEvent.eventType === 'ForwardMessageStateChange') {
      const { messageId, newState, reason } = eventGridEvent.data;
      if (completedStates.includes(newState)) {
        context.log.verbose(`${funcName} received forward message ${messageId}`
            + ` with state ${newState}`);
        const client = df.getClient(context);
        //: work around terminated instances bug by flushing history
        let instances = await clientGetStatusAll(context, client);
        for (let i=0; i < instances.length; i++) {
          const { instanceId, customStatus } = instances[i];
          if (!customStatus) {
            context.log.warn(`No customStatus for instance ${instanceId}`);
            continue;
          }
          if (customStatus.messageId &&
              customStatus.messageId === messageId) {
            const eventData = {
              success: successStates.includes(newState) ? true : false,
              reason: reason,
              deliveryTime: eventGridEvent.data.stateTimeUtc,
              referenceNumber: eventGridEvent.data.referenceNumber,
            };
            context.log.verbose(`${funcName} raising event CommandDelivered` +
                ` with ${JSON.stringify(eventData)}`);
            await client.raiseEvent(instanceId, 'CommandDelivered', eventData);
            break;
          }
        }
      }
    }
  } catch (e) {
    context.log.error(e.toString());
  }
};
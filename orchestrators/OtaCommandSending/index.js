// Orchestrator Client
/**
 * Listens for NewForwardMessage matching pending command's submissionId
 * Passes the messageId to the orchestrator to match against state changes
 */
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

module.exports = async function (context, eventGridEvent) {
  const funcName = getFunctionName(__filename);
  if (eventGridEvent.eventType === 'NewForwardMessage') {
    const { submissionId, messageId } = eventGridEvent.data;
    context.log.verbose(`${funcName} received NewForwardMessage ${messageId}`);
    const client = df.getClient(context);
    //: work around terminated instances bug by flushing history
    let instances = await clientGetStatusAll(context, client);
    for (let i=0; i < instances.length; i++) {
      if (instances[i].customStatus.submissionId &&
          instances[i].customStatus.submissionId === submissionId) {
        const eventData = { messageId: messageId };
        context.log.verbose(`${funcName} raising CommandSending with`
            + ` ${JSON.stringify(eventData)}`);
        await client.raiseEvent(instances[i].instanceId, 'CommandSending',
            eventData);
        break;
      }
    }
  }
};
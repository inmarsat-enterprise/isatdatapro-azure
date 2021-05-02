// Orchestrator Client
/**
 * Listens for NewForwardMessage matching pending command's submissionId
 * Passes the messageId to the orchestrator to match against state changes
 */
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

const funcName = 'OtaCommand3Sending';

module.exports = async function (context, eventGridEvent) {
  try {
    //TODO: error/warning handling if triggered by wrong eventType
    //const funcName = getFunctionName(__filename);
    if (eventGridEvent.eventType === 'NewForwardMessage') {
      const { submissionId, messageId } = eventGridEvent.data;
      context.log.verbose(`${funcName} received NewForwardMessage` +
          ` ${messageId} at ${Date.now()}`);
      const client = df.getClient(context);
      //: work around terminated instances bug by flushing history
      let instances = await clientGetStatusAll(context, client);
      for (let i=0; i < instances.length; i++) {
        const { instanceId, customStatus } = instances[i];
        if (!customStatus) {
          context.log.warning(`No customStatus for instance ${instanceId}`);
          continue;
        }
        if (customStatus.submissionId &&
            customStatus.submissionId === submissionId) {
          const eventData = eventGridEvent.data;
          context.log.verbose(`${funcName} raising CommandSending with` +
              ` ${JSON.stringify(eventData)}`);
          await client.raiseEvent(instanceId, 'CommandSending', eventData);
          break;
        }
      }
    }
  } catch (e) {
    context.log.error(e.toString());
  }
};
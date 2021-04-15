// Orchestrator Client
/**
 * Listens for CommandRequest event to start orchestration
 */
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName, getCodecIds, instanceCleanup } = require('../SharedCode');

const testMode = process.env.testMode;

module.exports = async function (context, eventGridEvent) {
  try {
    const funcName = getFunctionName(__filename);
    let instanceId;
    if (eventGridEvent.eventType === 'OtaCommandRequest') {
      const data = eventGridEvent.data;
      context.log.verbose(`${funcName} received OtaCommandRequest:`
          + ` ${JSON.stringify(data)}`);
      const client = df.getClient(context);
      try {
        const { codecServiceId, codecMessageId } = getCodecIds(data);
        instanceId = `otaCommand-${data.mobileId}` +
            `-${codecServiceId}-${codecMessageId}` +
            `-${eventGridEvent.id}`;
        //: work around terminated instances bug by flushing history related to
        // https://github.com/Azure/azure-functions-durable-extension/issues/1193
        let instances = await clientGetStatusAll(context, client);
        if (testMode) {
          const cleanupStatuses = [
            df.OrchestrationRuntimeStatus.Terminated,
            df.OrchestrationRuntimeStatus.Completed,
            df.OrchestrationRuntimeStatus.Running,
            df.OrchestrationRuntimeStatus.Pending,
          ];
          await instanceCleanup(context, client, instances, cleanupStatuses);
          instances = await clientGetStatusAll(context, client);
        }
        context.log.verbose(`Found ${instances.length} orchestrator instances`);
        let running = false;
        let completed = false;
        const activeStatuses = [
          df.OrchestrationRuntimeStatus.Running,
          df.OrchestrationRuntimeStatus.Pending,
        ];
        for (let i=0; i < instances.length; i++) {
          if (instances[i].instanceId === instanceId) {
            if (activeStatuses.includes(instances[i].runtimeStatus)) {
              running = true;
            } else if (instances[i].runtimeStatus ===
                  df.OrchestrationRuntimeStatus.Completed) {
              completed = true;
            }
            break;
          }
        }
        if (!running && !completed) {
          context.log.info(`Starting orchestration with ID=${instanceId}`);
          await client.startNew('OtaCommandOrchestrator',
              instanceId, eventGridEvent);
        } else {
          context.log.warn(`Orchestrator ${instanceId} in progress ignoring event`);
        }
      } catch (e) {
        context.log.error(e.stack);
      } finally {
        const statusResponse = await client.createCheckStatusResponse(
            context.bindingData.data, instanceId);
        return statusResponse;
      }
    }
  } catch (e) {
    context.log.error(e.toString());
  }
};
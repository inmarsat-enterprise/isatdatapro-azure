// Orchestrator Client
/**
 * Listens for CommandRequest event to start orchestration
 */
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

const testMode = process.env.testMode;
const MAX_AGE_SECONDS = 3600;

/**
 * Derives the codecServiceId (SIN) and codecMessageId (MIN)
 * @private
 * @param {Object} data A command object
 * @returns {{ codecServiceId: number, codecMessageId: number }}
 */
function getCodecIds(data) {
  let codecServiceId;
  let codecMessageId;
  if (data.command.payloadJson) {
    codecServiceId = data.command.payloadJson.codecServiceId;
    codecMessageId = data.command.payloadJson.codecMessageId;
  } else if (data.command.payloadRaw) {
    codecServiceId = data.command.payloadRaw[0];
    codecMessageId = data.command.payloadRaw[1];
  } else if (data.command.modemCommand) {
    codecServiceId = data.command.modemCommand.codecServiceId;
    codecMessageId = data.command.modemCommand.codecMessageId;
  } else {
    throw new Error(`No payloadJson or payloadRaw or modemCommand`);
  }
  return { codecServiceId, codecMessageId };
}

/**
 * Terminates aged instances and clears terminated instances from the history
 * @param {Object} context The function context (for logging)
 * @param {Object} client The durable function client
 * @param {Array} instances A list of instance objects
 */
async function testCleanup(context, client, instances) {
  let terminated = 0;
  for (let i=0; i < instances.length; i++) {
    const { createdTime, runtimeStatus } = instances[i];
    const age = (new Date() - new Date(createdTime)) / 1000;
    if ((instances[i].instanceId.includes('-undefined-') ||
        instances[i].instanceId.includes('-null-') ||
        age > MAX_AGE_SECONDS) &&
        runtimeStatus !== 'Terminated') {
      await client.terminate(instances[i].instanceId);
      context.log.warn(`Terminated instance ${instances[i].instanceId}`);
      terminated++;
    } else if (runtimeStatus === 'Terminated') {
      terminated++;
    }
  }
  if (terminated > 0) {
    const createdFrom = new Date(0);
    const createdTo = new Date();
    const runtimeStatuses = [ df.OrchestrationRuntimeStatus.Terminated ];
    const { instancesDeleted } = await client.purgeInstanceHistoryBy(
        createdFrom, createdTo, runtimeStatuses);
    if (instancesDeleted > 0) {
      context.log.warn(`Purged ${JSON.stringify(purgeResult)} instances`);
    }
  }
}

module.exports = async function (context, eventGridEvent) {
  const funcName = getFunctionName(__filename);
  let instanceId;
  if (eventGridEvent.eventType === 'CommandRequest') {
    const data = eventGridEvent.data;
    context.log.verbose(`${funcName} received CommandRequest:`
        + ` ${JSON.stringify(data)}`);
    const client = df.getClient(context);
    try {
      const { codecServiceId, codecMessageId } = getCodecIds(data);
      // TODO: add commandVersion, avoid repeating same version even if terminated
      instanceId = `otaCommand-${data.mobileId}` 
          + `-${codecServiceId}-${codecMessageId}`;
      if (data.commandVersion) instanceId += `-${data.commandVersion}`;
      //: work around terminated instances bug by flushing history
      let instances = await clientGetStatusAll(context, client);
      let running = false;
      let completed = false;
      for (let i=0; i < instances.length; i++) {
        if (instances[i].instanceId === instanceId) {
          if (instances[i].runtimeStatus === 'Running' ||
              instances[i].runtimeStatus === 'Pending') {
            running = true;
          } else if (instances[i].runtimeStatus === 'Completed') {
            completed = true;
          }
          break;
        }
      }
      if (testMode) {
        await testCleanup(context, client, instances);
      }
      if (!running && !completed) {
        await client.startNew('OtaCommandOrchestrator',
            instanceId, eventGridEvent);
        context.log(`Started orchestration with ID=${instanceId}`);
      } else {
        context.log.warn(`Orchestrator ${instanceId} in progress`
            + ` - ignoring event`);
      }
    } catch (e) {
      context.log.error(e.stack);
    } finally {
      const statusResponse = await client.createCheckStatusResponse(
          context.bindingData.data, instanceId);
      return statusResponse;
    }
  }
};
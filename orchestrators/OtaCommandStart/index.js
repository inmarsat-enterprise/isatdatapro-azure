// Orchestrator Client
/**
 * Listens for CommandRequest event to start orchestration
 */
const df = require('durable-functions');
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

const testMode = process.env.testMode;
const MAX_AGE_SECONDS = 60;

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
    const { instanceId, createdTime, runtimeStatus } = instances[i];
    const age = (new Date() - new Date(createdTime)) / 1000;
    if ((instanceId.includes('-undefined-') ||
        instanceId.includes('-null-') ||
        age > MAX_AGE_SECONDS) &&
        runtimeStatus !== 'Terminated') {
      await client.terminate(instanceId, 'Test Mode');
      let newRuntimeStatus = runtimeStatus;
      while (newRuntimeStatus !== 'Terminated') {
        newRuntimeStatus = await client.getStatus(instanceId);
      }
      context.log.warn(`Terminated instance ${instanceId}`);
      terminated++;
    } else if (runtimeStatus === 'Terminated') {
      context.log.verbose(`Found terminated instance ${instanceId}`);
      terminated++;
    }
  }
  if (terminated > 0) {
    const createdFrom = new Date(0);
    const createdTo = new Date();
    const runtimeStatuses = [ df.OrchestrationRuntimeStatus.Terminated ];
    const purgeResult = await client.purgeInstanceHistoryBy(
        createdFrom, createdTo, runtimeStatuses);
    if (purgeResult.instancesDeleted > 0) {
      context.log.warn(`Purged orchestrator instance history` +
          ` ${JSON.stringify(purgeResult)}`);
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
      instanceId = `otaCommand-${data.mobileId}` +
          `-${codecServiceId}-${codecMessageId}`;
      if (data.commandVersion) instanceId += `-${data.commandVersion}`;
      //: work around terminated instances bug by flushing history
      let instances = await clientGetStatusAll(context, client);
      if (testMode) {
        await testCleanup(context, client, instances);
      }
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
};
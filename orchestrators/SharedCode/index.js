const df = require('durable-functions');

const doneStatuses = [
  df.OrchestrationRuntimeStatus.Terminated,
  df.OrchestrationRuntimeStatus.Completed,
];

/**
 * Works around a Microsoft SDK bug related to terminated instances
 * Purges instance history if instances is a string including 'undefined'
 * @param {Object} context Function app context (for logging)
 * @param {Object} client Durable functions orchestration client
 * @returns {Object[]} instances list
 */
async function clientGetStatusAll(context, client) {
  let instances = await client.getStatusAll();
  if (typeof instances === 'string') {
    context.log(`Terminated instance returned invalid status list`
        + ` - purging instance histories`);
    instances = instances.replace(/undefined/g, 'null');
    instances = JSON.parse(instances);
    instances.forEach(async (instance) => {
      await client.purgeInstanceHistory(instance.instanceId);
    });
  }
  return instances;
}

/**
 * Returns the name of the passed function
 * @param {string} path 
 * @returns {string} Name of the function
 */
function getFunctionName(path) {
  const fNameParts = path.split('/');
  return fNameParts[fNameParts.length - 2];
}

/**
 * Terminates an orchestrator instance
 * @param {Object} context 
 * @param {Object} client 
 * @param {string} instanceId 
 * @param {string} runtimeStatus 
 * @param {string} reason 
 * @returns {string} the status after termination
 */
async function terminateInstance(
    context,
    client,
    instanceId,
    runtimeStatus,
    reason) {
  if (!reason) { reason = 'Test Mode' }
  await client.terminate(instanceId, reason);
  let newRuntimeStatus = runtimeStatus;
  while (newRuntimeStatus !== 'Terminated') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const status = await client.getStatus(instanceId);
    newRuntimeStatus = status.runtimeStatus;
  }
  context.log.warn(`Terminated instance ${instanceId}`);
  return newRuntimeStatus;
}

/**
 * Terminates aged instances and clears terminated instances from the history
 * @param {Object} context The function context (for logging)
 * @param {Object} client The durable function client
 * @param {Array} instances A list of instance objects
 * @param {Array} cleanupStatuses A list of orchestrator statuses to purge
 * @param {Array} [agedStatuses] A list of statuses to check age of
 * @param {int} [maxAge] The maximum instance age in seconds
 */
async function instanceCleanup(
    context,
    client,
    instances,
    cleanupStatuses,
    agedStatuses,
    maxAge) {
  let cleanupCount = 0;
  for (let i=0; i < instances.length; i++) {
    let { instanceId, createdTime, runtimeStatus } = instances[i];
    if (instanceId.includes('-undefined-') || instanceId.includes('-null-')) {
      runtimeStatus = await terminateInstance(context, client, instanceId,
          runtimeStatus, 'Invalid');
    } else if (agedStatuses instanceof Array &&
          agedStatuses.includes(runtimeStatus)) {
      const age = (new Date() - new Date(createdTime)) / 1000;
      if (!(maxAge instanceof Number)) { maxAge = 86400 }
      if (age > maxAge) {
        runtimeStatus = await terminateInstance(context, client, instanceId,
            runtimeStatus, 'Aged');
      }
    }
    if (cleanupStatuses.includes(runtimeStatus) &&
        !doneStatuses.includes(runtimeStatus)) {
      runtimeStatus = await terminateInstance(context, client, instanceId,
          runtimeStatus);
    } else {
      context.log.verbose(`Found ${runtimeStatus} instance ${instanceId}`);
    }
    cleanupCount++;
  }
  if (cleanupCount > 0) {
    const createdFrom = new Date(0);
    const createdTo = new Date();
    const purgeResult = await client.purgeInstanceHistoryBy(
        createdFrom, createdTo, cleanupStatuses);
    if (purgeResult.instancesDeleted > 0) {
      context.log.warn(`Purged orchestrator instance history` +
          ` ${JSON.stringify(purgeResult)}`);
    }
  }
}

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

module.exports = {
  clientGetStatusAll,
  getFunctionName,
  getCodecIds,
  instanceCleanup,
};
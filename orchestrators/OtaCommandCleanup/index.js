const df = require("durable-functions");
const { clientGetStatusAll, getFunctionName } = require('../SharedCode');

const INSTANCE_MAX_AGE_SECONDS = process.env.INSTANCE_MAX_AGE_SECONDS;
const agedStatuses = [
  'Running',
  'Pending',
];

module.exports = async function (context, otaCleanupTimer) {
  const funcName = getFunctionName(__filename);  
  const client = df.getClient(context);
    let instances = await clientGetStatusAll(context, client);
    for (let i=0; i < instances.length; i++) {
      const { instanceId, createdTime, lastUpdatedTime, runtimeStatus } = instances[i];
      const age = (new Date() - new Date(createdTime)) / 1000;
      const refreshed = (new Date() - new Date(lastUpdatedTime)) / 1000;
      if (age > INSTANCE_MAX_AGE_SECONDS && agedStatuses.includes(runtimeStatus)) {
        context.log.warn(`${funcName} terminating aged instance ${instanceId}`);
        await client.terminate(instanceId);
      }
    }
    const createdTimeFrom = new Date(0);
    const createdTimeTo = new Date().setDate(today.getDate() - 30);
    const runtimeStatuses = [
      df.OrchestrationRuntimeStatus.Terminated,
    ];
    return client.purgeInstanceHistoryBy(
        createdTimeFrom, createdTimeTo, runtimeStatuses);
};
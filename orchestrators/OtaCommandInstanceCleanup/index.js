const df = require("durable-functions");
const { clientGetStatusAll, getFunctionName, instanceCleanup } = require('../SharedCode');

const funcName = 'OtaCommandInstanceCleanup';
const INSTANCE_MAX_AGE_SECONDS = process.env.INSTANCE_MAX_AGE_SECONDS;
const agedStatuses = [
  df.OrchestrationRuntimeStatus.Running,
  df.OrchestrationRuntimeStatus.Pending,
];
const cleanupStatuses = [
  df.OrchestrationRuntimeStatus.Terminated,
];

module.exports = async function (context, otaCleanupTimer) {
  try {
    // const funcName = getFunctionName(__filename);
    context.log.verbose(`${funcName} executing`);
    const client = df.getClient(context);
      let instances = await clientGetStatusAll(context, client);
      await instanceCleanup(context, client, instances, cleanupStatuses,
          agedStatuses, INSTANCE_MAX_AGE_SECONDS);
      // for (let i=0; i < instances.length; i++) {
      //   const { instanceId, createdTime, lastUpdatedTime, runtimeStatus } = instances[i];
      //   const age = (new Date() - new Date(createdTime)) / 1000;
      //   // const refreshed = (new Date() - new Date(lastUpdatedTime)) / 1000;
      //   if (age > INSTANCE_MAX_AGE_SECONDS && agedStatuses.includes(runtimeStatus)) {
      //     context.log.warn(`${funcName} terminating aged instance ${instanceId}`);
      //     await client.terminate(instanceId);
      //   }
      // }
      // const createdTimeFrom = new Date(0);
      // const createdTimeTo = new Date().setDate(today.getDate() - 30);
      // return client.purgeInstanceHistoryBy(
      //     createdTimeFrom, createdTimeTo, cleanupStatuses);
  } catch (e) {
    context.log.error(e.toString());
  }
};
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

function getFunctionName(path) {
  const fNameParts = path.split('/');
  return fNameParts[fNameParts.length - 2];
}

module.exports = {
  clientGetStatusAll,
  getFunctionName,
};
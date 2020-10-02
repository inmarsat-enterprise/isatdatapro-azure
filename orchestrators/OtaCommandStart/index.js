// Orchestrator Client
const df = require("durable-functions");

const eventsHandled = [
  'CommandRequest',
  'NewForwardMessage',
  'ForwardMessageStateChange',
  'NewReturnMessage',
];

function getCodecIds(data) {
  let codecServiceId;
  let codecMessageId;
  if (data.command.payloadJson) {
    codecServiceId = data.command.payloadJson.codecServiceId;
    codecMessageId = data.command.payloadJson.codecMessageId;
  } else {
    if (!data.command.payloadRaw) throw new Error(`No payloadJson or payloadRaw`);
    codecServiceId = data.command.payloadRaw[0];
    codecMessageId = data.command.payloadRaw[1];
  }
  return { codecServiceId, codecMessageId };
}

module.exports = async function (context, eventGridEvent) {
  context.log(`Received event: ${JSON.stringify(eventGridEvent)}`);
  let instanceId;
  if (eventsHandled.includes(eventGridEvent.eventType)) {
    const client = df.getClient(context);
    if (eventGridEvent.eventType === 'CommandRequest') {
      const data = eventGridEvent.data;
      const { codecServiceId, codecMessageId } = getCodecIds(data);
      instanceId = `otaCommand-${data.mobileId}` 
          + `-${codecServiceId}-${codecMessageId}`;
      //: work around terminated instances bug by flushing history
      let instances = await client.getStatusAll();
      if (typeof instances === 'string') {
        instances = instances.replace(/undefined/g, 'null');
        instances = JSON.parse(instances);
        instances.forEach(async (instance) => {
          await client.purgeInstanceHistory(instance.instanceId);
        });
      }
      let running = false;
      for (let i=0; i < instances.length; i++) {
        context.log(`${new Date().toISOString()}: ${JSON.stringify(instances[i])}`);
        if (instances[i].instanceId === instanceId) {
          if (instances[i].runtimeStatus === 'Running') {
            running = true;
          }
          break;
        }
      }
      if (!running) {
        await client.startNew('OtaCommandOrchestrator',
            instanceId, eventGridEvent);
        context.log(`Started orchestration with ID=${instanceId}`);
      } else {
        context.log(`Orchestrator ${instanceId} in progress`
            + ` - ignoring event`);
      }
      /*
      let durableOrchestrationStatus = await client.getStatus(instanceId);
      if (durableOrchestrationStatus === '' ||
          durableOrchestrationStatus.runtimeStatus === 'Completed') {
        await client.startNew('OtaCommandOrchestrator', instanceId, eventGridEvent);
        context.log(`Started orchestration with ID = '${instanceId}'.`);
      } else {
        await client.terminate(instanceId);
        context.log(`Already processing ${instanceId}`
            + ` (${durableOrchestrationStatus})`);
      }
      */
    }
    //const instanceId = await client.startNew('OtaCommandOrchestrator', undefined, eventGridEvent.data);


    const statusResponse = client.createCheckStatusResponse(context.bindingData.data, instanceId);
    return statusResponse;
    //return client.createCheckStatusResponse(context.bindingData.data, instanceId);
  }
};
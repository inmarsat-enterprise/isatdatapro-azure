// Orchestrator Client
/**
 * Listens for CommandRequest event to start orchestration
 */
const df = require('durable-functions');
const { clientGetStatusAll } = require('../SharedCode');

const testMode = process.env.testMode;

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
  if (eventGridEvent.eventType === 'CommandRequest') {
    const client = df.getClient(context);
    const data = eventGridEvent.data;
    const { codecServiceId, codecMessageId } = getCodecIds(data);
    instanceId = `otaCommand-${data.mobileId}` 
        + `-${codecServiceId}-${codecMessageId}`;
    //: work around terminated instances bug by flushing history
    let instances = await clientGetStatusAll(context, client);
    let running = false;
    for (let i=0; i < instances.length; i++) {
      if (instances[i].instanceId === instanceId) {
        if (instances[i].runtimeStatus === 'Running') {
          if (testMode) {
            client.terminate(instances[i].instanceId);
          } else {
            running = true;
          }
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
   const statusResponse =
      client.createCheckStatusResponse(context.bindingData.data, instanceId);
   return statusResponse;
  }
};
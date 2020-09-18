/*
Expects IOTC_DEVICE_BRIDGE to be a device bridge running as a function app
using an HTTP listener that forwards data to an IOT Central application
using the IDP Mobile ID prefixed by "idp-" as the IOTC device ID.

Triggered by an Event Grid Subscription filtered on Event Type NewReturnMessage
*/

const parsers = require('../lib');

module.exports = async function (context, eventGridEvent) {
  context.log.info(eventGridEvent);
  const returnMessage = eventGridEvent.data;
  let parsed;
  let parsedCount = 0;
  for (const parser in parsers) {
    parsed = false;
    if (parser === 'iotc') {
      try {
        parsed = await parsers[parser].parse(context, returnMessage);
      } catch (e) {
        context.log.error(e);
      }
    } 
    if (parsed) {
      parsedCount += 1;
      context.log.info(`${parser} Parsed message ${returnMessage.messageId}`);
      // uncomment below for unique parsing
      //break;
    }
  }
  if (parsedCount === 0) {
    context.log.info(`No parsing defined for codecServiceId (SIN) `
                + `${returnMessage.codecServiceId}`);
  }
};
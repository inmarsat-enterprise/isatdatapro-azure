'use strict';

function parse(context, message) {
  if (!message.payloadRaw) {
    context.log.error(`Cannot parse binary with no raw payload`);
    return false;
  }
  //TODO: convert array to Buffer
  const payload = Buffer.from(message.payloadRaw);
  const parsedPayload = {
    codecServiceId: Number(payload[0]),
    codecMessageId: Number(payload[1]),
    // Parsing of other fields based on bit manipulation
  };
  context.log(`Parsed: ${JSON.stringify(parsedPayload)}`);
  return true;
}

module.exports = parse;
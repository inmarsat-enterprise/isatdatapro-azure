const parser = require('isatdatapro-microservices').messageCodecs;

const codecServiceIds = [0, 255];

function parse(context, message) {
  let parsedMessage;
  if (message.codecServiceId === 0) {
    parsedMessage = parser.coreModem.parse(message);
  } else {
    parsedMessage = parser.commonMessageFormat.parse(message);
  }
  context.log(`Parsed return message ${message.messageId}: `
      + `${JSON.stringify(parsedMessage, null, 2)}`);
  return true;
}

module.exports = {
  codecServiceIds,
  parse,
};
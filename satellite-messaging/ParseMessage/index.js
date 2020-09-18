const parsers = require('../SharedCode/messageParsers');

module.exports = async function (context, eventGridEvent) {
  context.log(typeof eventGridEvent);
  context.log(eventGridEvent);
  //TODO: validate NewReturnMessage event
  const returnMessage = eventGridEvent.data;
  let parsed = false;
  for (const parser in parsers) {
    try {
      if (parsers[parser].codecServiceIds.includes(returnMessage.codecServiceId)) {
        context.log.verbose(`Attempting to parse with ${parser}`);
        parsed = parsers[parser].parse(context, returnMessage);
      }
    } catch (e) {
      context.log.error(e);
    }
    // if (parsed) break;
  }
  if (!parsed) {
    context.log(`No parsing defined for codecServiceId (SIN) ${returnMessage.codecServiceId}`)
  }
};
//Triggered by OtaCommandOrchestrator
const uuid = require('uuid').v4;

const testMode = process.env.testMode;

/**
 * Returns a forward message submission-compatible object
 * @private
 * @param {Object} data A CommandRequest
 * @returns {Object} a ForwardSubmission compatible entity
 */
function buildSubmission(data) {
  if (!data.mobileId) throw new Error(`No mobile ID provided`);
  if (!data.command) throw new Error(`No command provided`);
  const { mobileId, command } = data;
  const submission = {
    mobileId: mobileId,
  };
  if (command.payloadJson) {
    submission.payloadJson = command.payloadJson;
  } else if (command.payloadRaw) {
    submission.payloadRaw = command.payloadRaw;
  } else if (command.modemCommand) {
    submission.modemCommand = command.modemCommand;
  } else {
    throw new Error(`Invalid message content ${JSON.stringify(command)}`);
  }
  return submission;
}

module.exports = async function (context, data) {
  //context.log(`${JSON.stringify(data)}`);
  const submitUuid = testMode ? 1 : uuid();
  const event = {
    id: uuid(),
    subject: `Submit forward message ${submitUuid} to ${data.mobileId}`,
    dataVersion: '2.0',
    eventType: 'NewForwardSubmission',
    data: Object.assign({ submitUuid: submitUuid }, buildSubmission(data)),
    eventTime: new Date().toISOString()
  };
  context.log(`Publishing ${JSON.stringify(event)}`);
  context.bindings.outputEvent = event;
  return submitUuid;
};
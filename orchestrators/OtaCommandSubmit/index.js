//Triggered by OtaCommandOrchestrator
const uuid = require('uuid').v4;

function buildSubmission(data) {
  if (!data.mobileId) throw new Error(`No mobile ID provided`);
  const submission = {
    mobileId: data.mobileId,
  };
  if (data.payloadJson) {
    submission.payloadJson = data.payloadJson;
  } else if (data.payloadRaw) {
    submission.payloadRaw = data.payloadRaw;
  } else if (data.modemCommand) {
    submission.modemCommand = data.modemCommand;
  } else {
    throw new Error(`Invalid message content ${JSON.stringify(data)}`);
  }
  return submission;
}

module.exports = async function (context, data) {
  context.log(`${JSON.stringify(data)}`);
  const submitUuid = uuid();
  const event = {
    id: uuid(),
    subject: `Submit forward message ${submitUuid} to ${data.mobileId}`,
    dataVersion: '2.0',
    eventType: 'NewForwardMessageSubmission',
    data: Object.assign({ submitUuid: submitUuid }, buildSubmission(data)),
    eventTime: new Date().toISOString()
  };
  context.log(`Publishing ${JSON.stringify(event)}`);
  context.bindings.outputEvent.push(event);
  return submitUuid;
};
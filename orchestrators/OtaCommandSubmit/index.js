//Triggered by OtaCommandOrchestrator
const uuid = require('uuid').v4;
//const { getFunctionName } = require('../SharedCode');

const testMode = process.env.testMode;
const funcName = 'OtaCommandSubmit';

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
  if (command.payloadJson || command.payloadRaw || command.modemCommand) {
    submission.message = command;
  } else {
    throw new Error(`Invalid message content ${JSON.stringify(command)}`);
  }
  return submission;
}

module.exports = async function (context, data) {
  try {
    //const funcName = getFunctionName(__filename);
    const submissionId = data.otaCommandId;
    const event = {
      id: uuid(),
      subject: `Submit forward message ${submissionId} to ${data.mobileId}`,
      dataVersion: '2.0',
      eventType: 'NewForwardSubmission',
      data: Object.assign({ submissionId: submissionId }, buildSubmission(data)),
      eventTime: new Date().toISOString()
    };
    context.log.verbose(`${funcName} publishing ${JSON.stringify(event)}`);
    if (!testMode) {
      context.bindings.outputEvent = event;
    }
    return submissionId;
  } catch (e) {
    context.log.error(e.toString());
  }
};
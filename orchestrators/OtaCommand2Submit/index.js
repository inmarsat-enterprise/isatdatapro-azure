//Orchestrator Client triggered by OtaCommandOrchestrator
const uuid = require('uuid').v4;
//const { getFunctionName } = require('../SharedCode');

const testMode = (process.env.testMode === 'true');
const funcName = 'OtaCommand2Submit';

module.exports = async function (context, commandMeta) {
  try {
    //const funcName = getFunctionName(__filename);
    if (!commandMeta.otaCommandId) throw new Error('Missing otaCommandId');
    if (!commandMeta.mobileId) throw new Error('Missing mobileId');
    const { otaCommandId, mobileId } = commandMeta;
    const eventGridData = Object.assign({ submissionId: otaCommandId },
        buildSubmission(commandMeta));
    const event = {
      id: uuid(),
      subject: `Submit forward message ${otaCommandId} to ${mobileId}`,
      dataVersion: '2.0',
      eventType: 'NewForwardSubmission',
      data: eventGridData,
      eventTime: new Date().toISOString()
    };
    if (!testMode) {
      context.log.verbose(`${funcName} publishing ${JSON.stringify(event)}`);
      context.bindings.outputEvent = event;
    } else {
      context.log.warn(`${funcName} testMode not publishing` +
          ` ${JSON.stringify(event)}`);
    }
    return { eventType: event.eventType, id: event.id };
  } catch (e) {
    context.log.error(e.toString());
  }
};

/**
 * Returns a forward message submission-compatible object
 * @private
 * @param {Object} commandMeta A CommandRequest
 * @returns {Object} a ForwardSubmission compatible entity
 */
 function buildSubmission(commandMeta) {
  if (!commandMeta.mobileId) throw new Error(`No mobile ID provided`);
  if (!commandMeta.command) throw new Error(`No command provided`);
  const { mobileId, command } = commandMeta;
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
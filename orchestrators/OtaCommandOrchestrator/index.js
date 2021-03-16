// Durable function orchestrator
/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by a starter function and progressed by client functions.
 */

const df = require('durable-functions');
const uuid = require('uuid').v4;
const { getFunctionName } = require('../SharedCode');

module.exports = df.orchestrator(function* (context) {
  const funcName = getFunctionName(__filename);
  let outputs = [];
  const input = context.df.getInput();
  if (input && input.data) {
    context.log.verbose(`${funcName} orchestrating command:`
        + ` ${JSON.stringify(input.data)}`);
    const mobileId = input.data.mobileId;
    const commandMeta = input.subject;
    context.df.setCustomStatus({
      state: 'submitting',
      mobileId: mobileId,
    });
    
    // Submit command as OTA message
    const submissionId =
        yield context.df.callActivity("OtaCommandSubmit", input.data);
    context.df.setCustomStatus({
      state: 'submitted',
      mobileId: mobileId,
      submissionId: submissionId,
    });
    context.log.verbose(`${funcName} waiting for NewForwardMessage with`
        + ` submissionId: ${submissionId}`);
    const { messageId } =
        yield context.df.waitForExternalEvent('CommandSending');
    context.df.setCustomStatus({
      state: 'sending',
      mobileId: mobileId,
      messageId: messageId,
    });
    outputs.push({ commandMessageId: messageId });
    
    // ForwardMessageStateChange captured by OtaCommandDelivery function
    context.log.verbose(`${funcName} sent messageId: ${messageId} awaiting`
        + ` CommandDelivered`);
    const delivered =
        yield context.df.waitForExternalEvent('CommandDelivered');
    context.df.setCustomStatus({
      state: delivered.success ? 'delivered' : 'failed',
      mobileId: mobileId,
      deliveryTime: delivered.deliveryTime,
    });
    let completionEvent = {
      id: uuid(),
      dataVersion: '2.0',
      data: Object.assign({}, input.data),
    };
    if (delivered.success) {
      context.log.verbose(`${funcName} successfully delivered command`);
      completionEvent.subject = `Command delivered: ${commandMeta}`;
      completionEvent.eventType = 'OtaCommandComplete';
      completionEvent.data.commandDeliveredTime = delivered.deliveryTime;
      completionEvent.eventTime = delivered.deliveryTime;
      outputs.push({ commandReceiveTime: delivered.deliveryTime });
    } else {
      completionEvent.subject = `Command failed: ${commandMeta}`;
      completionEvent.eventType = 'OtaCommandComplete';
      completionEvent.data.commandFailedTime = delivered.deliveryTime;
      completionEvent.eventTime = delivered.deliveryTime;
      outputs.push({ commandFailedTime: delivered.deliveryTime });
    }
    context.log(`${funcName} publishing ${JSON.stringify(completionEvent)}` +
        ` for Device Bridge`);
    context.bindings.outputEvent = completionEvent;
    outputs.push({ completionEventPublished: completionEvent.id });
  }
  if (input.data.completion && 'codecServiceId' in input.data.completion) {
    context.log.warn('Response event untested...');
    // Wait for event NewReturnMessage with expectedResponse identifier(s)
    // TODO: may need an explicit timeout for this?
    const { codecServiceId, codecMessageId } = input.data.completion;
    context.df.setCustomStatus({
      state: 'awaitingResponse',
      mobileId: mobileId,
      codecServiceId: codecServiceId,
      codecMessageId: codecMessageId,
    });
    // NewReturnMessage captured/filtered by OtaResponseReceived
    context.log.verbose(`${funcName} awaiting ResponseReceived`
        + `(codecServiceId:${codecServiceId}`
        + ` | codecMessageId:${codecMessageId})`);
    const response =
        yield context.df.waitForExternalEvent('ResponseReceived');
    responseEvent = {
      id: uuid(),
      dataVersion: '2.0',
      subject: `Command response to ${commandMeta}`,
      eventType: 'OtaCommandResponse',
      data: Object.assign({}, response),
      eventTime: response.receiveTimeUtc,
    }
    context.log(`${funcName} publishing ${JSON.stringify(responseEvent)}` +
        ` for Device Bridge`);
    context.bindings.outputEvent = responseEvent;
    outputs.push({ responseEventPublished: responseEvent.id });
  }
  context.log.verbose(`${funcName} outputs: ${JSON.stringify(outputs)}`);
  return outputs;
});
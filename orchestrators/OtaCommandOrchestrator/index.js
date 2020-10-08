// Durable function orchestrator
/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by a starter function and progressed by client functions.
 */

const df = require('durable-functions');
const uuid = require('uuid').v4;

module.exports = df.orchestrator(function* (context) {
  let outputs = [];
  const input = context.df.getInput();
  if (input && input.data) {
    context.log.verbose(`Orchestrating command: ${JSON.stringify(input)}`);
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
    const { messageId } =
        yield context.df.waitForExternalEvent('CommandSending');
    context.df.setCustomStatus({
      state: 'sending',
      mobileId: mobileId,
      messageId: messageId,
    });
    outputs.push({ commandMessageId: messageId });
    // ForwardMessageStateChange captured by OtaCommandDelivery function
    const delivered =
        yield context.df.waitForExternalEvent('CommandDelivered');
    context.df.setCustomStatus({
      state: delivered.success ? 'delivered' : 'failed',
      mobileId: mobileId,
      deliveryTime: delivered.deliveryTime,
    });
    if (delivered.success) {
      outputs.push({ commandReceiveTime: delivered.deliveryTime });
      if (input.data.completion) {
        // Wait for event NewReturnMessage with expectedResponse identifier(s)
        // TODO: may need an explicit timeout for this?
        context.df.setCustomStatus({
          state: 'awaitingCompletion',
          mobileId: mobileId,
          codecServiceId: input.data.completion.codecServiceId,
          codecMessageId: input.data.completion.codecMessageId,
        });
        // NewReturnMessage captured/filtered by OtaResponseReceived
        const response =
            yield context.df.waitForExternalEvent('ResponseReceived');
        const responseEvent = {
          id: uuid(),
          subject: `Command response to ${commandMeta}`,
          dataVersion: '2.0',
          eventType: 'OtaCommandResponse',
          data: Object.assign(response, { completion: input.data.completion }),
          eventTime: response.receiveTimeUtc
        };
        context.bindings.outputEvent = responseEvent;
        outputs.push({ responsePublished: responseEvent });
      }
    } else {
      outputs.push({ commandFailedTime: delivered.deliveryTime });
    }
  }
  return outputs;
});
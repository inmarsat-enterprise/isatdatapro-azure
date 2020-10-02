/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an HTTP starter function.
 * 
 * Before running this sample, please:
 * - create a Durable activity function (default name is "Hello")
 * - create a Durable HTTP starter function
 * - run 'npm install durable-functions' from the wwwroot folder of your 
 *    function app in Kudu
 */

const df = require("durable-functions");

module.exports = df.orchestrator(function* (context) {
  let outputs = [];
  const input = context.df.getInput();
  if (input && input.data) {
    console.log.verbose(`Orchestrating command: ${JSON.stringify(input)}`);
    const mobileId = input.data.mobileId;
    context.df.setCustomStatus({
      state: 'submitting',
      mobileId: mobileId,
    });
    // Submit command as OTA message
    const submitUuid = yield context.df.callActivity("OtaCommandSubmit", input.data);
    context.df.setCustomStatus({
      state: 'submitted',
      mobileId: mobileId,
      submitUuid: submitUuid,
    });
    const { messageId } = yield context.df.waitForExternalEvent('CommandSending');
    context.df.setCustomStatus({
      state: 'sending',
      mobileId: mobileId,
      messageId: messageId,
    });
    outputs.push({ commandMessageId: messageId });
    // ForwardMessageStateChange captured by OtaCommandDelivery function
    const { deliveryTime } = yield context.df.waitForExternalEvent('CommandDelivered');
    context.df.setCustomStatus({
      state: 'delivered',
      mobileId: mobileId,
      deliveryTime: deliveryTime,
    });
    outputs.push({ commandReceiveTime: delivered });
    // Wait for event NewReturnMessage with expectedResponse identifier(s)
    // TODO: may need an explicit timeout for this?
    if (input.data.response) {
      let responseCodecServiceId;
      let responseCodecMessageId;
      if (input.data.response.payloadJson) {
        responseCodecServiceId = input.data.response.payloadJson.codecServiceId;
        responseCodecMessageId = input.data.response.payloadJson.codecMessageId;
      } else if (input.data.response.payloadRaw) {
        responseCodecServiceId = input.data.response.payloadRaw[0];
        responseCodecMessageId = input.data.response.payloadRaw[1];
      }
      context.df.setCustomStatus({
        state: 'awaitingResponse',
        mobileId: mobileId,
        codecServiceId: responseCodecServiceId,
        codecMessageId = responseCodecMessageId,
      });
      // ForwardMessageStateChange captured by OtaResponseReceived function
      const response = yield context.df.waitForExternalEvent('ResponseReceived');
      outputs.push({ response: response });
      // TODO: derive/publish EventGrid event
      // outputs.push({ publishedTo: '' });
    }
  }
  return outputs;
});
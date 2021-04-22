// Durable function orchestrator
/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by a starter function and progressed by client functions.
 */

const df = require('durable-functions');
const moment = require('moment');
// const uuid = require('uuid').v4;
//const { getFunctionName } = require('../SharedCode');

const testMode = process.env.testMode;
const timeout = parseInt(process.env.commandTimeout) || 4500;
const funcName = 'OtaCommandOrchestrator';
const activitySubmit = 'OtaCommand2Submit';
const activitySending = 'OtaCommand3Sending';
const activityDelivery = 'OtaCommand4Delivery';
const activityCompletionEvent = 'OtaCommand5CompletionEvent';
const activityResponse = 'OtaCommand6Response';
const activityResponseEvent = 'OtaCommand7ResponseEvent';
const responseFeatureEnabled = false;

module.exports = df.orchestrator(function* (context) {
  let outputs = [];
  try {
    //const funcName = getFunctionName(__filename);
    const input = context.df.getInput();
    if (!input || !input.data) throw new Error('Missing input data');
    if (!input.id) throw new Error('Missing input.id');
    // Timeout setup
    const expiration =
        moment.utc(context.df.currentUtcDateTime).add(timeout, "s");
    const timeoutTask = context.df.createTimer(expiration.toDate());
    let winner;  // for timeout management
    const mobileId = input.data.mobileId;
    // const commandMeta = input.subject;
    const otaCommandId = input.id;
    input.data.otaCommandId = otaCommandId;
    if (!context.df.isReplaying) {
      context.log.verbose(`${funcName} orchestrating command:` +
          ` ${JSON.stringify(input.data)}`);
    }
    
    // 1. Submit command as OTA message
    // const submissionId =
    //     yield context.df.callActivity(activitySubmit, input.data);
    const submitTask = context.df.callActivity(activitySubmit, input.data);
    winner = yield context.df.Task.any([submitTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activitySubmit, outputs);
    }
    const { eventType: submitEvent, id: submissionId } = submitTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`${activitySubmit} submitted ${submitEvent}`);
      context.log.verbose(`${activitySending} awaiting NewForwardMessage` +
          ` with submissionId ${submissionId}`);
      context.df.setCustomStatus({
        state: 'submitted',
        mobileId: mobileId,
        submissionId: submissionId,
      });
    }

    // 2. Submission generates a NewForwardMessage with unique ID
    // const { messageId } =
    //     yield context.df.waitForExternalEvent('CommandSending');
    const sendingTask = context.df.waitForExternalEvent('CommandSending');
    winner = yield context.df.Task.any([sendingTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activitySending, outputs);
    }
    const { messageId } = sendingTask.result;
    outputs.push({ commandMessageId: messageId });
    if (!context.df.isReplaying) {
      context.log.verbose(`${activitySending} sent messageId ${messageId}` +
          ` ${activityDelivery} awaiting ForwardMessageStateChange`);
      context.df.setCustomStatus({
        state: 'sending',
        mobileId: mobileId,
        messageId: messageId,
      });
    }
    
    // 3. ForwardMessageStateChange/completion captured by OtaCommandDelivery
    // const delivered =
    //     yield context.df.waitForExternalEvent('CommandDelivered');
    const deliveryTask = context.df.waitForExternalEvent('CommandDelivered');
    winner = yield context.df.Task.any([deliveryTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activityDelivery, outputs);
    }
    const { delivered } = deliveryTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`${funcName} received CommandDelivered` +
          ` with ${JSON.stringify(delivered)}`);
      context.df.setCustomStatus({
        state: delivered.success ? 'delivered' : 'notDelivered',
        reason: delivered.reason,
        mobileId: mobileId,
        messageId: messageId,
      });
    }
    outputs.push({
      commandDelivered: delivered.success,
      commandDeliveryTime: delivered.deliveryTime,
      reason: delivered.reason,
    });

    const completionMeta = {
      delivered: delivered,
      commandMeta: input.data,
    };
    // const completionEventId =
    //     yield context.df.callActivity(activityCompletionEvent, completionMeta);
    const completionEventTask =
        context.df.callActivity(activityCompletionEvent, completionMeta);
    winner = yield context.df.Task.any([completionEventTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activityCompletionEvent, outputs);
    }
    const { id: completionEventId } = completionEventTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`Published event ${completionEventId} to EventGrid`);
    }
    outputs.push({ completionEventId: completionEventId });
  
    // 4. TODO: future feature for response to commands
    // TODO: add grace time for response?
    if (responseFeatureEnabled &&
        delivered.success &&
        input.data.completion.response) {
      const { resCodecServiceId, resCodecMessageId } =
          input.data.completion.response;
      if (!context.df.isReplaying) {
        context.log.verbose(`${activityResponse} awaiting NewReturnMessage` +
            ` (codecServiceId:${resCodecServiceId}` +
            ` | codecMessageId:${resCodecMessageId})`);
        context.df.setCustomStatus({
          state: 'awaitingResponse',
          mobileId: mobileId,
          codecServiceId: resCodecServiceId,
          codecMessageId: resCodecMessageId,
        });
      }
      const responseTask = context.df.waitForExternalEvent('ResponseReceived');
      winner = yield context.df.Task.any([responseTask, timeoutTask]);
      if (winner === timeoutTask) {
        return handleTimeout(context, activityResponse, outputs);
      }
      const { response } = responseTask.result;
      outputs.push({ response: response });
      if (!context.df.isReplaying) {
        context.log.verbose(`Received response to ${otaCommandId}:` +
            ` ${JSON.stringify(response)}`);
      }
      const responseMeta = {
        response: response,
        commandMeta: input.data,
      };
      const responseEventTask =
          context.df.callActivity(activityResponseEvent, responseMeta);
      const { id: responseEventId } = responseEventTask.result;
      if (!context.df.isReplaying) {
        context.log.verbose(`Published event ${responseEventId} to EventGrid`);
      }
      outputs.push({ responseEventId: responseEventId });
    }
    
    timeoutTask.cancel();
    context.log.verbose(`${funcName} outputs: ${JSON.stringify(outputs)}`);
    for (let i=0; i < outputs.length; i++) {
      if ('commandFailedTime' in outputs[i]) {
        context.log.warn(`Command ${otaCommandId} failed` +
            ` (${outputs[i].reason})` +
            ` at ${outputs[i].commandFailedTime}`);
      }
    }
    // return outputs;
  } catch (err) {
    context.log.error(err.stack);
  } finally {
    return outputs;
  }
});

function handleTimeout(context, stage, outputs) {
  context.log.warn(`Timed out at stage ${stage}`);
  return outputs.push({ timeout: stage });
}
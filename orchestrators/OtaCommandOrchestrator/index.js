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
const activityCompletionEvent = 'OtaCommand7CompletionEvent';
const activityResponse = 'OtaCommand5Response';
const activityResponseEvent = 'OtaCommand6ResponseEvent';
const responseFeatureEnabled = true;

module.exports = df.orchestrator(function* (context) {
  let outputs = [];
  try {
    // 1. Triggered by OtaCommandRequest
    const input = context.df.getInput();
    if (!input || !input.data) throw new Error('Missing input data');
    if (!input.id) throw new Error('Missing input.id');
    // Timeout setup
    const expiration =
        moment.utc(context.df.currentUtcDateTime).add(timeout, "s");
    const timeoutTask = context.df.createTimer(expiration.toDate());
    let winner;  // for timeout management
    const { mobileId } = input.data;
    const otaCommandId = input.id;
    input.data.otaCommandId = otaCommandId;
    if (!context.df.isReplaying) {
      context.log.verbose(`${funcName} orchestrating command:` +
          ` ${JSON.stringify(input.data)}`);
    }
    
    // 2. Submit command as OTA message
    const submitTask = context.df.callActivity(activitySubmit, input.data);
    winner = yield context.df.Task.any([submitTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activitySubmit, outputs);
    }
    const { eventType: submitEvent, id: submitId } = submitTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`${activitySubmit} submitted ${submitEvent}` +
          ` (${submitId})`);
      context.log.verbose(`${activitySending} awaiting NewForwardMessage` +
          ` with submissionId ${otaCommandId}`);
      context.df.setCustomStatus({
        state: 'submitted',
        mobileId: mobileId,
        submissionId: otaCommandId,
      });
    }
    outputs.push({
      submissionEvent: submitEvent,
      submissionEventId: submitId,
    });

    // 3. Submission generates a NewForwardMessage with unique ID
    const sendingTask = context.df.waitForExternalEvent('CommandSending');
    winner = yield context.df.Task.any([sendingTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activitySending, outputs);
    }
    const { messageId } = sendingTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`${activitySending} sent messageId ${messageId}` +
          ` ${activityDelivery} awaiting ForwardMessageStateChange`);
      context.df.setCustomStatus({
        state: 'sending',
        mobileId: mobileId,
        messageId: messageId,
      });
    }
    outputs.push({ commandMessageId: messageId });
    
    // 4. ForwardMessageStateChange captured by OtaCommandDelivery
    const deliveryTask = context.df.waitForExternalEvent('CommandDelivered');
    winner = yield context.df.Task.any([deliveryTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activityDelivery, outputs);
    }
    const delivered = deliveryTask.result;
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

    // 5. Listen for NewReturnMessage if a response if specified
    // TODO: add grace time for response?
    if (!responseFeatureEnabled) {
      context.log.warn('Response capture disabled');
    } else if (delivered.success &&
        input.data.completion.response) {
      const { codecServiceId, codecMessageId } =
          input.data.completion.response;
      if (!context.df.isReplaying) {
        context.log.verbose(`${activityResponse} awaiting NewReturnMessage` +
            ` (codecServiceId|SIN:${codecServiceId}` +
            ` | codecMessageId|MIN:${codecMessageId})`);
        context.df.setCustomStatus({
          state: 'awaitingResponse',
          mobileId: mobileId,
          codecServiceId: codecServiceId,
          codecMessageId: codecMessageId,
        });
      }
      const responseTask = context.df.waitForExternalEvent('ResponseReceived');
      winner = yield context.df.Task.any([responseTask, timeoutTask]);
      if (winner === timeoutTask) {
        return handleTimeout(context, activityResponse, outputs);
      }
      const response = responseTask.result;
      if (!context.df.isReplaying) {
        context.log.verbose(`Received response to ${otaCommandId}:` +
            ` ${JSON.stringify(response)}`);
      }
      outputs.push({ response: response });
      
      // 6. Publish response event to EventGrid
      const responseMeta = {
        response: response,
        commandMeta: input.data,
      };
      const responseEventTask =
          context.df.callActivity(activityResponseEvent, responseMeta);
      winner = yield context.df.Task.any([responseEventTask, timeoutTask]);
      if (winner === timeoutTask) {
        return handleTimeout(context, activityResponseEvent, outputs);
      }
      const { eventType: responseEventType, id: responseEventId } =
          responseEventTask.result;
      if (!context.df.isReplaying) {
        context.log.verbose(`Published ${responseEventType} to EventGrid` +
            ` (${responseEventId})`);
      }
      outputs.push({
        responseEventType: responseEventType,
        responseEventId: responseEventId
      });
    }
  
  // 7. Publish completion event to EventGrid
  const completionMeta = {
      delivered: delivered,
      commandMeta: input.data,
    };
    const completionEventTask =
        context.df.callActivity(activityCompletionEvent, completionMeta);
    winner = yield context.df.Task.any([completionEventTask, timeoutTask]);
    if (winner === timeoutTask) {
      return handleTimeout(context, activityCompletionEvent, outputs);
    }
    const { eventType: completionEventType, id: completionEventId } =
        completionEventTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`Published ${completionEventType} to EventGrid` +
          ` (${completionEventId})`);
    }
    outputs.push({
      completionEvent: completionEventType,
      completionEventId: completionEventId
    });
  
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
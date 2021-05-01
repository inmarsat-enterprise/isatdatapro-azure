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
const activityResponse = 'OtaCommand5Response';
const activityCompletion = 'OtaCommand6Completion';
const responseFeatureEnabled = true;

module.exports = df.orchestrator(function* (context) {
  let outputs = [];
  try {
    // 1. Triggered by OtaCommandRequest
    const input = context.df.getInput();
    if (!input || !input.data) throw new Error('Missing input data');
    if (!input.id) throw new Error('Missing input.id');
    const { mobileId } = input.data;
    const otaCommandId = input.id;
    input.data.otaCommandId = otaCommandId;
    // Timeout setup
    const expiration =
        moment.utc(context.df.currentUtcDateTime).add(timeout, "s");
    const timeoutTask = context.df.createTimer(expiration.toDate());
    const timeoutMeta = { commandMeta: input.data };
    let winner;  // for timeout management
    if (!context.df.isReplaying) {
      context.log.verbose(`${funcName} orchestrating command:` +
          ` ${JSON.stringify(input.data)} (timeout: ${timeoutMeta} s)`);
    }
    
    // 2. Submit command as OTA message
    const submitTask = context.df.callActivity(activitySubmit, input.data);
    winner = yield context.df.Task.any([submitTask, timeoutTask]);
    if (winner === timeoutTask) {
      timeoutMeta.stage = activitySubmit;
      return handleTimeout(context, timeoutMeta, outputs);
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
      timeoutMeta.stage = activitySending;
      return handleTimeout(context, timeoutMeta, outputs);
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
      timeoutMeta.stage = activityDelivery;
      return handleTimeout(context, timeoutMeta, outputs);
    }
    const delivered = deliveryTask.result;
    if (!context.df.isReplaying) {
      context.log.verbose(`${funcName} received CommandDelivered` +
          ` with ${JSON.stringify(delivered)}`);
      if (!delivered.success) {
        context.log.warn(`${otaCommandId} failed (${delivered.reason})`);
      }
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
    let response;
    if (!responseFeatureEnabled) {
      context.log.warn('Response capture disabled');
    } else if (delivered.success &&
        input.data.completion.response) {
      const { codecServiceId, codecMessageId } =
          input.data.completion.response;
      if (!context.df.isReplaying) {
        context.log.verbose(`${activityResponse} awaiting NewReturnMessage` +
            ` [codecServiceId: ${codecServiceId},` +
            ` codecMessageId: ${codecMessageId}, ...]`);
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
        timeoutMeta.stage = activityResponse;
        return handleTimeout(context, timeoutMeta, outputs);
      }
      response = responseTask.result;
      if (!context.df.isReplaying) {
        context.log.verbose(`Received response to ${otaCommandId}:` +
            ` ${JSON.stringify(response)}`);
      }
      outputs.push({ response: response });
    }
  
    // 6. Publish completion event to EventGrid (for Device Bridge)
    const completionMeta = {
      delivered: delivered,
      commandMeta: input.data,
      response: response, 
    };
    const completionEventTask =
        context.df.callActivity(activityCompletion, completionMeta);
    winner = yield context.df.Task.any([completionEventTask, timeoutTask]);
    if (winner === timeoutTask) {
      timeoutMeta.stage = activityCompletion;
      return handleTimeout(context, timeoutMeta, outputs);
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

async function handleTimeout(context, timeoutMeta, outputs) {
  const { otaCommandId } = timeoutMeta.commandMeta;
  context.log.warn(`${otaCommandId} timed out at stage ${timeoutMeta.stage}`);
  const completionMeta = {
    delivered: {
      success: false,
      reason: "ORCHESTRATION_TIMEOUT",
    },
    commandMeta: timeoutMeta.commandMeta,
  };
  await context.df.callActivity(activityCompletion, completionMeta);
  return outputs.push({ timeout: timeoutMeta.stage });
}
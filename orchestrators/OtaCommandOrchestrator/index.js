// Durable function orchestrator
/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by a starter function and progressed by client functions.
 */

const df = require('durable-functions');
const moment = require('moment');

const functionTimeout = parseInt(process.env.functionTimeout) || 30;
const commandTimeout = parseInt(process.env.commandTimeout) || 600;
const deliveryGraceTime = parseInt(process.env.deliveryGraceTime) || 75;
const responseTimeout = parseInt(process.env.responseTimeout) || 75;
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
    const timeoutMeta = { commandMeta: input.data };
    let winner;
    if (!context.df.isReplaying) {
      context.log.verbose(`${funcName} orchestrating command:` +
          ` ${JSON.stringify(input.data)} (commandTimeout: ${timeoutMeta} s)`);
    }
    
    // 2. Submit command as OTA message
    const submitTask = context.df.callActivity(activitySubmit, input.data);
    const submitTimeout = getTimeoutTask(context, functionTimeout);
    winner = yield context.df.Task.any([submitTask, submitTimeout]);
    if (winner === submitTimeout) {
      timeoutMeta.stage = activitySubmit;
    } else {
      if (!submitTimeout.isCompleted) submitTimeout.cancel();
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
    }

    // 3. Submission generates a NewForwardMessage with unique ID
    let messageId;
    let scheduledSendTimeUtc;
    let otaMessageSize;
    if (!timeoutMeta.stage) {
      const sendingTask = context.df.waitForExternalEvent('CommandSending');
      const sendingTimeout = getTimeoutTask(context, functionTimeout);
      winner = yield context.df.Task.any([sendingTask, sendingTimeout]);
      if (winner === sendingTimeout) {
        timeoutMeta.stage = activitySending;
      } else {
        if (!sendingTimeout.isCompleted) sendingTimeout.cancel();
        messageId = sendingTask.result.messageId;
        scheduledSendTimeUtc = sendingTask.result.scheduledSendTimeUtc;
        otaMessageSize = sendingTask.result.size;
        if (!context.df.isReplaying) {
          context.log.verbose(`${activitySending} sent messageId ${messageId}` +
              ` ${activityDelivery} awaiting ForwardMessageStateChange`);
          context.df.setCustomStatus({
            state: 'sending',
            mobileId: mobileId,
            messageId: messageId,
            scheduledSendTimeUtc: scheduledSendTimeUtc,
          });
        }
        outputs.push({ commandMessageId: messageId });
      }
    }
    
    // 4. ForwardMessageStateChange captured by OtaCommandDelivery
    let delivered = { success: false };
    if (!timeoutMeta.stage) {
      const deliveryTask = context.df.waitForExternalEvent('CommandDelivered');
      const timeoutSeconds =
          getLowPowerTimeout(context, scheduledSendTimeUtc, otaMessageSize);
      const deliveryTimeout = getTimeoutTask(context, timeoutSeconds);
      winner = yield context.df.Task.any([deliveryTask, deliveryTimeout]);
      if (winner === deliveryTimeout) {
        timeoutMeta.stage = activityDelivery;
      } else {
        if (!deliveryTimeout.isCompleted) deliveryTimeout.cancel();
        delivered = deliveryTask.result;
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
      }
    }

    // 5. Listen for NewReturnMessage if a response if specified
    let response;
    if (!timeoutMeta.stage) {
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
        const respTimeout = getTimeoutTask(context, responseTimeout);
        winner = yield context.df.Task.any([responseTask, respTimeout]);
        if (winner === respTimeout) {
          timeoutMeta.stage = activityResponse;
        } else {
          if (!respTimeout.isCompleted) respTimeout.cancel();
          response = responseTask.result;
          if (!context.df.isReplaying) {
            context.log.verbose(`Received response to ${otaCommandId}:` +
                ` ${JSON.stringify(response)}`);
          }
          outputs.push({ response: response });
        }
      }
    }
  
    // 6. Publish completion event to EventGrid (for Device Bridge)
    const completionMeta = {
      delivered: delivered,
      commandMeta: input.data,
      response: response, 
    };
    if (timeoutMeta.stage) {
      completionMeta.delivered.reason = 'ORCHESTRATION_TIMEOUT';
      context.log.warn(`${otaCommandId} timed out at ${timeoutMeta.stage}`);
    }
    const completionEventTask =
        yield context.df.callActivity(activityCompletion, completionMeta);
    const { eventType: completionEventType, id: completionEventId } =
        completionEventTask;
    if (!context.df.isReplaying) {
      context.log.verbose(`Published ${completionEventType} to EventGrid` +
          ` (${completionEventId})`);
    }
    outputs.push({
      completionEvent: completionEventType,
      completionEventId: completionEventId
    });
    context.log.verbose(`${funcName} outputs: ${JSON.stringify(outputs)}`);
  } catch (err) {
    context.log.error(err.stack);
  } finally {
    return outputs;
  }
});

/**
 * Returns a Durable Function Timer task
 * @param {Object} context The Azure Function context
 * @param {number} seconds Seconds for timeout
 * @returns {Object} Timer task
 */
function getTimeoutTask(context, seconds) {
  if (!seconds || !(seconds instanceof(Number))) {
    seconds = commandTimeout;
  }
  const expiration =
      moment.utc(context.df.currentUtcDateTime).add(seconds, "s");
  return context.df.createTimer(expiration.toDate());
}

/**
 * Returns the number of seconds to wait for delivery
 * @param {Object} context The Azure Function context (for logging)
 * @param {string} scheduledSendTimeUtc The ISO/UTC time for low power delivery
 * @param {number} otaMessageSize The message size
 * @returns {number} seconds until expected delivery
 */
function getLowPowerTimeout(context, scheduledSendTimeUtc, otaMessageSize) {
  let graceTime = deliveryGraceTime;
  if (otaMessageSize && otaMessageSize > 100) {
    graceTime = graceTime + Math.round(otaMessageSize / 1000) * 75;
    context.log.verbose(`Adding ${graceTime} seconds for large message`);
  }
  if (!scheduledSendTimeUtc ||
      isNaN(new Date(scheduledSendTimeUtc).getTime())) {
    return commandTimeout + graceTime;
  }
  const wakeupTime = new Date(scheduledSendTimeUtc);
  const nowTime = new Date();
  return (wakeupTime.getTime() - nowTime.getTime()) / 1000 + graceTime;
}
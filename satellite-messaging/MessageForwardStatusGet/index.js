/**
 * Fetches `forward statuses` from the IsatData Pro service
 * @module MessageForwardStatusGet
 */
'use strict';

const idp = require('isatdatapro-microservices');
const getForwardStatuses = idp.getForwardStatuses;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

/**
 * Periodically retrieves statuses from the satellite network API
 * @param {Object} context The Azure function app context
 * @param {Object} timer The function app timer
 */
module.exports = async function (context, timer) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  context.bindings.outputEvent = [];

  function onForwardMessageStateChange(messageId,
    newState, reason, stateTimeUtc, mobileId) {
    const eventType = 'ForwardMessageStateChange';
    const subject = `Forward message ${messageId} state changed: ${newState}`;
    const data = {
      messageId: messageId,
      mobileId: mobileId,
      newState: newState,
      reason: reason,
      stateTimeUtc: stateTimeUtc,
    };
    const eventTime = stateTimeUtc ? stateTimeUtc : (new Date()).toISOString();
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log(`Publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  function onOtherClientForwardSubmission(messageId, mailboxId) {
    const eventType = 'OtherClientForwardSubmission';
    const subject = `Other Client submitted forward message ${messageId}`
        + ` via ${mailboxId}`;
    const data = {
      messageId: messageId,
      mailboxId: mailboxId,
    };
    const event = new eventGrid.Event(eventType, subject, data);
    context.log(`Publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  function onApiOutage(satelliteGateway, timestamp) {
    const event = eventGrid.ApiOutageEvent(satelliteGateway, timestamp);
    context.log.warning(`Satellite API outage detected`);
    context.bindings.outputEvent.push(event);
  }

  function onApiRecovery(satelliteGateway, timestamp) {
    const event = eventGrid.ApiRecoveryEvent(satelliteGateway, timestamp);
    context.log(`Satellite API recovery detected`);
    context.bindings.outputEvent.push(event);
  }

  try {
    eventHandler.on('ForwardMessageStateChange', onForwardMessageStateChange);
    eventHandler.on('OtherClientForwardSubmission',
        onOtherClientForwardSubmission);
    eventHandler.on('ApiOutage', onApiOutage);
    eventHandler.on('ApiRecovery', onApiRecovery);
    if (timer.IsPastDue) {
      context.log(`${thisFunction.name} timer past due!`);
    }
    context.log(`${thisFunction.name} timer triggered at ${callTime}`);
    await getForwardStatuses();
  } catch (e) {
    context.log(e.stack);
  } finally {
    eventHandler.off('ForwardMessageStateChange', onForwardMessageStateChange);
    eventHandler.off('OtherClientForwardSubmission',
        onOtherClientForwardSubmission);
    eventHandler.off('ApiOutage', onApiOutage);
    eventHandler.off('ApiRecovery', onApiRecovery);
  }
};
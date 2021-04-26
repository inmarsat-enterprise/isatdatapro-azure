/**
 * Fetches `forward statuses` from the IsatData Pro service
 * @module MessageForwardStatusGet
 */
'use strict';

const idp = require('isatdatapro-microservices');
const getForwardStatuses = idp.getForwardStatuses;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid, getFunctionName } = require('../SharedCode');

const funcName = 'MessageForwardStatusGet';

/**
 * Periodically retrieves statuses from the satellite network API
 * @param {Object} context The Azure function app context
 * @param {Object} timer The function app timer
 */
module.exports = async function (context, timer) {
  // const funcName = getFunctionName(__filename);
  // const callTime = new Date().toISOString();
  context.bindings.outputEvent = [];

  /**
   * Generates an EventGrid event in response to a change in forward message
   * state.
   * @param {number} messageId The unique forward message ID
   * @param {string} newState The message state
   * @param {string} reason The reason for the message state
   * @param {string} stateTimeUtc The UTC time of the state in ISO format
   * @param {string} mobileId The unique mobile ID (or broadcast ID)
   * @param {string} description Human-readable description of the event
   * @param {number} referenceNumber A correlation number for a return message
   */
  function onForwardMessageStateChange(
      messageId,
      newState,
      reason,
      stateTimeUtc,
      mobileId,
      description,
      referenceNumber) {
    const eventType = 'ForwardMessageStateChange';
    const subject = `Forward message ${messageId} state changed: ${newState}`;
    const data = {
      messageId: messageId,
      mobileId: mobileId,
      newState: newState,
      reason: reason,
      stateTimeUtc: stateTimeUtc,
      referenceNumber: referenceNumber,
    };
    const eventTime = stateTimeUtc ? stateTimeUtc : (new Date()).toISOString();
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log.verbose(`${funcName} publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  /**
   * Generates an EventGrid event when an unknown forward message has been
   * detected by retrieving statuses, implying another API client submitted
   * the message.
   * @param {number} messageId A unique forward message ID
   * @param {string | number} mailboxId The unique Mailbox ID being used
   */
  function onOtherClientForwardSubmission(messageId, mailboxId) {
    const eventType = 'OtherClientForwardSubmission';
    const subject = `Other Client submitted forward message ${messageId}` +
        ` via ${mailboxId}`;
    const data = {
      messageId: messageId,
      mailboxId: mailboxId,
    };
    const event = new eventGrid.Event(eventType, subject, data);
    context.log.verbose(`${funcName} publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  /**
   * Generates an EventGrid event when an API outage has been inferred from a
   * failed operation.
   * @param {string} satelliteGateway The unique satellite message gateway name
   * @param {string} timestamp The UTC time of the outage detection, ISO format
   */
  function onApiOutage(satelliteGateway, timestamp) {
    const event = eventGrid.ApiOutageEvent(satelliteGateway, timestamp);
    context.log.warn(`Satellite API outage detected`);
    context.bindings.outputEvent.push(event);
  }

  /**
   * Generates an EventGrid event when an API recovery has been inferred from a
   * successful operation following an API outage.
   * @param {string} satelliteGateway The unique satellite message gateway name
   * @param {string} timestamp The UTC time of the outage detection, ISO format
   */
   function onApiRecovery(satelliteGateway, timestamp) {
    const event = eventGrid.ApiRecoveryEvent(satelliteGateway, timestamp);
    context.log.info(`Satellite API recovery detected`);
    context.bindings.outputEvent.push(event);
  }

  try {
    eventHandler.on('ForwardMessageStateChange', onForwardMessageStateChange);
    eventHandler.on('OtherClientForwardSubmission',
        onOtherClientForwardSubmission);
    eventHandler.on('ApiOutage', onApiOutage);
    eventHandler.on('ApiRecovery', onApiRecovery);
    if (timer.IsPastDue) {
      context.log.warn(`${funcName} timer past due!`);
    }
    await getForwardStatuses();
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    eventHandler.off('ForwardMessageStateChange', onForwardMessageStateChange);
    eventHandler.off('OtherClientForwardSubmission',
        onOtherClientForwardSubmission);
    eventHandler.off('ApiOutage', onApiOutage);
    eventHandler.off('ApiRecovery', onApiRecovery);
  }
};
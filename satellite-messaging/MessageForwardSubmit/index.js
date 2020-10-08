/**
 * Submits `forward` messsages on the IsatData Pro service
 * @module MessageForwardSubmit
 */
'use strict';

const idp = require('isatdatapro-microservices');
const submitForwardMessage = idp.submitForwardMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

/**
 * A new forward message submission
 * @typedef {Object} NewForwardSubmission
 * @property {string} eventType 'NewForwardSubmission'
 * @property {Object} data The message submission
 * @property {string} data.mobileId The IDP mobile ID (destination)
 * @property {Object} data.message The message structure
 * @property {Object} [data.payloadJson] A JSON payload structure
 * @property {Array} [data.payloadRaw] An array of decimal-coded bytes
 * @property {Object} [data.modemCommand] A shorthand for predefined commands
 * @property {string} [data.submissionId] A submission identifier
 */

/**
 * Submits a message and posts a `NewForwardMessage` event
 * @param {Object} context The Azure function app context
 * @param {NewForwardSubmission} eventGridEvent 
 */
module.exports = async function (context, eventGridEvent) {
  context.log(`Function triggered by ${JSON.stringify(eventGridEvent)}`);
  context.bindings.outputEvent = [];
  let { mobileId, message, submissionId } = eventGridEvent.data;
  if (!submissionId) submissionId = null;
  
  function onNewForwardMessage(message) {
    const eventType = 'NewForwardMessage';
    const subject = `New forward message ${message.messageId}`
        + ` to ${message.mobileId}`;
    const data = Object.assign({ submissionId: submissionId }, message);
    const eventTime = message.mailboxTimeUtc;
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
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
    eventHandler.on('NewForwardMessage', onNewForwardMessage);
    eventHandler.on('ApiOutage', onApiOutage);
    eventHandler.on('ApiRecovery', onApiRecovery);
    const messageId = await submitForwardMessage(mobileId, message);
    context.log(messageId ? `Send messageId ${messageId}` : `Failed to send`);
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    eventHandler.off('NewForwardMessage', onNewForwardMessage);
    eventHandler.off('ApiOutage', onApiOutage);
    eventHandler.off('ApiRecovery', onApiRecovery);
  }
};
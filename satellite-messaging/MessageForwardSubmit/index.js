/**
 * Submits `forward` messsages on the IsatData Pro service
 * Publishes events to EventGrid
 * @module MessageForwardSubmit
 */
'use strict';

const idp = require('isatdatapro-microservices');
const submitForwardMessage = idp.submitForwardMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid, getFunctionName } = require('../SharedCode');

const funcName = 'MessageForwardSubmit';

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
  if (eventGridEvent.eventType === 'NewForwardSubmission') {
    // const funcName = getFunctionName(__filename);
    context.log.verbose(`${funcName} triggered with` +
        ` ${JSON.stringify(eventGridEvent.data)}`);
    context.bindings.outputEvent = [];
    const { mobileId, message, submissionId } = eventGridEvent.data;
    if (!submissionId) submissionId = null;
  
    /**
     * Publishes a `NewForwardMessage` to EventGrid
     * @param {Object} message A `ForwardMessage` object
     */
    function onNewForwardMessage(message) {
      const eventType = 'NewForwardMessage';
      const subject = `New forward message ${message.messageId}` +
          ` to ${message.mobileId}`;
      const data = Object.assign({ submissionId: submissionId }, message);
      const eventTime = message.mailboxTimeUtc;
      const event = new eventGrid.Event(eventType, subject, data, eventTime);
      context.log.verbose(`${funcName} publishing NewForwardMessage` +
          ` ${JSON.stringify(event)}`);
      context.bindings.outputEvent.push(event);
    }
  
    /**
     * Publishes an ApiOutage to EventGrid
     * @param {string} satelliteGateway The satellite message gateway name
     * @param {string} timestamp An ISO UTC timestamp of the event
     */
    function onApiOutage(satelliteGateway, timestamp) {
      const event = eventGrid.ApiOutageEvent(satelliteGateway, timestamp);
      context.log.warn(`Satellite API outage detected for ${satelliteGateway}`);
      // context.bindings.outputEvent.push(event);
    }
  
    /**
     * Publishes an ApiRecovery to EventGrid
     * @param {string} satelliteGateway The satellite message gateway name
     * @param {string} timestamp An ISO UTC timestamp of the event
     */
     function onApiRecovery(satelliteGateway, timestamp) {
      const event = eventGrid.ApiRecoveryEvent(satelliteGateway, timestamp);
      context.log.info(`Satellite API recovered for ${satelliteGateway}`);
      // context.bindings.outputEvent.push(event);
    }
  
    try {
      eventHandler.on('NewForwardMessage', onNewForwardMessage);
      eventHandler.on('ApiOutage', onApiOutage);
      eventHandler.on('ApiRecovery', onApiRecovery);
      const messageId = await submitForwardMessage(mobileId, message);
      if (messageId) {
        context.log(`Submitted messageId ${messageId}`);
      } else {
        context.log.error(`Failed to submit message`);
      }
    } catch (e) {
      context.log.error(e.stack);
    } finally {
      eventHandler.off('NewForwardMessage', onNewForwardMessage);
      eventHandler.off('ApiOutage', onApiOutage);
      eventHandler.off('ApiRecovery', onApiRecovery);
    }
  }
};
/**
 * Fetches a `forward` message from the IsatData Pro service
 * @module MessageForwardGet
 */
'use strict';

const idp = require('isatdatapro-microservices');
const getForwardMessages = idp.getForwardMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid } = require('../SharedCode');

/**
 * A forward message submission summary from another API client
 * @typedef {Object} OtherClientForwardSubmission
 * @property {string} eventType 'OtherClientForwardSubmission'
 * @property {Object} data The message submission
 * @property {number} data.messageId The unique forward message ID
 * @property {string} data.mailoxId The mailbox ID to retrieve from
 */

/**
 * Retrieves a forward message and metadata from the satellite API
 * @param {Object} context The Azure function app context
 * @param {OtherClientForwardSubmission} eventGridEvent 
 */
module.exports = async function (context, eventGridEvent) {
  const thisFunction = { name: __filename };
  const callTime = new Date().toISOString();
  context.bindings.outputEvent = [];
  
  function onNewMobile(mobile) {
    const eventType = 'NewMobile';
    const subject = `New mobile ${mobile.mobileId} sent message(s)`;
    const data = mobile;
    const eventTime = (new Date()).toISOString();
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
    eventHandler.on('NewMobile', onNewMobile);
    eventHandler.on('ApiOutage', onApiOutage);
    eventHandler.on('ApiRecovery', onApiRecovery);
    const messageId = eventGridEvent.data.messageId;
    const mailboxId = eventGridEvent.data.mailboxId;
    await getForwardMessages(mailboxId, messageId);
  } catch (e) {
    context.log(e.stack);
  } finally {
    eventHandler.off('NewMobile', onNewMobile);
    eventHandler.off('ApiOutage', onApiOutage);
    eventHandler.off('ApiRecovery', onApiRecovery);
  }
};
/**
 * Fetches `return` messsages from the IsatData Pro service
 * @module MessageReturnGet
 */
'use strict';

const idp = require('isatdatapro-microservices');
const getReturnMessages = idp.getReturnMessages;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid, getFunctionName } = require('../SharedCode');

const funcName = 'MessageReturnGet';

/**
 * Periodically retrieves messages from the satellite network API
 * @param {Object} context The Azure function app context
 * @param {Object} timer The function app timer
 */
module.exports = async function (context, timer) {
  // const funcName = getFunctionName(__filename);
  // const callTime = new Date().toISOString();
  context.bindings.outputEvent = [];
  
  function onNewReturnMessage(message) {
    const eventType = 'NewReturnMessage';
    const subject = `New return message ${message.messageId}`
        + ` from ${message.mobileId}`;
    const data = message;
    const eventTime = message.receiveTimeUtc;
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log.verbose(`${funcName} publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  function onNewMobile(mobile) {
    const eventType = 'NewMobile';
    const subject = `New mobile ${mobile.mobileId} sent message(s)`;
    const data = mobile;
    const eventTime = (new Date()).toISOString();
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log.verbose(`${funcName} publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  function onApiOutage(satelliteGateway, timestamp) {
    const event = eventGrid.ApiOutageEvent(satelliteGateway, timestamp);
    context.log.warn(`Satellite API outage detected`);
    context.bindings.outputEvent.push(event);
  }

  function onApiRecovery(satelliteGateway, timestamp) {
    const event = eventGrid.ApiRecoveryEvent(satelliteGateway, timestamp);
    context.log(`Satellite API recovery detected`);
    context.bindings.outputEvent.push(event);
  }

try {
    eventHandler.on('NewReturnMessage', onNewReturnMessage);
    eventHandler.on('NewMobile', onNewMobile);
    eventHandler.on('ApiOutage', onApiOutage);
    eventHandler.on('ApiRecovery', onApiRecovery);
    if (timer.IsPastDue) {
      context.log.warn(`${funcName} timer past due!`);
    }
    await getReturnMessages();
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    eventHandler.off('NewReturnMessage', onNewReturnMessage);
    eventHandler.off('NewMobile', onNewMobile);
    eventHandler.off('ApiOutage', onApiOutage);
    eventHandler.off('ApiRecovery', onApiRecovery);
  }
};
/**
 * Fetches `mobile`s from the IsatData Pro service
 * @module MobileGet
 */
'use strict';

const idp = require('isatdatapro-microservices');
const getMobiles = idp.getMobiles;
const eventHandler = idp.eventHandler.emitter;
const { eventGrid, getFunctionName } = require('../SharedCode');

/**
 * Retrieves a forward message and metadata from the satellite API
 * @param {Object} context The Azure function app context
 * @param {Object} eventGridEvent 
 */
module.exports = async function (context, eventGridEvent) {
  const funcName = getFunctionName(__filename);
  context.bindings.outputEvent = [];
  
  function onNewMobile(mobile) {
    const eventType = 'NewMobile';
    const subject = `New mobile ${mobile.mobileId} sent message(s)`;
    const data = mobile;
    const eventTime = (new Date()).toISOString();
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log(`${funcName} publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent.push(event);
  }

  function onApiOutage(satelliteGateway, timestamp) {
    const event = eventGrid.ApiOutageEvent(satelliteGateway, timestamp);
    context.log.warn(`Satellite API outage detected`);
    // context.bindings.outputEvent.push(event);
  }

  function onApiRecovery(satelliteGateway, timestamp) {
    const event = eventGrid.ApiRecoveryEvent(satelliteGateway, timestamp);
    context.log(`Satellite API recovery detected`);
    // context.bindings.outputEvent.push(event);
  }

try {
    eventHandler.on('NewMobile', onNewMobile);
    eventHandler.on('ApiOutage', onApiOutage);
    eventHandler.on('ApiRecovery', onApiRecovery);
    let mailboxId;
    let satelliteGateway;
    if (eventGridEvent.data.mailboxId) {
      mailboxId = eventGridEvent.data.mailboxId;
    }
    if (eventGridEvent.data.satelliteGatewayName) {
      satelliteGateway = eventGridEvent.data.satelliteGatewayName;
    }
    context.log.verbose(`${funcName} triggered`
        + ` with ${JSON.stringify(eventGridEvent.data)}`);
    await getMobiles(satelliteGateway, mailboxId);
  } catch (e) {
    context.log.error(e.stack);
  } finally {
    eventHandler.off('NewMobile', onNewMobile);
    eventHandler.off('ApiOutage', onApiOutage);
    eventHandler.off('ApiRecovery', onApiRecovery);
  }
};
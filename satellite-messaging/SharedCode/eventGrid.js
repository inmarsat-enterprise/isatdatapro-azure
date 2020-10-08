'use strict';
//require('dotenv');
const logger = require('./logger')(__filename);
const uuid = require('uuid').v4;
const msRestAzure = require('ms-rest-azure');
const eventGrid = require('azure-eventgrid');
const url = require('url');

const topicKey = process.env.EVENTGRID_TOPIC_KEY;
const topicEndpoint = process.env.EVENTGRID_TOPIC_ENDPOINT;
const topicCreds = new msRestAzure.TopicCredentials(topicKey);
const egClient = new eventGrid(topicCreds);
const topicUrl = url.parse(topicEndpoint, true);
const topicHostName = topicUrl.host;

/**
 * Class representing an Event
 */
class Event {
  /**
   * Create an event.
   * @param {string} eventType An event tag
   * @param {string} subject The verbose description
   * @param {Object} data The associated event data
   * @param {string|Date} eventTime The time of the event (UTC)
   */
  constructor (eventType, subject, data, eventTime) {
    if (eventTime && isNaN(Date.parse(eventTime))) {
      throw new Error(`Invalid datetime ${eventTime}`);
    }
    this.id = uuid();
    this.subject = String(subject);
    this.dataVersion = '2.0';
    this.eventType = String(eventType);
    this.data = data;
    this.eventTime = eventTime || (new Date()).toISOString();
  }
}

/**
 * Returns an EventGrid event structure for API outage notification
 * @param {string} satelliteGatewayName 
 * @param {string} timestamp 
 * @returns {Event}
 */
const ApiOutageEvent = (satelliteGatewayName, timestamp) => {
  const eventType = 'ApiOutage';
  const subject =
      `API outage detected on ${satelliteGatewayName} at ${timestamp}`;
  const data = {
    satelliteGatewayName: satelliteGatewayName,
    timestamp: timestamp,
  };
  return new Event(eventType, subject, data, timestamp);
}

/**
 * Returns an EventGrid event structure for API recovery notification
 * @param {string} satelliteGatewayName 
 * @param {string} timestamp 
 * @returns {Event}
 */
const ApiRecoveryEvent = (satelliteGatewayName, timestamp) => {
  const eventType = 'ApiRecovery';
  const subject =
      `API recovered on ${satelliteGatewayName} at ${timestamp}`;
  const data = {
    satelliteGatewayName: satelliteGatewayName,
    timestamp: timestamp,
  };
  return new Event(eventType, subject, data, timestamp);
}

/**
 * Posts an event to the defined Event Grid in Azure
 * @private
 * @param {string} subject The event subject
 * @param {string} eventType An event type
 * @param {object} data Data/meta about the event
 */
async function publish(subject, eventType, data) {
  const events = [{
    id: uuid(),
    subject: String(subject),
    dataVersion: '2.0',
    eventType: String(eventType),
    data: data,
    eventTime: new Date()
  }];
  egClient.publishEvents(topicHostName, events)
  .then((result) => {
    return Promise.resolve(
      logger.info(`Published ${eventType} successfully`)
    );
    //logger.info(`Event Grid published: ${JSON.stringify(result)}`);
  })
  .catch((err) => {
    logger.error(`Event Grid publish error: ${err}`);
  });
}

/**
 * Publishes a NewReturnMessage EventGrid event
 * @param {object} message The return message
 */
function onNewReturnMessage(message) {
  const egSubject =
      `New return message ${message.messageId} from ${message.mobileId}`;
  const egEventType = 'NewReturnMessage';
  // TODO: probably shouldn't send entire message, but works since messages are small
  // Option 1: put message in Service Bus
  // Option 2: include unique message ID for event subscriber to retrieve from database
  const egData = message;
  publish(egSubject, egEventType, egData);
}

/**
 * Publishes a NewForwardMessage EventGrid event
 * @param {string} message The forward message
 */
function onNewForwardMessage(message) {
  const egSubject =
      `New forward message ${message.messageId} to ${message.mobileId}`;
  const egEventType = 'NewForwardMessage';
  // TODO: probably shouldn't send entire message, but works since messages are small
  // Option 1: put message in Service Bus
  // Option 2: include unique message ID for event subscriber to retrieve from database
  const egData = message;
  publish(egSubject, egEventType, egData);
}

/**
 * Publishes a ForwardMessageStateChange EventGrid event
 * @param {string} messageId Unique message ID
 * @param {string} mobileId Unique mobile ID
 * @param {string} newState New state of the message
 */
function onForwardMessageStateChange(messageId, mobileId, newState) {
  const egSubject = `Forward message ${messageId} state changed: ${newState}`;
  const egEventType = 'ForwardMessageStateChange';
  const egData = {
    messageId: messageId,
    mobileId: mobileId,
    newState: newState,
  };
  publish(egSubject, egEventType, egData);
}

/**
 * Publishes a OtherClientForwardSubmission EventGrid event
 * @param {string} messageId Unique message ID
 * @param {string} mailboxId Unique mailbox ID
 */
function onOtherClientForwardSubmission(messageId, mailboxId) {
  const egSubject =
      `Other Client submitted forward message ${messageId} via ${mailboxId}`;
  const egEventType = 'OtherClientForwardSubmission';
  const egData = {
    messageId: messageId,
    mailboxId: mailboxId,
  };
  publish(egSubject, egEventType, egData);
}

/**
 * Publishes a NewMobile EventGrid event
 * @param {object} mobile The mobile/modem metadata
 */
function onNewMobile(mobile) {
  const egSubject =
      `New mobile ${mobile.mobileId} discovered on ${mobile.mailboxId}`;
  const egEventType = 'NewMobile';
  const egData = mobile;
  publish(egSubject, egEventType, egData);
}

/**
 * Publishes a ApiOutage EventGrid event
 * @param {string} satelliteGatewayName Name of the gateway entity
 * @param {string} timestamp ISO format timestamp
 */
function onApiOutage(satelliteGatewayName, timestamp) {
  const egSubject =
      `API outage detected on ${satelliteGatewayName} at ${timestamp}`;
  const egEventType = 'ApiOutage';
  const egData = {
    satelliteGatewayName: satelliteGatewayName,
    timestamp: timestamp,
  };
  publish(egSubject, egEventType, egData);
}

/**
 * Publishes a ApiRecovery EventGrid event
 * @param {string} satelliteGatewayName Name of the gateway entity
 * @param {string} timestamp ISO format timestamp
 */
function onApiRecovery(satelliteGatewayName, timestamp) {
  const egSubject = `API recovered on ${satelliteGatewayName} at ${timestamp}`;
  const egEventType = 'ApiRecovery';
  const egData = {
    satelliteGatewayName: satelliteGatewayName,
    timestamp: timestamp,
  };
  publish(egSubject, egEventType, egData);
}

module.exports = {
  Event,
  ApiOutageEvent,
  ApiRecoveryEvent,
  //onApiOutage,
  //onApiRecovery,
  //onNewReturnMessage,
  //onNewForwardMessage,
  //onForwardMessageStateChange,
  //onOtherClientForwardSubmission,
  //onNewMobile,
};

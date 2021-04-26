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

module.exports = {
  Event,
  ApiOutageEvent,
  ApiRecoveryEvent,
};

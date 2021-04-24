const uuid = require('uuid').v4;
const testConstants = require('./testConstants');
const eventTime = new Date().toISOString();

const ForwardMessageStateChange = {
  "id": `${uuid()}`,
  "subject": `Forward message ${testConstants.forwardMessageId} state changed: DELIVERED`,
  "data": {
    "messageId": `${testConstants.forwardMessageId}`,
    "newState": "DELIVERED",
    "reason": "NO_ERROR",
    "stateTimeUtc": `${eventTime}`,
    "referenceNumber": `${testConstants.forwardStatusReferenceNumber}`
  },
  "eventType": "ForwardMessageStateChange",
  "dataVersion": "2.0",
  "metadataVersion": "1",
  "eventTime": `${eventTime}`,
  "topic": `/subscriptions/${testConstants.eventGridSubscriptionId}` +
      `/resourceGroups/${testConstants.resourceGroupName}` +
      `/providers/Microsoft.EventGrid/topics/${testConstants.eventGridTopic}`
}
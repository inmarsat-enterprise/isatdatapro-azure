const uuid = require('uuid').v4;
const testConstants = require('./testConstants');
const eventTime = new Date().toISOString();

const ForwardMessageStateChange = {
  "id": `${uuid()}`,
  "subject": `Forward message ${testConstants.forwardMessageId} state changed: FAILED_DELIVERY`,
  "data": {
    "messageId": `${testConstants.forwardMessageId}`,
    "newState": "FAILED_DELIVERY",
    "reason": "TIMED_OUT",
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
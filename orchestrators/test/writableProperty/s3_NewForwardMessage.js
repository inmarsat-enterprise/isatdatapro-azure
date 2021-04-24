const uuid = require('uuid').v4;
const testConstants = require('./testConstants');

const NewForwardMessage = {
  "id": `${uuid()}`,
  "subject": `New forward message ${testConstants.forwardMessageId} to ${testConstants.mobileId}`,
  "data": {
    "submissionId": `${testConstants.otaCommandUuid}`,
    "mobileId": `${testConstants.mobileId}`,
    "messageId": `${testConstants.forwardMessageId}`,
    "payloadJson": {
        "codecServiceId": 0,
        "codecMessageId": 70,
        "fields": [
            {
            "name": "wakeupPeriod",
            "stringValue": "0"
            }
        ]
    }
  },
  "eventType": "NewForwardMessage",
  "dataVersion": "2.0",
  "metadataVersion": "1",
  "eventTime": `${new Date().toISOString()}`,
  "topic": `/subscriptions/${testConstants.eventGridSubscriptionId}` +
      `/resourceGroups/${testConstants.resourceGroupName}` +
      `/providers/Microsoft.EventGrid/topics/${testConstants.eventGridTopic}`
}
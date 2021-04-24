const testConstants = require('./testConstants');

const OtaCommandRequestWritablePropertyWakeupPeriod = {
  "id": `${testConstants.otaCommandUuid}`,
  "subject": `IOTC Desired property wakeupPeriod=0 for ${testConstants.mobileId}`,
  "data": {
    "mobileId": `${testConstants.mobileId}`,
    "command": {
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
    "completion": {
        "property": "idpWakeupPeriod",
        "av": `${testConstants.otaCommandPropertyVersion}`,
        "value": 0,
        "response": {
            "codecServiceId": 0,
            "codecMessageId": 70
        }
    }
  },
  "eventType": "OtaCommandRequest",
  "dataVersion": "2.0",
  "metadataVersion": "1",
  "eventTime": `${new Date().toISOString()}`,
  "topic": `/subscriptions/${testConstants.eventGridSubscriptionId}` +
      `/resourceGroups/${testConstants.resourceGroupName}` +
      `/providers/Microsoft.EventGrid/topics/${testConstants.eventGridTopic}`
}
const uuid = require('uuid').v4;
const testConstants = require('./testConstants');
const receivedTime = new Date().toISOString();

const NewReturnMessage = {
  "id": `${uuid()}`,
  "subject": `New return message ${testConstants.returnMessageId} from ${testConstants.mobileId}`,
  "data": {
    "category": "message_return",
    "messageId": `${testConstants.returnMessageId}`,
    "mobileId": `${testConstants.mobileId}`,
    "mailboxId": `${testConstants.mailboxId}`,
    "codecServiceId": 0,
    "codecMessageId": 70,
    "payloadRaw": [0,70,0,28,96],
    "payloadJson": {
        "name":"sleepSchedule",
        "codecServiceId":0,
        "codecMessageId":70,
        "fields":[
            {
                "name":"wakeupPeriod",
                "stringValue":"none",
                "dataType":"enum"
            },
            {
                "name":"mobileInitiated",
                "stringValue":"False",
                "dataType":"boolean"
            },
            {
                "name": "messageReference",
                "stringValue": `${testConstants.forwardStatusReferenceNumber}`,
                "dataType": "unsignedint"
            }
        ]
    },
    "mailboxTimeUtc": `${receivedTime}`,
    "size": 5,
    "subcategory": "return",
    "receiveTimeUtc": `${receivedTime}`,
    "satelliteRegion": "SIMULATOR"
  },
  "eventType": "NewReturnMessage",
  "dataVersion": "2.0",
  "metadataVersion": "1",
  "eventTime": `${new Date().toISOString()}`,
  "topic": `/subscriptions/${testConstants.eventGridSubscriptionId}` +
      `/resourceGroups/${testConstants.resourceGroupName}` +
      `/providers/Microsoft.EventGrid/topics/${testConstants.eventGridTopic}`
}
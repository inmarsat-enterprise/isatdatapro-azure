const testUrl = 'http://localhost:7071/runtime/webhooks/eventgrid?functionName=IotcDeviceBridge';
/*
Postman headers:
Content-Type: application/json
aeg-event-type: Notification

Body below
*/

const NewReturnMessage = {
  id: '749b188a-e073-49a2-b76c-788a21a5ee33',
  subject: 'New return message 45791091 from 01174907SKYFDA4',
  data: {
    category: 'message_return',
    messageId: 45791091,
    mobileId: '01174907SKYFDA4',
    mailboxId: '592',
    codecServiceId: 0,
    codecMessageId: 112,
    payloadRaw: [0, 112, 33, 96, 33, 100],
    payloadJson: {
      name: 'mobilePing',
      codecServiceId: 0,
      codecMessageId: 112,
      fields: []
    },
    mailboxTimeUtc: '2020-08-25T02:22:38Z',
    size: 6,
    subcategory: 'return',
    receiveTimeUtc: '2020-08-25T02:22:38Z',
    satelliteRegion: 'AMERRB16'
  },
  eventType: 'NewReturnMessage',
  dataVersion: '2.0',
  metadataVersion: '1',
  eventTime: '2020-08-25T02:22:51.746Z',
  topic:
    '/subscriptions/16fa9634-8673-4ed3-8893-4b7df5f9a2a9/resourceGroups/enterprise-iot-poc/providers/Microsoft.EventGrid/topics/IdpExternalizations'
}
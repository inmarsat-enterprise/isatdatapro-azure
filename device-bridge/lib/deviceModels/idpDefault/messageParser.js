const commonMessageFormat = require('../../commonMessageFormat');

function parseGenericIdp(context, message) {
  const timestamp = message.receiveTimeUtc;
  let telemetry;
  let reportedProperties;
  if (!message.payloadJson) {
    telemetry = { rawBinary: JSON.stringify(message.payloadRaw) };
  } else {
    telemetry = commonMessageFormat.parse(message);
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = parseGenericIdp;

const testMessage = {
  "category": "message_return",
  "messageId": 47821250,
  "mobileId": "01459438SKYFEE3",
  "mailboxId": "590",
  "codecServiceId": 0,
  "codecMessageId": 112,
  "payloadRaw": [
    0,
    112,
    44,
    98,
    44,
    94
  ],
  "payloadJson": {
    "name": "mobilePing",
    "codecServiceId": 0,
    "codecMessageId": 112,
    "fields": [
      {
        "name": "requestTime",
        "stringValue": "11362",
        "dataType": "unsignedint"
      },
      {
        "name": "responseTime",
        "stringValue": "11358",
        "dataType": "unsignedint"
      }
    ]
  },
  "mailboxTimeUtc": "2020-09-19T21:21:47Z",
  "size": 6,
  "ttl": 7776000,
  "subcategory": "return",
  "receiveTimeUtc": "2020-09-19T21:21:47Z",
  "satelliteRegion": "AMERRB16"
};

//console.log(parseGenericIdp(console, testMessage));
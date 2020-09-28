const commonMessageFormat = require('./commonMessageFormat');
const { round } = require('../../utilities');

function writeProperty(propName, propValue) {
  //wakeupPeriod, powerMode, broadcastIds, userTxState
  const commandDetails = {};
  switch (propName) {
    case 'wakeupPeriod':
      commandDetails.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 70,
          fields: [
            {
              name: 'wakeupPeriod',
              stringValue: `${propValue}`
            }
          ]
        }
      };
      break;
    case 'broadcastIds':
      break;
    case 'userTxState':
      commandDetails.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 71,
          fields: [
            {
              name: 'txMute',
              stringValue: propValue === true ? 'True' : 'False'
            }
          ]
        }
      };
      break;
    default:
      return null;
  }
  return commandDetails;
}

function command(command, params) {
  let commandDetails = {};
  switch (command) {
    //
  }
}

function parseMetadata(message) {
  const reportedProperties = {};
  reportedProperties.mobileId = message.mobileId;
  if (message.mobileId.includes('SKY')) {
    reportedProperties.manufacturer = 'ORBCOMM';
  } else if (message.mobileId.includes('HON')) {
    reportedProperties.manufacturer = 'Honeywell';
  }
  reportedProperties.satelliteRegion = message.satelliteRegion;
  reportedProperties.lastRxMsgTime = message.receiveTimeUtc;
  return reportedProperties;
}

function parseGenericIdp(message) {
  const timestamp = message.receiveTimeUtc;
  let telemetry;
  let reportedProperties = parseMetadata(message);
  if (!message.payloadJson) {
    telemetry = { rawBinary: JSON.stringify(message.payloadRaw) };
  } else {
    telemetry = commonMessageFormat.parse(message).data;
    if (message.codecServiceId === 0) {
      switch (codecMessageId) {
        case 97:
        case 1:
        case 0:
          reportedProperties.hardwareVersion =
              `${telemetry.hardwareMajorVersion}`
              + `.${telemetry.hardwareMinorVersion}`;
          reportedProperties.firmwareVersion =
              `${telemetry.firmwareMajorVersion}`
              + `.${telemetry.firmwareMinorVersion}`;
          reportedProperties.productId = telemetry.productId;
          reportedProperties.wakeupPeriod =
              telemetry.wakeupPeriod.toLowerCase();
          reportedProperties.lastResetReason = telemetry.lastResetReason;
          reportedProperties.operatorAccessLevel =
              telemetry.operatorTxState;
          reportedProperties.userTxState =
              telemetry.userTxState === 0 ? false : true;
          reportedProperties.broadcastIdCount = telemetry.broadcastIdCount;
          if (codecMessageId !== 97) {
            reportedProperties.lastRegistrationTime = telemetry.receiveTimeUtc;
          }
          telemetry = {};
          break;
        case 70:
          reportedProperties.wakeupPeriod =
              telemetry.wakeupPeriod.toLowerCase();
          //TODO: capture source of change?
          telemetry = {};
          break;
        case 72:
          reportedProperties.location = {
            lat: round(telemetry.latitude / 60000, 6),
            lon: round(telemetry.longitude / 60000, 6),
            alt: telemetry.altitude
          }
          break;
        case 115:
          console.log(`${JSON.stringify(telemetry)}`);
          break;
      }
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parseGenericIdp,
  writeProperty, 
};

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
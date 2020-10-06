const commonMessageFormat = require('../../codecCommonMessageFormat');
const { round } = require('../../utilities');

const writableProperties = [
  'wakeupPeriod',
  'commandPingModem',
  'commandGetLocation',
  'commandReset',
  'txMute',
  'commandGetBroadcastIds',
  'commandGetConfiguration',
];

/**
 * Returns the parameters for a CommandRequest event grid event
 * @param {string} propName The writable property / proxy command name
 * @param {*} [propValue] The value to write
 * @returns {{ command: Object, response: Object }} CommandRequest event parameters
 */
function writeProperty(propName, propValue) {
  let otaMessage = {};
  switch (propName) {
    case 'wakeupPeriod':
      otaMessage.command = {
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
    case 'txMute':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 71,
          fields: [
            {
              name: 'txMute',
              stringValue: (propValue === true) ? 'True' : 'False'
            }
          ]
        }
      };
      break;
    case 'commandReset':
      otaMessage.command = {
        modemCommand: {
          command: 'reset',
          params: `${propValue}`
        }
      };
      otaMessage.completion = {
        codecServiceId: 0,
        codecMessageId: 0,
        property: propName,
        resetValue: 'none'
      };
      break;
    case 'commandPingModem':
      otaMessage.command = {
        modemCommand: {
          command: 'ping'
        }
      };
      otaMessage.completion = {
        codecServiceId: 0,
        codecMessageId: 112,
        property: propName,
        resetValue: false
      };
      break;
    case 'commandGetLocation':
      otaMessage.command = {
        modemCommand: {
          command: 'getLocation'
        }
      };
      otaMessage.completion = {
        codecServiceId: 0,
        codecMessageId: 72,
        property: propName,
        resetValue: false
      };
      break;
    case 'commandGetBroadcastIds':
      otaMessage.command = {
        modemCommand: {
          command: 'getBroadcastIds'
        }
      };
      otaMessage.completion = {
        codecServiceId: 0,
        codecMessageId: 115,
        property: propName,
        resetValue: false
      };
      break;
    case 'commandGetConfiguration':
      otaMessage.command = {
        modemCommand: {
          command: 'getConfiguration'
        }
      };
      otaMessage.completion = {
        codecServiceId: 0,
        codecMessageId: 97,
        property: propName,
        resetValue: false
      };
      break;
    default:
      otaMessage = null;
  }
  return otaMessage;
}

/**
 * Returns reportedProperties based on message envelope
 * @param {Object} message A return message
 * @returns {Object} reportedProperties
 */
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
  if (message.completion) {
    reportedProperties[message.completion.property] =
        message.completion.resetValue;
  }
  return reportedProperties;
}

/**
 * Returns a set of telemetry for codec-defined messages
 * If using codecServiceId=0 returns reportedProperties for the modem
 * Returns a datetime based on the satellite receive time of the message
 * @param {Object} message A return message
 * @returns {{ telemetry: Object, reportedProperties: Object, timestamp: string }}
 */
function parseGenericIdp(context, message) {
  const timestamp = message.receiveTimeUtc;
  let telemetry;
  let reportedProperties = parseMetadata(message);
  if (!message.payloadJson) {
    telemetry = { rawBinary: JSON.stringify(message.payloadRaw) };
  } else {
    telemetry = commonMessageFormat.parse(message).data;
    if (message.codecServiceId === 0) {
      switch (message.codecMessageId) {
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
          telemetry = undefined;
          break;
        case 70:
          reportedProperties.wakeupPeriod =
              telemetry.wakeupPeriod.toLowerCase();
          telemetry = {
            wakeupPeriodChangeSource:
                (telemetry.mobileInitiated === true) ? 'device' : 'cloud',
          };
          break;
        case 72:
          telemetry.latitude = round(telemetry.latitude / 60000, 6);
          telemetry.longitude = round(telemetry.longitude / 60000, 6);
          reportedProperties.location = {
            lat: telemetry.latitude,
            lon: telemetry.longitude,
            alt: telemetry.altitude
          }
          telemetry.heading = telemetry.heading * 2;
          const { dayOfMonth, minuteOfDay } = telemetry;
          delete telemetry.dayOfMonth;
          delete telemetry.minuteOfDay;
          const utcHour = Math.trunc(minuteOfDay / 1440);
          const utcMinute = minuteOfDay % 1440;
          const gnssFixDate = new Date(message.receiveTimeUtc);
          gnssFixDate.setUTCDate(dayOfMonth);
          gnssFixDate.setUTCHours(utcHour);
          gnssFixDate.setUTCMinutes(utcMinute);
          gnssFixDate.setUTCSeconds(0);
          telemetry.gnssFixTime = gnssFixDate.toISOString();
          break;
        case 112:
          reportedProperties.lastPingResponse = message.receiveTimeUtc;
          break;
        case 115:
          //console.log(`${JSON.stringify(telemetry)}`);
          reportedProperties.broadcastIds = telemetry.broadcastIds;
          telemetry = undefined;
          break;
      }
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parse: parseGenericIdp,
  //parseGenericIdp,
  writeProperty,
  writableProperties,
};

const commonMessageFormat = require('../../codecCommonMessageFormat');
const { round } = require('../../utilities');

function initialize(mobileId) {
  const initialReport = {
    idpMobileId: mobileId,
    idpModemManufacturer: getManufacturer(mobileId),
    //idpHardwareVersion: '',
    //idpFirmwareVersion: '',
    //idpProductId: 0,
    //idpBroadcastIdCount: 0,
    //idpLocation: null,
    idpOperatorAccessLevel: 0,
    idpUserAccessLevel: 0,
    //idpLastRxMsgTime: '',
    //idpLastRegistrationTime: '',
    //idpSatelliteRegion: '',
    idpLastResetReason: 0,
    idpWakeupPeriod: {
      'value': 0,
      'av': 0,
      'ac': 200,
      'ad': 'default'
    },
    idpBroadcastIds: {},
    idpTxMute: {
      'value': false,
      'av': 0,
      'ac': 200,
      'ad': 'default'
    },
  };
  for (let i=0; i < 16; i++) {
    const index = `index${i}`;
    initialReport.idpBroadcastIds[index] = {
      'value': 0,
      'av': 0,
      'ac': 200,
      'ad': 'default'
    };
  }
  return initialReport;
}

/**
 * Returns the parameters for a CommandRequest event grid event
 * @param {string} propName The writable property / proxy command name
 * @param {*} [propValue] The value to write
 * @returns {{ command: Object, response: Object }} CommandRequest event parameters
 */
function writeProperty(propName, propValue, version) {
  let otaMessage = {
    completion: {
      property: propName,
      av: version,
    }
  };
  switch (propName) {
    case 'idpWakeupPeriod':
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
      otaMessage.completion.value = propValue;
      // Future: wait for the modem to register its new wakeupPeriod
      otaMessage.completion.response = {
        codecServiceId: 0,
        codecMessageId: 70,
      };
      break;
    case 'idpTxMute':
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
      otaMessage.completion.value = propValue;
      break;
    default:
      throw new Error(`Property ${propName} not writable by idpDefault`);
  }
  return otaMessage;
}

function otaCommand(commandName, data) {
  let otaMessage = {};
  switch (commandName) {
    case 'idpCommandReset':
      const resetType = parseInt(data);
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 68,
          fields: [
            {
              name: 'resetType',
              stringValue: resetType.toString()
            }
          ]
        }
      };
      break;
    case 'idpCommandPingModem':
      const d = new Date();
      const pingTime = ((d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 +
          d.getUTCSeconds()) % 65535);  
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 112,
          fields: [
            {
              name: 'requestTime',
              stringValue: pingTime.toString()
            }
          ]
        }
      };
      break;
    case 'idpCommandGetLocation':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 72
        }
      };
      break;
    case 'idpCommandGetBroadcastIds':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 115
        }
      };
      break;
    case 'idpCommandGetConfiguration':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 0,
          codecMessageId: 97
        }
      };
      break;
    default:
      throw new Error(`No command defined for ${commandName}`);
  }
  return otaMessage;
}

/**
 * Derives the manufacturer name based on unique Mobile ID
 * @param {string} mobileId 
 * @returns {string} The manufacturer name
 */
function getManufacturer(mobileId) {
  if (mobileId.includes('SKY')) return 'ORBCOMM';
  if (mobileId.includes('HON')) return 'Honeywell';
  return 'unknown';
}

/**
 * Returns reportedProperties based on message envelope
 * @param {Object} message A return message
 * @returns {Object} reportedProperties
 */
function parseMetadata(message) {
  const reportedProperties = {};
  reportedProperties.idpMobileId = message.mobileId;
  reportedProperties.idpModemManufacturer = getManufacturer(message.mobileId);
  reportedProperties.idpSatelliteRegion = message.satelliteRegion;
  reportedProperties.idpLastRxMsgTime = message.receiveTimeUtc;
  return reportedProperties;
}

/**
 * Returns the converted pingTime field value from timestamp
 * @param {string} timestamp datestamp
 * @returns {number}
 */
function secondOfDay(timestamp) {
  let d;
  if (typeof (timestamp) === 'undefined') {
    d = new Date();
  } else {
    d = new Date(timestamp);
  }
  const secondOfDay = (
      d.getUTCHours() * 3600
      + d.getUTCMinutes() * 60
      + d.getUTCSeconds());
  return secondOfDay;
}

/**
 * Converts seconds to a UTC/ISO datetime
 * @param {number} secondOfDay 
 * @returns {string} ISO formatted string
 */
function parsePingTime(secondOfDay) {
  let d = new Date();
  utcHour = Math.floor(secondOfDay / 3600);
  utcMinute = Math.floor((secondOfDay % 3600) / 60);
  utcSecond = ((secondOfDay % 3600) % 60);
  d.setUTCHours(utcHour, utcMinute, utcSecond);
  return d.toISOString();
}

/**
 * Returns a set of telemetry for codec-defined messages
 * If using codecServiceId=0 returns reportedProperties for the modem
 * Returns a datetime based on the satellite receive time of the message
 * @param {Object} context Azure Function context for logging
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
          // Configuration response to a request, same format as registration
        case 1:
          // Beam switch registration, same format as network registration
        case 0:
          // Network registration
          reportedProperties.idpHardwareVersion =
              `${telemetry.hardwareMajorVersion}` +
              `.${telemetry.hardwareMinorVersion}`;
          reportedProperties.idpFirmwareVersion =
              `${telemetry.firmwareMajorVersion}` +
              `.${telemetry.firmwareMinorVersion}`;
          reportedProperties.idpProductId = telemetry.productId;
          reportedProperties.idpWakeupPeriod =
              telemetry.wakeupPeriod.toLowerCase();
          reportedProperties.idpLastResetReason = telemetry.lastResetReason;
          reportedProperties.idpOperatorAccessLevel =
              telemetry.operatorTxState;
          reportedProperties.idpUserTxState =
              telemetry.userTxState === 0 ? false : true;
          reportedProperties.idpBroadcastIdCount = telemetry.broadcastIdCount;
          if (codecMessageId !== 97) {
            reportedProperties.idpLastRegistrationTime =
                telemetry.receiveTimeUtc;
          }
          telemetry = undefined;
          break;
        case 70:
          // Wakeup period changed
          reportedProperties.idpWakeupPeriod =
              telemetry.wakeupPeriod.toLowerCase();
          telemetry = {
            idpWakeupPeriodChangeSource:
                (telemetry.mobileInitiated === true) ? 'device' : 'cloud',
          };
          break;
        case 72:
          // Location response to request
          telemetry.idpLatitude = round(telemetry.latitude / 60000, 6);
          telemetry.idpLongitude = round(telemetry.longitude / 60000, 6);
          reportedProperties.idpLocation = {
            lat: telemetry.idpLatitude,
            lon: telemetry.idpLongitude,
            alt: telemetry.idpAltitude,
          }
          telemetry.idpHeading = telemetry.heading * 2;
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
          telemetry.idpGnssFixTime = gnssFixDate.toISOString();
          break;
        case 112:
          // Ping response to request
          const receivedSecond = secondOfDay(message.receiveTimeUtc);
          let { requestTime, responseTime } = telemetry;
          if (receivedSecond > 65535) {
            requestTime += 65535;
            responseTime += 65535;
          }
          telemetry.requestTime = parsePingTime(requestTime);
          telemetry.responseTime = parsePingTime(responseTime);
          break;
        case 115:
          // List broadcast IDs response to request
          reportedProperties.idpBroadcastIds = {};
          for (let i=0; i < 16; i++) {
            const index = `index${i}`;
            const broadcastId = telemetry.broadcastIds[i][0].value;
            reportedProperties.idpBroadcastIds[index] = broadcastId
          }
          telemetry = undefined;
          break;
      }
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parse: parseGenericIdp,
  writeProperty,
  otaCommand,
  initialize,
};

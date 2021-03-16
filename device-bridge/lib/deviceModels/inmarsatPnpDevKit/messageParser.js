'use strict';

const idpDefault = require('../idpDefault/messageParser');
const { round } = require('../../utilities');

function initialize(mobileId) {
  const patch = {
    manufacturer: 'Inmarsat',
    model: 'PNP Developer Kit',
    //swVersion: '',
    osName: 'Raspberry Pi OS',
    processorArchitecture: 'ARMv6',
    processorManufacturer: 'Broadcom',
    totalStorage: 16,
    totalMemory: 512,
    reportInterval: {
      value: 900,
      ac: 200,
      av: 1
    },
    qosInterval: {
      value: 60,
      ac: 200,
      av: 1
    }
  };
  return Object.assign({}, patch, idpDefault.initialize(mobileId));
}

function writeProperty(propName, propValue, version) {
  try {
    return idpDefault.writeProperty(propName, propValue, version);
  } catch (e) {
    if (!(e.message.includes('not writable'))) {
      throw e;
    }
  }
  let otaMessage = {
    completion: {
      property: propName,
      av: version,
    }
  };
  switch (propName) {
    case 'commandReportGet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 1,
        }
      };
      otaMessage.completion.value = true;
      otaMessage.completion.resetValue = false;
      break;
    case 'configSet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 2,
          fields: []
        }
      };  
      if (propValue.reportInterval) {
        if (propValue.reportInterval < 0 || propValue.reportInterval > 86400) {
          throw new Error(`reportInterval must be in range [0..86400]`);
        }
        otaMessage.command.payloadJson.fields.push({
          name: 'reportInterval',
          stringValue: `${propValue.reportInterval}`
        });
      }
      if (propValue.qosInterval) {
        if (propValue.qosInterval < 0 || propValue.qosInterval > 86400) {
          throw new Error(`qosInterval must be in range [0..86400]`);
        }
        otaMessage.command.payloadJson.fields.push({
          name: 'qosInterval',
          stringValue: `${propValue.qosInterval}`
        });
      }
      break;
    case 'textMobileTerminated':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 3,
          fields: [
            {
              name: 'text',
              stringValue: propValue
            }
          ]
        }
      };
      otaMessage.completion.value = propValue;
      break;
    case 'configGet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 4,
        }
      };
      otaMessage.completion.value = true;
      otaMessage.completion.resetValue = false;
      break;
    default:
      throw new Error(`Property ${propName} not writable via satellite`);
  }
  return otaMessage;
}

function parsePnpDevkit(context, message) {
  //context.log.verbose(`Parsing PNP Devkit fields: ${JSON.stringify(message)}`);
  const messageIsJson = (message.payloadJson && message.payloadJson !== null)
  let {telemetry, reportedProperties, timestamp } =
      idpDefault.parse(context, message);
  if (!messageIsJson) {
    context.log.warn(`Message definition file missing`
        + ` for Mailbox ID ${message.mailboxId}`);
  } else if (message.codecServiceId === 255) {
    switch(message.payloadJson.codecMessageId) {
      case 1:
        telemetry.tracking = {
          lat: round(telemetry.latitude/60000, 6),
          lon: round(telemetry.longitude/60000, 6),
          alt: round(telemetry.altitude, 0)
        };
        delete telemetry.latitude;
        delete telemetry.longitude;
        delete telemetry.altitude;
        telemetry.satelliteSnr = round(telemetry.snr / 10, 1);
        delete telemetry.snr;
        reportedProperties.location = Object.assign({}, telemetry.tracking);
        break;
      case 2:
      case 4:
        if (telemetry.reportInterval) {
          reportedProperties.reportInterval = telemetry.reportInterval;
          delete telemetry.reportInterval;
        }
        if (telemetry.qosInterval) {
          reportedProperties.qosInterval = telemetry.qosInterval;
          delete telemetry.qosInterval;
        }
        break;
      // Other cases pass through from idpDefault parser
      case 3:
        reportedProperties.textMobileOriginated = telemetry.text;
        break;
      default:
        context.log.warn(`Unrecognized message` +
            ` SIN 255 MIN ${message.payloadJson.codecMessageId}`);
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parse: parsePnpDevkit,
  writeProperty,
  initialize,
};
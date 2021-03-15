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

function writeProperty(propName, propValue) {
  if (idpDefault.writableProperties.includes(propName)) {
    return idpDefault.writeProperty(propName, propValue);
  }
  let otaMessage = {};
  switch (propName) {
    case 'commandReportGet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 1,
        }
      };
      otaMessage.completion = {
        codecServiceId: 255,
        codecMessageId: 1,
        property: propName,
        resetValue: false,
      };
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
      break;
    case 'configGet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 4,
          fields: []
        }
      };
      break;
  }
  //TODO: add additional writable properties / commands here
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
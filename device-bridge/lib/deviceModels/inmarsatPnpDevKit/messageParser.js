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
    //snr: 0,
    powerMode: {
      value: 0,
      ac: 200,
      av: 1
    },
    locationInterval: {
      value: 15,
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
    case 'reportGet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 1,
          fields: []
        }
      };
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
    case 'configGet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 4,
          fields: []
        }
      };
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
    context.log.warning(`Message definition file missing`
        + ` for Mailbox ID ${message.mailboxId}`);
  } else if (message.codecServiceId === 255) {
    switch(message.payloadJson.codecMessageId) {
      case 1:
        telemetry.latitude = round(telemetry.latitude/60000, 6);
        telemetry.longitude = round(telemetry.longitude/60000, 6);
        telemetry.snr = round(telemetry.snr / 10, 1);
        reportedProperties.location = {
          "lat": telemetry.latitude,
          "lon": telemetry.longitude,
          "alt": telemetry.altitude
        };
        break;
      case 2:
      case 4:
        if (telemetry.reportInterval) {
          reportedProperties.reportInterval = telemetry.reportInterval;
        }
        if (telemetry.qosInterval) {
          reportedProperties.qosInterval = telemetry.qosInterval;
        }
        break;
      // Other cases pass through from idpDefault parser
      case 3:
        reportedProperties.textMobileOriginated = telemetry.text;
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parse: parsePnpDevkit,
  writeProperty,
  initialize,
};
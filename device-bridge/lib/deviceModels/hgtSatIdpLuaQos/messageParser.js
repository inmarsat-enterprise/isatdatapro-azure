'use strict';

const idpDefault = require('../idpDefault/messageParser');
const { round } = require('../../utilities');

function initialize(mobileId) {
  const patch = {
    manufacturer: 'Honeywell',
    model: 'SAT-IDP',
    //swVersion: '',
    osName: 'proprietary',
    processorArchitecture: 'unknown',
    processorManufacturer: 'unknown',
    // totalStorage: 16,
    // totalMemory: 512,
    reportInterval: {
      'value': 900,
      'ac': 200,
      'av': 0,
      'ad': 'default'
    }
  };
  return Object.assign({}, patch, idpDefault.initialize(mobileId));
}

function otaCommand(commandName, data) {
  try {
    return idpDefault.otaCommand(commandName, data);
  } catch (e) {
    if (!(e.message.includes('defined'))) {
      throw e;
    }
  }
  let otaMessage = {};
  switch (commandName) {
    case 'commandConfigSet':
    case 'configSet':
      otaMessage.command = {
        payloadJson: {
          codecServiceId: 255,
          codecMessageId: 2,
          fields: []
        }
      };
      if (data.reportInterval) {
        if (data.reportInterval < 0 || data.reportInterval > 86400) {
          throw new Error(`reportInterval must be in range [0..86400]`);
        }
        otaMessage.command.payloadJson.fields.push({
          name: 'reportInterval',
          stringValue: data.reportInterval.toString()
        });
      }
      break;
    default:
      throw new Error(`No command defined for ${commandName}`);
  }
  return otaMessage;
}

function parseLuaQos(context, message) {
  //context.log.verbose(`Parsing PNP Devkit fields: ${JSON.stringify(message)}`);
  const messageIsJson = (message.payloadJson && message.payloadJson !== null)
  let {telemetry, reportedProperties, timestamp } =
      idpDefault.parse(context, message);
  if (message.codecServiceId === 48) {
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
  parse: parseLuaQos,
  // writeProperty,
  otaCommand,
  initialize,
};
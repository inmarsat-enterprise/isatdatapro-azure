'use strict';

// samplePayloadRaw = [48, 0, 2, 151, 91, 93, 212, 120, 32, 4, 140, 61, 112]

const idpDefault = require('../idpDefault/messageParser');
const { round, bytesToBin, uintToInt } = require('../../utilities');

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
  //context.log.verbose(`Parsing SAT-IDP QoS data`);
  const messageIsJson = (message.payloadJson && message.payloadJson !== null)
  let {telemetry, reportedProperties, timestamp } =
      idpDefault.parse(context, message);
  if (message.codecServiceId === 48) {
    const payloadBinary = bytesToBin(message.payloadRaw);
    const codecMessageId = message.payloadRaw[1];
    const controlWord = parseInt(payloadBinary.substr(16, 4));
    switch(controlWord) {
      case 0:   // custom 80-bit message
        telemetry.tracking = {
          lat: round(uintToInt(parseInt(payloadBinary.substr(16 + 4, 24), 2), 24) / 60000, 6),
          lon: round(uintToInt(parseInt(payloadBinary.substr(16 + 28, 25), 2), 25) / 60000, 6),
          // alt:
        };
        telemetry.speed = parseInt(payloadBinary.substr(16 + 53, 8), 2);
        telemetry.heading = parseInt(payloadBinary.substr(16 + 61, 9), 2);
        telemetry.hdop = parseInt(payloadBinary.substr(16 + 70, 5));
        telemetry.satelliteSnr = round(parseInt(payloadBinary.substr(16 + 75, 9), 2) / 10, 1);
        reportedProperties.location = Object.assign({}, telemetry.tracking);
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
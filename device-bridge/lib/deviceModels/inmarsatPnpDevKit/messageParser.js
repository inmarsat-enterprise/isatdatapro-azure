'use strict';

const idpDefault = require('../idpDefault/messageParser');
const { round } = require('../../utilities');

function writeProperty(propName, propValue) {
  if (idpDefault.writableProperties.includes(propName)) {
    return idpDefault.writeProperty(propName, propValue);
  }
  let otaMessage = {};
  switch (propName) {
    case 'locationInterval':
      //: An example using payloadRaw
      if (propValue < 0 || propValue > 1440) {
        throw new Error(`locationInterval must be in range [0..1440]`);
      }
      const intervalBytes = [
        (propValue & 0xff00) >> 8,
        (propValue & 0x00ff)
      ];
      otaMessage.command = {
        payloadRaw: ([255, 255]).concat(intervalBytes)
      };
  }
  //TODO: add additional writable properties / commands here
}

function parsePnpDevkit(context, message) {
  //context.log.verbose(`Parsing PNP Devkit fields: ${JSON.stringify(message)}`);
  const codecMessageId = message.payloadJson.codecMessageId;
  const messageIsJson = (message.payloadJson && message.payloadJson !== null)
  let {telemetry, reportedProperties, timestamp } =
      idpDefault.parse(context, message);
  if (!messageIsJson) {
    context.log.warning(`Message definition file missing`
        + ` for Mailbox ID ${message.mailboxId}`);
  } else if (message.codecServiceId === 255) {
    switch(codecMessageId) {
      case 255:
        telemetry.latitude = round(telemetry.latitude/60000, 6);
        telemetry.longitude = round(telemetry.longitude/60000, 6);
        telemetry.snr = round(telemetry.snr / 10, 1);
        telemetry.location = {
          "lat": telemetry.latitude,
          "lon": telemetry.longitude,
          "alt": telemetry.altitude
        };
        break;
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parse: parsePnpDevkit,
  writeProperty,
};
'use strict';

const idpDefault = require('../idpDefault/messageParser');
const { round } = require('../../utilities');

function writeProperty(propName, propValue) {
  if (idpDefault.writableProperties.includes(propName)) {
    return idpDefault.writeProperty(propName, propValue);
  }
  //TODO: add additional writable properties / commands here
}

function parsePnpDevkit(context, message) {
  //context.log.verbose(`Parsing PNP Devkit fields: ${JSON.stringify(message)}`);
  const codecMessageId = message.payloadJson.codecMessageId;
  const messageIsJson = (message.payloadJson && message.payloadJson !== null)
  let {telemetry, reportedProperties, timestamp } =
      idpDefault.parseGenericIdp(message);
  if (!messageIsJson) {
    context.log.warning(`Message definition file missing`
        + ` for Mailbox ID ${message.mailboxId}`);
  } else {
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
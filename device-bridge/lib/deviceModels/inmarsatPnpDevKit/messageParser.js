'use strict';

const { round, unixToDate } = require('../../utilities');
const { parseGenericIdp, writeProperty } = require('../idpDefault/messageParser');

function parsePnpDevkit(context, message) {
  //const reportedProperties = parseMetadata(context, message);
  //const fields = message.payloadJson.fields;
  //context.log.verbose(`Parsing PNP Devkit fields: ${JSON.stringify(fields)}`);
  const codecMessageId = message.payloadJson.codecMessageId;
  const {telemetry, reportedProperties, timestamp } = parseGenericIdp(message);
  if (message.codecServiceId === 255) {
    if (codecMessageId === 255) {
      telemetry.latitude = round(telemetry.latitude/60000, 6);
      telemetry.longitude = round(telemetry.longitude/60000, 6);
      telemetry.snr = round(telemetry.snr / 10, 1);
      reportedProperties.location = {
        "lat": telemetry.latitude,
        "lon": telemetry.longitude,
        "alt": telemetry.altitude
      };
    }
  }
  return { telemetry, reportedProperties, timestamp };
}

module.exports = {
  parse: parsePnpDevkit,
  writeProperty,
};
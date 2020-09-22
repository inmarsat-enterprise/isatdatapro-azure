'use strict';

const { round, unixToDate } = require('../../utilities');

function parsePnpDevkit(context, message) {
  const fields = message.payloadJson.fields;
  context.log.verbose(`Parsing PNP Devkit fields: ${JSON.stringify(fields)}`);
  const codecMessageId = message.payloadJson.codecMessageId;
  let telemetry = {};
  switch (codecMessageId) {
    case 255:
      for (let f=0; f < fields.length; f++) {
        let fieldName = fields[f].name;
        let fieldValue = fields[f].stringValue;
        switch (fieldName) {
          case 'timestamp':
            telemetry.fixTime = unixToDate(Number(fieldValue), true);
            break;
          case 'latitude':
            telemetry.latitude = round(Number(fieldValue)/60000, 6);
            break;
          case 'longitude':
            telemetry.longitude = round(Number(fieldValue)/60000, 6);
            break;
          case 'altitude':
            telemetry.altitude = Number(fieldValue);
            break;
          case 'speed':
            telemetry.speed = Number(fieldValue);
            break;
          case 'heading':
            telemetry.heading = Number(fieldValue);
            break;
          case 'snr':
            telemetry.snr = Number(fieldValue/10);
            break;
          case 'satellites':
            telemetry.gnssSatellites = Number(fieldValue);
            break;
          default:
            context.log.warn(`ST2100beta parser ignoring field ${fieldName}`);
        }
      }
      telemetry.location = {
        "lat": telemetry.latitude,
        "lon": telemetry.longitude,
        "alt": telemetry.altitude
      };
      break;
    default:
      context.log.warn(`Parsing not defined for codeMessageId ${codecMessageId}`);
  }
  return { telemetry };
}

module.exports = parsePnpDevkit;
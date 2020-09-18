const CODEC_SERVICE_ID = 255;
const { round, unixToDate } = require('../utilities');

function parseStBeta(context, message) {
  const fields = message.payloadJson.fields;
  context.log.verbose(`Parsing ST2100 Beta fields: ${JSON.stringify(fields)}`);
  const codecMessageId = message.payloadJson.codecMessageId;
  let measurements = {};
  switch (codecMessageId) {
    case 255:
      for (let f=0; f < fields.length; f++) {
        let fieldName = fields[f].name;
        let fieldValue = fields[f].stringValue;
        switch (fieldName) {
          case 'timestamp':
            measurements.fixTime = unixToDate(Number(fieldValue), true);
            break;
          case 'latitude':
            measurements.latitude = round(Number(fieldValue)/60000, 6);
            break;
          case 'longitude':
            measurements.longitude = round(Number(fieldValue)/60000, 6);
            break;
          case 'altitude':
            measurements.altitude = Number(fieldValue);
            break;
          case 'speed':
            measurements.speed = Number(fieldValue);
            break;
          case 'heading':
            measurements.heading = Number(fieldValue);
            break;
          case 'snr':
            measurements.snr = Number(fieldValue/10);
            break;
          case 'satellites':
            measurements.gnssSatellites = Number(fieldValue);
            break;
          default:
            context.log.warn(`ST2100beta parser ignoring field ${fieldName}`);
        }
      }
      measurements.location = {
        "lat": measurements.latitude,
        "lon": measurements.longitude,
        "alt": measurements.altitude
      };
      break;
    default:
      context.log.warn(`Parsing not defined for codeMessageId ${codecMessageId}`);
  }
  //context.log.verbose(`ST2100 parser returning ${JSON.stringify(measurements)}`);
  return measurements;
}

module.exports = {
  codecServiceId: CODEC_SERVICE_ID,
  parse: parseStBeta,
};
const CODEC_SERVICE_ID = 128;
const round = require('../utilities').round;

function parseUav(context, message) {
  const data = message.payloadJson.fields;
  context.log.verbose(`Parsing UAV data: ${JSON.stringify(data)}`);
  const codecMessageId = message.payloadJson.codecMessageId;
  let measurements = {};
  switch (codecMessageId) {
    case 1:
      for (let f=0; f < data.length; f++) {
        let fieldName = data[f].name;
        let fieldValue = data[f].stringValue;
        switch (fieldName) {
          case 'timestamp':
            measurements.timestamp = Number(fieldValue);
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
          case 'fixType':
            measurements.fixType = fieldValue;
            break;
          case 'numSats':
            measurements.gnssSatellites = Number(fieldValue);
            break;
          case 'hdop':
            measurements.hdop = Number(fieldValue);
            break;
          case 'msgNum':
            measurements.messageNumber = Number(fieldValue);
            break;
          default:
            context.log.warn(`Ignoring field ${fieldName}`);
        }
      }
      measurements.location = {
        "lat": measurements.latitude,
        "lon": measurements.longitude,
        "alt": measurements.altitude
      };
      const rxTime = new Date(message.receiveTimeUtc);
      const rxTimestamp = Math.round(rxTime.getTime() / 1000);
      measurements.latency = rxTimestamp - measurements.timestamp;
      measurements.messageSize = message.size;
      break;
    default:
      context.log.warn(`Parsing not defined for codeMessageId ${codecMessageId}`);
  }
  return measurements;
}

module.exports = {
  codecServiceId: CODEC_SERVICE_ID,
  parse: parseUav,
};
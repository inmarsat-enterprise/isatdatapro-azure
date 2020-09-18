const iotcUrl = process.env.IOTC_DEVICE_BRIDGE_URL;
const request = require('request-promise-native');

const normalizedPath = require('path').join(__dirname);
let iotcParsers = {};
let codecServiceIds = [];
require('fs').readdirSync(normalizedPath).forEach(file => {
  let moduleName = file.split('.')[0];
  if (moduleName !== 'index') {
    iotcParsers[moduleName] = require(`./${moduleName}`);
    codecServiceIds.push(iotcParsers[moduleName].codecServiceId);
  }
});

/**
 * Sends translated message data to an IOT Central Hub
 * @param {object} context Azure Function App context with log
 * @param {object} message a ReturnMessage
 * @returns {boolean} true if successfully parsed
 */
async function bridgeMessage(context, message) {
  context.log.verbose(`IOTC bridge processing ${message.messageId}`);
  let manufacturer = 'Unknown';
  if (message.mobileId.includes('SKY')) {
    manufacturer = 'ORBCOMM';
  }
  let iotcData = {
    "device": {
      "deviceId": `idp-${message.mobileId}`,
      "manufacturer": manufacturer,
      "serialNumber": message.mobileId
    },
    "timestamp": message.receiveTimeUtc,
  };
  // TODO: determine model ID probably lookup from database
  // iotcData.modelId = "";
  let parsed = false;
  for (const parserName in iotcParsers) {
    const parser = iotcParsers[parserName];
    if (parser.codecServiceId === message.codecServiceId) {
      context.log.verbose(`IOTC bridge parsing ${parserName} (SIN ${parser.codecServiceId})`);
      iotcData.measurements = parser.parse(context, message);
      let size = Object.keys(iotcData.measurements).length;
      context.log.verbose(`Received ${size} measurements`);
      if (size === 0) {
        throw new Error(`${parserName} failed to parse ${message.messageId}`);
      }
      parsed = true;
      break;
    }
  }
  if (parsed) {
    context.log.verbose(`Sending to IOTC bridge `
        + `${JSON.stringify(iotcData, null, 2)}`);
    const options = {
      method: 'POST',
      uri: iotcUrl,
      body: iotcData,
      json: true,
      resolveWithFullResponse: true,
    };
    request(options)
      .then((res) => {
        if (res.statusCode !== 200) {
          context.log.error(`IOTC bridge error: ${res.body}`);
          throw new Error(res.body);
        }
        context.log.info(`Sent message ${message.messageId} to IOTC bridge`);
      })
      .catch((e) => {
        context.log.error(e);
        throw e;
      });
  }
  return parsed;
}

module.exports = {
  parse: bridgeMessage
};
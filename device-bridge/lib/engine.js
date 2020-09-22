'use strict';

const iotHubTransport = require('azure-iot-device-mqtt').Mqtt;
const { Client, Message } = require('azure-iot-device');
const ProvisioningTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
const SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
const ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;
const crypto = require('crypto');

const provisioningHost = 'global.azure-devices-provisioning.net';
const idScope = process.env.IOTC_ID_SCOPE;
const groupSasKey = process.env.IOTC_GROUP_ENROLL_SAS_KEY;

const deviceCache = {};
let hubClient;

/**
 * Computes a derived device key using the primary key.
 * @param {string} deviceId The unique device ID
 * @returns {string} deviceKey
 */
async function getDeviceKey(deviceId) {
  if (deviceCache[deviceId] && deviceCache[deviceId].deviceKey) {
    return deviceCache[deviceId].deviceKey;
  }
  const key = crypto.createHmac('SHA256', Buffer.from(groupSasKey, 'base64'))
    .update(deviceId)
    .digest()
    .toString('base64');
  deviceCache[deviceId] = { deviceKey: key };
  return key;
}

/**
 * 
 * @param {Object} context Function app context (for logging)
 * @param {Object} telemetry Telemetry/measurement data
 * @param {string} [timestamp] Optional timestamp of telemetry
 * @param {*} schema 
 */
async function sendTelemetry(context, telemetry, timestamp, schema) {
  if (!telemetry) throw new Error(`No telemetry data supplied to send`);
  let message = new Message(JSON.stringify(telemetry));
  if (timestamp) {
    if (isNaN(Date.parse(timestamp))) {
      throw new Error(`Invalid format: if present, timestamp must be ` +
          ` ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ)`);
    } else {
      message.properties.add('iothub-creation-time-utc', timestamp);
    }
  }
  if (schema) message.properties.add('iothub-message-schema', schema);
  await hubClient.sendEvent(message, (err, res) => {
    context.log(`Sent telemetry: ${message.getData()}`
        + (err ? `; error: ${err.toString()}` : ``)
        + (res ? `; status: ${res.constructor.name}` : ``));
  });
}

/**
 * 
 * @param {Object} context Function app context (for logging)
 * @param {Object} twin 
 * @param {Object} properties 
 */
async function sendDeviceProperties(context, twin, properties) {
  await twin.properties.reported.update(properties, (err) => {
    context.log(`Sent device properties: ${JSON.stringify(properties)}`
        + (err ? `; error: ${err.toString()}` : `status: success`));
  });
}

/**
 * 
 * @param {Object} context Function app context (for logging)
 * @param {Object} writeableProperties 
 * @param {Object} twin 
 */
async function handleWriteablePropertyUpdates(context, writeableProperties, twin) {
  twin.on('properties.desired', (desiredChange) => {
    for (let setting in desiredChange) {
      if (writeableProperties[setting]) {
        context.log(`Received setting: ${setting}: ${desiredChange[setting]}`);
        writeableProperties[setting](
            desiredChange[setting],
            async (newValue, status, code) => {
          const patch = {
            [setting]: {
              value: newValue,
              ad: status,
              ac: code,
              av: desiredChange.$version
            }
          }
          await sendDeviceProperties(twin, patch);
        });
      }
    }
  });
}

async function setupCommandHandlers(context, methods, twin) {
  // Template: all functions over satellite link will be asynchronous
  function doSomething(request, response) {
    context.log(`Received asynchronous call to do something`);
    const responsePayload = { status: `doing ${request.payload}` };
    response.send(202, (err) => {
      if (err) {
        context.log.error(`Unable to send method response: ${err.toString()}`);
      } else {
        //simulate long response...need to manage with orchestrater
        setTimeout(async () => {
          const properties = { someProperty: { value: 'someValue' } };
          await sendDeviceProperties(twin, properties);
        }, 30000);
        context.log(responsePayload);
      }
    });
  }

  for (const method in methods) {
    hubClient.onDeviceMethod(method, methods[method]);
  }
}

/**
 * 
 * @param {*} context 
 * @param {*} properties 
 */
async function handleTwin(context, properties) {
  hubClient.getTwin(async (err, twin) => {
    if (err) {
      console.log(`Error getting device twin: ${err.toString()}`);
    } else {
      await sendDeviceProperties(twin, properties);
      if (device.model) {
        const deviceModels = require('./deviceModels');
        if (!deviceModels[device.model]) {
          context.log(`No device model for ${deviceModel}`);
        } else {
          const { writeableProperties, methods } = deviceModels[device.model];
          await handleWriteablePropertyUpdates(context, writeableProperties, twin);
          await setupCommandHandlers(context, methods, twin);
        }
      }
    }
  });
}

/**
 * Sends device information to IoT Hub/Central
 * @param {Object} context The function app context (for logging)
 * @param {Object} device 
 * @param {Object} [telemetry] 
 * @param {Object} [properties] 
 * @param {*} [timestamp] 
 */
async function bridge(context, device, telemetry, properties, timestamp) {
  let registrationId;
  if (device) {
    if (!device.deviceId || 
        !/^[a-zA-Z0-9-._:]*[a-zA-Z0-9-]+$/.test(device.deviceId)) {
      throw new Error(`Invalid format: deviceId must be alphanumeric and` +
          ` may contain '-', '.', '_', ':' where the` +
          ` last character must be alphanumeric or hyphen.`);
    }
    registrationId = device.deviceId;
  } else {
    throw new Error('Invalid format: a device specification must be provided.');
  }
  if (!telemetry && !properties) {
    throw new Error(`No telemetry or device properties provided.`);
  }
  const deviceSasKey = await getDeviceKey(registrationId);
  const provisioningSecurityClient =
      new SymmetricKeySecurityClient(registrationId, deviceSasKey);
  const provisioningClient = ProvisioningDeviceClient.create(
      provisioningHost,
      idScope,
      new ProvisioningTransport(),
      provisioningSecurityClient);
  const result = await provisioningClient.register();
  const connectionString = 
      `HostName=${result.assignedHub}` 
      + `;DeviceId=${result.deviceId}`
      + `;SharedAccessKey=${deviceSasKey}`;
  hubClient = Client.fromConnectionString(connectionString, iotHubTransport);
  await hubClient.open();
  if (telemetry) await sendTelemetry(context, telemetry, timestamp);
  if (properties) await handleTwin(context, properties);
  await hubClient.close();
}

module.exports = bridge;

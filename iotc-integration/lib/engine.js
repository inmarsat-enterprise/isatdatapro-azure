'use strict';

const iotHubTransport = require('azure-iot-device-mqtt').Mqtt;
const { Client, Message } = require('azure-iot-device');
const ProvisioningTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
const SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
const ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;

const provisioningHost = 'global.azure-devices-provisioning.net';
const idScope = process.env.IOTC_ID_SCOPE;
const symmetricKey = process.env.IOTC_SAS_KEY;

let hubClient;

function sendTelemetry(context, telemetry, timestamp, schema) {
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
  hubClient.sendEvent(message, (err, res) => {
    context.log(`Sent message: ${message.getData()}`
        + (err ? `; error: ${err.toString()}` : ``)
        + (res ? `; status: ${res.constructor.name}` : ``));
  });
}

function sendDeviceProperties(context, twin, properties) {
  twin.properties.reported.update(properties, (err) => {
    context.log(`Sent device properties: ${JSON.stringify(properties)}`
        + (err ? `; error: ${err.toString()}` : `status: success`));
  });
}

function handleWriteablePropertyUpdates(context, writeableProperties, twin) {
  twin.on('properties.desired', (desiredChange) => {
    for (let setting in desiredChange) {
      if (writeableProperties[setting]) {
        context.log(`Received setting: ${setting}: ${desiredChange[setting]}`);
        writeableProperties[setting](
            desiredChange[setting],
            (newValue, status, code) => {
          const patch = {
            [setting]: {
              value: newValue,
              ad: status,
              ac: code,
              av: desiredChange.$version
            }
          }
          sendDeviceProperties(twin, patch);
        });
      }
    }
  });
}

function setupCommandHandlers(context, methods, twin) {
  // Template: all functions over satellite link will be asynchronous
  function doSomething(request, response) {
    context.log(`Received asynchronous call to do something`);
    const responsePayload = { status: `doing ${request.payload}` };
    response.send(202, (err) => {
      if (err) {
        context.log.error(`Unable to send method response: ${err.toString()}`);
      } else {
        //simulate long response...need to manage with orchestrater
        setTimeout(() => {
          const properties = { someProperty: { value: 'someValue' } };
          sendDeviceProperties(twin, properties);
        }, 30000);
        context.log(responsePayload);
      }
    });
  }

  for (const method in methods) {
    hubClient.onDeviceMethod(method, methods[method]);
  }
}

function handleTwin(context, properties) {
  hubClient.getTwin((err, twin) => {
    if (err) {
      console.log(`Error getting device twin: ${err.toString()}`);
    } else {
      sendDeviceProperties(twin, properties);
      if (device.model) {
        const deviceModels = require('./deviceModels');
        if (!deviceModels[device.model]) {
          context.log(`No device model for ${deviceModel}`);
        } else {
          const { writeableProperties, methods } = deviceModels[device.model];
          handleWriteablePropertyUpdates(context, writeableProperties, twin);
          setupCommandHandlers(context, methods, twin);
        }
      }
    }
  });
}

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
  const provisioningSecurityClient = new SymmetricKeySecurityClient(
    registrationId, symmetricKey);
  const provisioningClient = ProvisioningDeviceClient.create(
      provisioningHost,
      idScope,
      new ProvisioningTransport(),
      provisioningSecurityClient);
  provisioningClient.register((err, result) => {
    if (err) {
      context.log.error(`Error registering device: ${err.toString()}`);
    } else {
      const connectionString = 
          `HostName=${result.assignedHub}` + 
          `;DeviceId=${result.deviceId}` +
          `;SharedAccessKey=${symmetricKey}`;
      hubClient = Client.fromConnectionString(connectionString, iotHubTransport);
      hubClient.open((err) => {
        if (err) {
          throw new Error(`Could not connect to IoT Hub: ${err.toString()}`);
        }
        if (telemetry) sendTelemetry(context, telemetry, timestamp);
        if (properties) handleTwin(context, properties);
      });
      hubClient.close();
    }
  });
}

module.exports = bridge;

/*
const crypto = require('crypto');
const request = require('request-promise-native');
const Device = require('azure-iot-device');
const DeviceTransport = require('azure-iot-device-http');

const registrationHost = 'global.azure-devices-provisioning.net';
const registrationSasTtl = 3600; // 1 hour
const registrationApiVersion = `2018-11-01`;
const registrationStatusQueryAttempts = 10;
const registrationStatusQueryTimeout = 2000;
const minDeviceRegistrationTimeout = 60 * 1000; // 1 minute

const deviceCache = {};
*/
/**
 * Forwards external telemetry messages for IoT Central devices.
 * @param {Object} context
 * @param {string} context.idScope The ScopeID from the IoTC application
 * @param {string} context.primaryKeyUrl The URL for the SAS key retrieval
 * @param {Function} context.log The logger for the function app
 * @param {(context: Object, secretUrl: string) => string} context.getSecret the function to get the secret
 * @param {{ deviceId: string }} device The unique device ID
 * @param {{ [field: string]: number }} measurements The set of measurements/data from the device
 * @param {string} [timestamp] Optional ISO timestamp of data
 * @param {string} [modelId] Optional model ID mapping to IOTC device template
 */
async function oldMethod(context, device, measurements, timestamp, modelId) {
  if (device) {
    if (!device.deviceId || !/^[a-zA-Z0-9-._:]*[a-zA-Z0-9-]+$/.test(device.deviceId)) {
      throw new Error(`Invalid format: deviceId must be alphanumeric and may contain '-', '.', '_', ':'.`
        + ` Last character must be alphanumeric or hyphen.`);
    }
  } else {
    throw new Error('Invalid format: a device specification must be provided.');
  }
  if (!validateMeasurements(measurements)) {
    throw new Error('Invalid format: invalid measurement list.');
  }
  if (timestamp && isNaN(Date.parse(timestamp))) {
    throw new Error(`Invalid format: if present, timestamp must be in ISO format `
      + `(e.g., YYYY-MM-DDTHH:mm:ss.sssZ)`);
  }
  // TODO: simplify to use SAS?
  const client = Device.Client.fromConnectionString(
    await getDeviceConnectionString(context, device),
    DeviceTransport.Http
  );
  try {
    const message = new Device.Message(JSON.stringify(measurements));
    message.contentEncoding = 'utf-8';
    message.contentType = 'application/json';
    if (timestamp) {
      message.properties.add('iothub-creation-time-utc', timestamp);
    }
    if (modelId) {
      client.setOptions({ modelId: modelId });
    }
    /* Obsolete, properties used for IoT Hub routing not IOTC properties
    for (const prop in device) {
      if (device.hasOwnProperty(prop) && prop == 'deviceId') {
        message.properties.add(prop, device[prop]);
      }
    }
    */
    await client.open();
    context.log('[HTTP] Sending telemetry for device', device.deviceId);
    await client.sendEvent(message);
    await client.close();
  } catch (e) {
    // If the device was deleted, we remove its cached connection string
    if (e.name === 'DeviceNotFoundError' && deviceCache[device.deviceId]) {
      delete deviceCache[device.deviceId].connectionString;
    }
    throw new Error(`Unable to send telemetry for device ${device.deviceId}: ${e.message}`);
  }
};

/**
 * @returns true if measurements object is valid, i.e., a map of field names to numbers or strings.
 */
function validateMeasurements(measurements) {
  if (!measurements || typeof measurements !== 'object') {
    return false;
  }
  return true;
}

/**
 * 
 * @param {*} context 
 * @param {*} device 
 * @returns {string} an IOTC device connection string
 */
async function getDeviceConnectionString(context, device) {
  const deviceId = device.deviceId;
  if (deviceCache[deviceId] && deviceCache[deviceId].connectionString) {
    return deviceCache[deviceId].connectionString;
  }
  //: else
  const connStr = `HostName=${await getDeviceHub(context, device)};`
                  + `DeviceId=${deviceId};`
                  + `SharedAccessKey=${await getDeviceKey(context, deviceId)}`;
  deviceCache[deviceId].connectionString = connStr;
  return connStr;
}

/**
 * Registers this device with DPS, returning the IoT Hub assigned to it.
 */
async function getDeviceHub(context, device) {
  const deviceId = device.deviceId;
  const now = Date.now();

  // A 1 minute backoff is enforced for registration attempts, to prevent unauthorized devices
  // from trying to re-register too often.
  if (deviceCache[deviceId] && deviceCache[deviceId].lasRegisterAttempt && (now - deviceCache[deviceId].lasRegisterAttempt) < minDeviceRegistrationTimeout) {
    const backoff = Math.floor((minDeviceRegistrationTimeout - (now - deviceCache[deviceId].lasRegisterAttempt)) / 1000);
    throw new Error(`Unable to register device ${deviceId}. Minimum registration timeout not yet exceeded. Please try again in ${backoff} seconds`, 403);
  }
  //: else
  deviceCache[deviceId] = {
    ...deviceCache[deviceId],
    lasRegisterAttempt: Date.now()
  }
  const sasToken = await getRegistrationSasToken(context, deviceId);
  const registrationOptions = {
    url: `https://${registrationHost}/${context.idScope}/registrations/${deviceId}/register?api-version=${registrationApiVersion}`,
    method: 'PUT',
    json: true,
    headers: { Authorization: sasToken },
    body: { registrationId: deviceId }
  };
  try {
    context.log('[HTTP] Initiating device registration');
    const response = await request(registrationOptions);
    if (response.status !== 'assigning' || !response.operationId) {
      throw new Error('Unknown server response');
    }
    //: else
    const statusOptions = {
      url: `https://${registrationHost}/${context.idScope}/registrations/${deviceId}/operations/${response.operationId}?api-version=${registrationApiVersion}`,
      method: 'GET',
      json: true,
      headers: { Authorization: sasToken }
    };
    // The first registration call starts the process, we then query the registration status
    // every 2 seconds, up to 10 times.
    for (let i = 0; i < registrationStatusQueryAttempts; ++i) {
      await new Promise(resolve => setTimeout(resolve, registrationStatusQueryTimeout));
      context.log('[HTTP] Querying device registration status');
      const statusResponse = await request(statusOptions);
      if (statusResponse.status === 'assigning') {
        continue;
      } else if (statusResponse.status === 'assigned' && statusResponse.registrationState && statusResponse.registrationState.assignedHub) {
        return statusResponse.registrationState.assignedHub;
      } else if (statusResponse.status === 'failed' && statusResponse.registrationState && statusResponse.registrationState.errorCode === 400209) {
        throw new Error('The device may be unassociated or blocked', 403);
      } else {
        throw new Error('Unknown server response');
      }
    }
    throw new Error('Registration was not successful after maximum number of attempts');
  } catch (e) {
    throw new Error(`Unable to register device ${deviceId}: ${e.message}`, e.statusCode);
  }
}

/**
 * 
 * @param {*} context 
 * @param {*} deviceId 
 * @returns {string} shared access signature
 */
async function getRegistrationSasToken(context, deviceId) {
  const uri = encodeURIComponent(`${context.idScope}/registrations/${deviceId}`);
  const ttl = Math.round(Date.now() / 1000) + registrationSasTtl;
  const signature = crypto.createHmac('sha256', new Buffer(await getDeviceKey(context, deviceId), 'base64'))
    .update(`${uri}\n${ttl}`)
    .digest('base64');
  return `SharedAccessSignature sr=${uri}&sig=${encodeURIComponent(signature)}&skn=registration&se=${ttl}`;
}

/**
 * Computes a derived device key using the primary key.
 */
async function getDeviceKey(context, deviceId) {
  if (deviceCache[deviceId] && deviceCache[deviceId].deviceKey) {
    return deviceCache[deviceId].deviceKey;
  }
  const key = crypto.createHmac('SHA256', Buffer.from(await context.getSecret(context, context.primaryKeyUrl), 'base64'))
    .update(deviceId)
    .digest()
    .toString('base64');
  deviceCache[deviceId].deviceKey = key;
  return key;
}
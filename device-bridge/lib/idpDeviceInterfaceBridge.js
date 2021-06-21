/*
 * Functions implementing the IoT Central / IoT Hub device bridge for IDP
 */
'use strict';

const IotHubTransport = require('azure-iot-device-mqtt').Mqtt;
//const multiplexIotHubTransport = require('azure-iot-device-amqp').Amqp;
const { Client, Message } = require('azure-iot-device');
const IotDpsTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
//const multiplexProvisioningTransport = require('azure-iot-provisioning-device-amqp').Amqp;
const SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
const ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;
const crypto = require('crypto');
const _ = require('lodash');
const uuid = require('uuid').v4;

const provisioningHost = 'global.azure-devices-provisioning.net';
const idScope = process.env.IOTC_ID_SCOPE;
const groupSasKey = process.env.IOTC_GROUP_ENROLL_SAS_KEY;

const deviceCache = {};
let hubClient;

const testMode = process.env.testMode;

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
 * Sends device telemetry data to the IoT Hub
 * @param {Object} context Function app context (for logging)
 * @param {Object} device Device metadata
 * @param {Object} device.telemetry Telemetry/measurement data
 * @param {string} [device.timestamp] Optional timestamp of telemetry
 * @param {*} schema 
 */
async function sendTelemetry(context, device, schema) {
  if (!device || !device.telemetry) {
    throw new Error(`No telemetry data supplied to send`);
  }
  let message = new Message(JSON.stringify(device.telemetry));
  if (device.timestamp) {
    if (isNaN(Date.parse(device.timestamp))) {
      throw new Error(`Invalid format: if present, timestamp must be ` +
          ` ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ)`);
    } else {
      message.properties.add('iothub-creation-time-utc', device.timestamp);
    }
  }
  if (schema) message.properties.add('iothub-message-schema', schema);
  try {
    if (testMode) {
      context.log.warn(`Test mode enabled not sending telemetry` +
          ` ${message.getData()}`);
    } else {
      const res = await hubClient.sendEvent(message)
      context.log(`Sent ${device.id} telemetry: ${message.getData()}` +
          (res ? `; status: ${res.constructor.name}` : ``));
    }
  } catch (e) {
    context.log.error(`Failed to send telemetry: ${e.stack}`);
  }
}

/**
 * Publishes an EventGrid event `CommandRequest` for orchestrator handling
 * @param {Object} context Azure Function context for logging
 * @param {Object} otaCommand An OTA command structure
 * @param {string} [subject] Optional event subject to override default
 */
function commandRequest(context, otaCommand, subject) {
  const event = {
    id: uuid(),
    subject: subject || `OTA command for ${otaCommand.mobileId}`,
    dataVersion: '2.0',
    eventType: 'OtaCommandRequest',
    data: otaCommand,
    eventTime: new Date().toISOString()
  };
  if (testMode) {
    context.log.warn(`Test mode enabled, not publishing to EventGrid: ` +
        + ` ${JSON.stringify(event)}`);
  } else {
    context.log.info(`Publishing ${JSON.stringify(event)} to EventGrid`);
    context.bindings.outputEvent.push(event);
  }
}

/**
 * Processes an offline command to populate a `commandRequest`
 * @param {Object} context The Azure Function context for logging
 * @param {Object} device The device the command is being sent to
 * @param {Object} msg An IoT Hub offline cloud-to-device message
 */
function offlineCommand(context, device, msg) {
  context.log.verbose(`Processing offline command ${JSON.stringify(msg)}`);
  let commandName;
  let decodedData;
  const { messageId, expiryTimeUtc, lockToken, correlationId, userId } = msg;
  if (!msg.properties) throw new Error('Command missing properties');
  if (!msg.properties.propertyList) throw new Error('Command missing propertyList');
  for (let i=0; i < msg.properties.propertyList.length; i++) {
    if (msg.properties.propertyList[i].key === 'method-name') {
      commandName = msg.properties.propertyList[i].value;
      break;
    }
  }
  if (!commandName) throw new Error('No command name found');
  if (commandName.includes(':')) {
    const parts = commandName.split(':');
    context.log.verbose(`Schema: ${JSON.stringify(parts)}`);
    // const componentName = parts[0];
    commandName = parts[parts.length - 1];
  }
  try {
    decodedData = JSON.parse(msg.getData().toString());
  } catch (e) {
    decodedData = msg.getData().toString();
  }
  try {
    const otaCommand = Object.assign({ mobileId: device.mobileId },
        device.lib.otaCommand(commandName, decodedData));
    const subject = `Command ${commandName} to ${device.mobileId}`;
    commandRequest(context, otaCommand, subject);
    hubClient.complete(msg, function(err) {
      if (err) {
        context.log.error(`IoT Hub Client complete error ${JSON.stringify(err)}`);
      } else {
        context.log.info(`IoT Hub Client completed offline command`);
      }
    });
  } catch (e) {
    context.log.error(e.stack);
  }
}

/**
 * Sets up an Over-The-Air property write for the orchestrator.
 * Returns a patch object for Azure device twin and EventGrid event object.
 * @param {Object} context An Azure Function context for logging
 * @param {Object} device The device metadata
 * @param {string} propName The property name to write
 * @param {*} propValue The value to write to the property
 * @param {number} version The twin.desired.properties $version
 * @returns {Object} property patch for write operation
 */
function otaWriteProperty(context, device, propName, propValue, version) {
  let patch = {};
  try {
    context.log.verbose(`Deriving write operation for ${propName}`);
    const otaCommand = Object.assign({ mobileId: device.mobileId },
        device.lib.writeProperty(propName, propValue, version));
    context.log.verbose(`Triggering write ${propName} = ${propValue}`);
    patch[propName] = {
      value: propValue,
      ad: 'pending OTA write',
      ac: 202,
      av: version,
    };
    const subject = `Set IOTC desired property` +
        ` ${propName}=${propValue} for ${device.mobileId}`;
    commandRequest(context, otaCommand, subject);
  } catch (e) {
    context.log.error(e.message);
    patch[propName] = {
      value: propValue,
      ac: 400,
      ad: e.message,
      av: version
    };
  }
  return patch;
}

/**
 * Updates a device with reported properties.
 * Checks for desired properties (including proxy commands) and triggers 
 * `CommandRequest` events if applicable
 * @param {Object} context The app function context (logging)
 * @param {Object} device The device metadata
 * @param {Object} [device.reportedProperties] The set of properties to update
 * @param {Object} twin The digital twin of the device
 */
async function updateDevice(context, device, twin) {
  context.log.verbose(`Processing updates for device ${device.id}`);
  let patch = {};
  //: If no prior reported properties then initialize
  if (twin.properties.desired.$version === 1) {
    if (twin.properties.reported.$version <= 1) {
      context.log.info(`Initializing ${device.id} as ${device.model}`);
      patch = device.lib.initialize(device.mobileId);
    }
  } else if (twin.properties.desired.$version > 1) {
    let delta = twin.properties.desired;
    //: Check for completed desired properties
    if (device.patch) {
      for (const propName in device.patch) {
        if (propName in delta) {
          patch[propName] = device.patch[propName];
          if (delta.$version !== device.patch[propName].av) {
            context.log.warn(`Version mismatch expected ${delta.$version}` +
                ` got ${device.patch[propName].av}`);
            patch[propName].av = delta.$version;
          }
          //: Remove from desired list to avoid generating a new command
          delete delta[propName];
          context.log.info(`Desired property ${propName}` +
              ` version ${delta.$version} completed`);
        }
      }
    }
    for (const propName in delta) {
      if (propName === '$version') continue;
      if (!(propName in twin.properties.reported)) {
        context.log.warn(`${device.id} ${propName} not found` +
            ` in twin.properties.reported`);
      }
      const reported = twin.properties.reported[propName];
      if (reported.value === delta[propName]) {
        context.log.verbose(`${device.id} ${propName} reported matches desired`);
        if (reported.ac === 202) {
          context.log.warn(`${device.id} ${propName} pending - completing`);
          if (!patch[propName]) {
            patch[propName] = {
              value: reported.value,
              ac: 200,
              ad: 'presumed closed independently',
              av: delta.version,
            };
          }
        }
        continue;
      } else if (reported.ac === 202) {
        context.log.info(`${device.id} ${propName} pending` +
            ` value: ${delta[propName]} version: ${delta.$version}`);
        continue;
      }
      const writePatch = otaWriteProperty(context, device,
          propName, delta[propName], delta.$version);
      patch = Object.assign(patch, writePatch);
    }
  }
  //: Update read-only and writable properties
  if (device.reportedProperties || patch) {
    const update = Object.assign({}, device.reportedProperties, patch);
    for (const prop in update) {
      if (update[prop] === null) {
        context.log.warn(`Removing null value for ${prop}`);
        delete update[prop];
      }
    }
    if (!_.isEmpty(update)) {
      if (testMode) {
        context.log.warn(`Test mode enabled not updating properties:` +
            ` ${JSON.stringify(update)}`);
      } else {
        const err = await twin.properties.reported.update(update);
        context.log(`Sent ${device.id} properties: ${JSON.stringify(update)}` +
            (err ? `; error: ${err.toString()}` : ` status: success`));
      }
    }
  }
}

/**
 * Gets the device twin from IoT Hub and updates it
 * @param {Object} context Azure Function context for logging
 * @param {Object} device Device metadata
 */
async function handleTwin(context, device) {
  try {
    context.log.verbose(`Getting IoT Hub Twin for ${device.id}`);
    const twin = await hubClient.getTwin();
    await updateDevice(context, device, twin);
  } catch (e) {
    context.log.error(e.stack);
  }
}

/**
 * Sends device information to IoT Hub/Central
 * @param {Object} context The function app context (for logging)
 * @param {Object} device The device metadata
 * @param {string} device.id The unique (IoT Hub/Central) ID
 * @param {string} device.model The device model
 * @param {string} device.mobileId The unique IDP modem identifier
 * @param {Object} [device.telemetry] A set of telemetry
 * @param {Object} [device.reportedProperties] A set of reported properties
 * @param {Object} [device.patch] Delayed property write updates
 * @param {string} [device.timestamp] ISO8601 compliant timestamp
 */
async function azureIotDeviceBridge(context, device) {
  if (!device) {
    throw new Error('No device supplied to bridge');
  }
  if (!device.id || 
      !/^[a-zA-Z0-9-._:]*[a-zA-Z0-9-]+$/.test(device.id)) {
    throw new Error(`Invalid format: deviceId must be alphanumeric and` +
        ` may contain '-', '.', '_', ':'` +
        ` where the last character must be alphanumeric or hyphen.`);
  }
  if (!device.model) {
    throw new Error(`No device model defined for ${device.id}`);
  }
  context.bindings.outputEvent = [];
  device.lib = require('./deviceModels')[device.model];
  const registrationId = device.id;
  context.log.verbose(`Getting device ${device.id} SAS key`);
  const deviceSasKey = await getDeviceKey(registrationId);
  context.log.verbose(`Getting provisioning security client`);
  const provisioningSecurityClient =
      new SymmetricKeySecurityClient(registrationId, deviceSasKey);
  context.log.verbose(`Creating provisioning device client`);
  const provisioningClient = await ProvisioningDeviceClient.create(
      provisioningHost,
      idScope,
      new IotDpsTransport(),
      provisioningSecurityClient);
  context.log.verbose(`Registering provisioning client`);
  const result = await provisioningClient.register();
  const connectionString = 
      `HostName=${result.assignedHub}` +
      `;DeviceId=${result.deviceId}` +
      `;SharedAccessKey=${deviceSasKey}`;
  context.log.verbose(`Connecting to IoT Hub ${result.assignedHub}`);
  hubClient = Client.fromConnectionString(connectionString, IotHubTransport);
  //: Prepare to receive offline commands
  hubClient.on('message', function(msg) {
    context.log.verbose(`Received offline command ${JSON.stringify(msg)}`);
    const commandResult = offlineCommand(context, device, msg);
    hubClient.complete(msg, function(err) {
      if (err) {
        context.log.error(`Command complete error: ${err.toString()}`);
      } else {
        context.log.info('Command ' + commandResult ? 'succeeded' : 'failed');
      }
    });
  });
  //: Automated provisioning if modelId is known
  // if (device.modelId) {
  //   hubClient.setOptions({ modelId: device.modelId });
  // }
  await hubClient.open();
  if (device.telemetry) await sendTelemetry(context, device);
  await handleTwin(context, device);
  await hubClient.close();
}

module.exports = azureIotDeviceBridge;

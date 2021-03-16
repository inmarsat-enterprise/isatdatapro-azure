/*
 * Functions implementing the IoT Central / IoT Hub device bridge for IDP
 */
'use strict';

const singleIotHubTransport = require('azure-iot-device-mqtt').Mqtt;
//const multiplexIotHubTransport = require('azure-iot-device-amqp').Amqp;
const { Client, Message } = require('azure-iot-device');
const singleProvisioningTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
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
    const res = await hubClient.sendEvent(message)
    context.log(`Sent ${device.id} telemetry: ${message.getData()}`
        + (res ? `; status: ${res.constructor.name}` : ``));
  } catch (e) {
    context.log.error(`Failed to send telemetry: ${e.stack}`);
  }
}

/**
 * Updates writable properties with version
 * @param {Object} properties The reported properties
 * @param {number} version 
 */
function updateWritableProperties(properties, version) {
  const patch = Object.assign({}, properties);
  for (const propName in properties) {
    if (typeof(properties[propName]) === 'object') {
      patch[propName].av = version;
    }
  }
  return patch;
}

/**
 * Updates a SatelliteGateway
 * @param {Object} context The Azure Function context for logging
 * @param {Object} device The Satellite Gateway modeled as a device 
 * @param {Object} [device.properties] Optional properties to update
 * @param {string} [device.properties.name]
 * @param {string} [device.properties.url]
 * @param {Object} twin The satelliteGateway twin obtained from the IoT Hub
 */
async function updateSatelliteGateway(context, device, twin) {
  context.log.warn(`Satellite Gateway update not yet supported...`);
  return;
  if (twin.properties.desired) {
    if (twin.properties.desired['$version'] === 1) {
      if (twin.properties.reported.$version > 1) {
        context.log.warn(`${device.id}`
            + ` $version=${twin.properties.reported.$version}`
            + ` but requesting $version=1`);
        return;
      } else {
        if (twin.properties.desired.name || twin.properties.desired.url) {
          const event = {
            id: uuid(),
            subject: `Satellite Gateway update for ${device}`,
            dataVersion: '2.0',
            eventType: 'SatelliteGatewayUpdate',
            data: {
              name: twin.properties.desired.name,
              url: twin.properties.desired.url,
            },
            eventTime: new Date().toISOString()
          };
          context.log.verbose(`Publishing ${JSON.stringify(event)}`);
          context.bindings.outputEvent = event;
        }
      }
    }
  }
  if (device.properties) {
    const version = twin.properties.reported.$version;
    const err = await twin.properties.reported.update(
        updateWritableProperties(device.properties, version));
    if (err) context.log.error(err);
  }
}

/**
 * Updates a Mailbox 
 * @param {Object} context The Azure Function context for logging
 * @param {Object} device The Mailbox modeled as a device
 * @param {Object} [device.properties] Optional mailbox properties to update
 * @param {string} [device.properties.name] Mailbox name
 * @param {string} [device.properties.satelliteGatewayName] 
 * @param {string} [device.properties.mailboxId] Mailbox name
 * @param {string} [device.properties.accessId] Mailbox name
 * @param {string} [device.properties.password] Mailbox name
 * @param {Object} twin The mailbox twin obtained from the IoT Hub
 */
async function updateMailbox(context, device, twin) {
  context.log.warn(`Mailbox updates not yet supported...`);
  return;
  if (twin.properties.desired) {
    if (twin.properties.desired['$version'] === 1) {
      if (twin.properties.reported.$version > 1) {
        context.log.warn(`${device.id}`
            + ` $version=${twin.properties.reported.$version}`
            + ` but requesting $version=1`);
        return;
      } else {
        if (twin.properties.desired.length > 1) {
          const event = {
            id: uuid(),
            subject: `Mailbox data for ${twin.properties.desired.mailboxId}`,
            dataVersion: '2.0',
            eventType: 'MailboxUpdate',
            data: {
              name: twin.properties.desired.name,
              satelliteGatewayName: twin.properties.desired.satelliteGatewayName,
              mailboxId: twin.properties.desired.mailboxId,
              accessId: twin.properties.desired.accessId,
              password: twin.properties.desired.password,
            },
            eventTime: new Date().toISOString()
          };
          context.log.verbose(`Publishing ${JSON.stringify(event)}`);
          context.bindings.outputEvent = event;
        }
      }
    }
  }
  if (device.properties) {
    const version = twin.properties.reported.$version;
    const err = await twin.properties.reported.update(
        updateWritableProperties(device.properties, version));
    if (err) context.log.error(err);
  }
}

/**
 * A placeholder for offline (asynchronous) commands
 * @param {Object} context 
 * @param {Object} msg 
 */
function offlineCommand(context, msg) {
  context.log.verbose(`Processing ${JSON.stringify(msg)}`);
  hubClient.complete(msg, function(err) {
    if (err) {
      context.log.error(err.stack);
    } else {
      context.log.warn('Command should be submitted');
    }
  });
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
  let patch;
  //: Not using twin.on('properties.desired') since it won't trigger immediate
  if (twin.properties.desired) {
    if (!device.model) {
      throw new Error(`No device model defined for ${device.id}`);
    }
    const deviceModel = require('./deviceModels')[device.model];
    patch = {};
    const writableProperties = [];
    const delta = Object.assign({}, twin.properties.desired);
    context.log.verbose(`${device.id} desired property changes:`
        + ` ${JSON.stringify(delta)}`);
    if (delta['$version'] === 1) {
      if (twin.properties.reported.$version > 1) {
        context.log.warn(`${device.id}` +
            ` $version=${twin.properties.reported.$version}` +
            ` but requesting $version=1`);
      }
      context.log.info(`Initializing ${device.id} as ${device.model}`);
      patch = deviceModel.initialize(device.mobileId);
      context.log.verbose(`Patching ${JSON.stringify(patch)}`);
    }
    //: Reported properties if writable are completed
    //:  This functionality does not work for "trigger" commands the
    //:  reported property does not overwrite the configuration "true" setting.
    if (device.patch) {
      for (const propName in device.patch) {
        if (propName in delta) {
          patch[propName] = device.patch[propName];
          if (delta.$version !== device.patch[propName].av) {
            context.log.warn(`Version mismatch expected ${delta.$version}` +
                ` got ${device.patch[propName].av}`);
          }
          //: TBD Remove reported property to avoid generating a new command
          delete delta[propName];
          context.log.verbose(`Desired property ${propName}` +
              ` version ${delta.$version} completed`);
        }
      }
    }
    for (const propName in delta) {
      //: If writable in the device model get the OTA command setup
      if (propName === '$version') continue;
      context.log.verbose(`Assessing desired change to ${propName}`);
      if (propName in twin.properties.reported &&
          twin.properties.reported[propName].value === delta[propName] &&
          twin.properties.reported[propName].av >= delta.$version) {
        context.log.verbose(`${device.id} ${propName} pending` +
            ` value: ${delta[propName]}`);
        continue;
      }
      let writable;
      try {
        context.log.verbose(`Deriving write operation for ${propName}`);
        writable = deviceModel.writeProperty(propName, delta[propName], delta.$version);
      } catch (e) {
        context.log.error(e.message);
        patch[propName] = {
          value: delta[propName],
          ac: 400,
          ad: e.message,
          av: delta.$version
        };
      }
      if (writable === null) {
        patch[propName] = {
          value: delta[propName],
          ad: 'reset',
          ac: 200,
          av: delta.$version,
        };
      }
      if (writable) {
        if (twin.properties.reported[propName] &&
            twin.properties.desired[propName] ===
            twin.properties.reported[propName].value) {
          context.log.verbose(`${device.id} ${propName} desired === reported` +
              ` (skipping write)`);
          continue;
        }
        context.log.verbose(`Triggering write ${propName} =` +
            ` ${twin.properties.desired[propName]}`);
        patch[propName] = {
          value: delta[propName],
          ad: 'triggered',
          ac: 202,
          av: delta.$version,
        };
        writable.mobileId = device.mobileId;
        writableProperties.push(writable);
      }
    }
    if (writableProperties.length > 0) {
      context.log.verbose(`Processing ${writableProperties.length} OTA writes`);
      context.bindings.outputEvent = [];
      writableProperties.forEach(prop => {
        context.log.verbose(`Processing command ${JSON.stringify(prop.command)}`);
        //: publish event to EventGrid for orchestrator
        const event = {
          id: uuid(),
          subject: `IOTC Desired property ${prop.property}=${prop.newValue}`
              + ` for ${device.mobileId}`,
          dataVersion: '2.0',
          eventType: 'CommandRequest',
          data: prop,
          eventTime: new Date().toISOString()
        };
        context.log.info(`Publishing ${JSON.stringify(event)} to EventGrid`);
        context.bindings.outputEvent.push(event);
      });
    }
  };
  if (device.reportedProperties || patch) {
    const update = Object.assign({}, device.reportedProperties, patch);
    for (const prop in update) {
      if (update[prop] === null) {
        context.log.warn(`Removing null value for ${prop}`);
        delete update[prop];
      }
    }
    if (!_.isEmpty(update)) {
      const err = await twin.properties.reported.update(update);
      context.log(`Sent ${device.id} properties: ${JSON.stringify(update)}` +
          (err ? `; error: ${err.toString()}` : ` status: success`));
    }
  }
  if (device.extraPatch) {
    const extraPatch = device.extraPatch;
    const err = await twin.properties.reported.update(extraPatch);
    context.log(`Special patch ${device.id} ${JSON.stringify(extraPatch)}` +
        (err ? `; error: ${err.toString()}` : ` status: success`));
  }
}

/**
 * 
 * @param {Object} context 
 * @param {Object} device
 * @param {Object} [device.properties]
 */
async function handleTwin(context, device) {
  try {
    context.log.verbose(`Getting IoT Hub Twin for ${device.id}`);
    const twin = await hubClient.getTwin();
    if (device.model.includes('satelliteGateway')) {
      updateSatelliteGateway(context, device, twin);
      //: Checking for new or configuration change of API
    } else if (device.model.includes('mailbox')) {
      updateMailbox(context, device, twin);
      //: Checking for new or configuration change credentials
    } else {
      //: Actual device
      await updateDevice(context, device, twin);
    }
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
 * @param {Object} [device.properties] A set of reported properties
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
      new singleProvisioningTransport(),
      provisioningSecurityClient);
  context.log.verbose(`Registering provisioning client`);
  const result = await provisioningClient.register();
  const connectionString = 
      `HostName=${result.assignedHub}` +
      `;DeviceId=${result.deviceId}` +
      `;SharedAccessKey=${deviceSasKey}`;
  context.log.verbose(`Connecting to IoT Hub ${result.assignedHub}`);
  hubClient = Client.fromConnectionString(connectionString, singleIotHubTransport);
  await hubClient.open();
  hubClient.on('message', function(msg) {
    context.log.verbose(`Received offline command ${JSON.stringify(msg)}`);
    offlineCommand(context, msg);
  });
  if (device.telemetry) await sendTelemetry(context, device);
  await handleTwin(context, device);
  await hubClient.close();
}

module.exports = azureIotDeviceBridge;

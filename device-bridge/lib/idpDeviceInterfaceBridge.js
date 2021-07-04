/*
 * Functions implementing the IoT Central / IoT Hub device bridge for IDP
 */
'use strict';

const IotHubTransport = require('azure-iot-device-mqtt').Mqtt;
const { Client, Message } = require('azure-iot-device');
const IotDpsTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
const SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
const ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;
const crypto = require('crypto');
const _ = require('lodash');
const uuid = require('uuid').v4;
const { buildTemplate } = require('./iotcDeviceApi');
//TODO: Future consideration if more scalable
//const multiplexIotHubTransport = require('azure-iot-device-amqp').Amqp;
//const multiplexProvisioningTransport = require('azure-iot-provisioning-device-amqp').Amqp;

const telemetryComponentSubjectProperty = '$.sub';
const defaultComponentName = 'default';

const provisioningHost = (process.env.IOTHUB_DEVICE_DPS_ENDPOINT ||
    'global.azure-devices-provisioning.net');
const idScope = process.env.IOTC_ID_SCOPE;
const groupSasKey = process.env.IOTC_GROUP_ENROLL_SAS_KEY;

const deviceCache = {};
let hubClient;

const testMode = (process.env.testMode === 'true');

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
  if (!deviceCache[deviceId]) deviceCache[deviceId] = {};
  deviceCache[deviceId].deviceKey = key;
  return key;
}

/**
 * Returns the Azure IOT device template
 * @param {Object} device 
 * @returns {Object} template
 */
function getTemplate(device) {
  if (!device.modelName || !device.id) {
    throw new Error(`Device model or id not provided`);
  }
  if (deviceCache[device.id] && deviceCache[device.id].template) {
    return deviceCache[device.id].template;
  }
  const template =
      buildTemplate(require('./deviceTemplates/templates')[device.modelName]);
  if (!deviceCache[device.id]) deviceCache[device.id] = {};
  deviceCache[device.id].template = template;
  return template;
}

/**
 * Returns an Object with component tags including a default
 * @param {Object} context 
 * @param {Object} device 
 * @returns 
 */
function getComponentModel(context, device) {
  if (!device.modelName) throw new Error(`Missing device model`);
  const template = getTemplate(device);
  const capabilities = template.capabilityModel.contents;
  if (!capabilities) {
    throw new Error(`No contents found in ${device.modelName} capabilityModel`);
  }
  const components = {};
  components[defaultComponentName] = {};
  for (let c = 0; c < capabilities.length; c++) {
    const capability = capabilities[c];
    if (capability['@type'] === 'Component') {
      if (!components[capability.name]) {
        context.log.verbose(`Found Component ${capability.name}`);
        components[capability.name] = {};
      }
    }
  }
  return components;
}

/**
 * Returns the component name for a given tag, or the default
 * @param {Object} template The device template
 * @param {*} tag The tag name to find
 * @returns {string}
 */
function getComponentName(template, tag) {
  if (!template) throw new Error(`No device template provided`);
  if (!template.capabilityModel || !template.capabilityModel.contents) {
    throw new Error(`Capability model contents not provided`);
  }
  const capabilities = template.capabilityModel.contents;
  for (let c = 0; c < capabilities.length; c++) {
    const capability = capabilities[c];
    if (capability['@type'] === 'Component') {
      if (!capability.schema || !capability.schema.contents) {
        throw new Error(`Component ${capability.name} schema or contents` +
            ` undefined`);
      }
      for (let cc = 0; cc < capability.schema.contents.length; cc++) {
        const componentCapability = capability.schema.contents[cc];
        if (componentCapability.name === tag) {
          return capability.name;
        }
      }
    }
  }
  return defaultComponentName;
}

/**
 * Sends device telemetry data to the IoT Hub
 * @param {Object} context Function app context (for logging)
 * @param {Object} device Device metadata
 * @param {Object} device.telemetry Telemetry/measurement data
 * @param {string} [device.timestamp] Optional timestamp of telemetry
 */
async function sendTelemetry(context, device) {
  if (!device || !device.telemetry) {
    throw new Error(`No telemetry data supplied to send`);
  }
  const template = getTemplate(device);
  const componentTelemetry = getComponentModel(context, device);
  for (const tag in device.telemetry) {
    const component = getComponentName(template, tag);
    componentTelemetry[component][tag] = device.telemetry[tag];
  }
  for (const component in componentTelemetry) {
    if (_.isEmpty(componentTelemetry[component])) continue;
    const message = new Message(JSON.stringify(componentTelemetry[component]));
    message.contentType = 'application/json';
    message.contentEncoding = 'utf-8';
    if (component !== defaultComponentName) {
      message.properties.add(telemetryComponentSubjectProperty, component);
    }
    if (device.timestamp) {
      if (isNaN(Date.parse(device.timestamp))) {
        throw new Error(`Invalid format: if present, timestamp must be ` +
            ` ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ)`);
      } else {
        message.properties.add('iothub-creation-time-utc', device.timestamp);
      }
    }
    try {
      if (testMode) {
        context.log.warn(`Test mode enabled - NOT sending telemetry` +
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
    context.log.warn(`Test mode enabled - NOT publishing to EventGrid: ` +
        ` ${JSON.stringify(event)}`);
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
    patch = {
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
    patch = {
      value: propValue,
      ac: 400,
      ad: e.message,
      av: version
    };
  }
  return patch;
}

/**
 * Returns the correct patch based on the reported property value/state
 * @param {Object} context The Azure Function context for logging
 * @param {Object} device The device metadata
 * @param {string} propName The unique name of the property
 * @param {*} desiredValue The desired value of the property
 * @param {Object} reported The reported property value
 * @param {number} version The desired version
 * @param {Object} [patch] The existing patch parameters
 * @returns {Object} The updated patch or undefined
 */
function getPatch(context, device, propName, desiredValue, reported, version, patch) {
  let patchValue;
  if (device.patch && device.patch[propName]) {
    context.log.verbose(`${device.id} ${propName} will be updated by report`);
    patchValue = device.patch[propName];
  } else if (reported.value === desiredValue) {
    context.log.verbose(`${device.id} ${propName} reported == desired`);
    if (reported.ac === 202) {
      context.log.warn(`${deviceId} ${propName} pending -> closed`);
      patchValue = {
        value: reported.value,
        ac: 200,
        ad: 'presumed closed',
        av: version,
      };
    }
  } else if (reported.ac === 202) {
    context.log.verbose(`${device.id} ${propName} already pending`);
  } else {
    context.log(`${device.id} ${propName} will be written OTA`);
    patchValue = otaWriteProperty(context, device, propName, desiredValue, version);
  }
  if (patchValue) {
    if (!patch) {
      patch = {};
    }
    patch[propName] = patchValue;
  }
  return patch;
}

/**
 * Returns true if the device has reported any properties previously
 * @param {Object} twin 
 * @returns 
 */
function isTwinInitialized(twin) {
  const reported = twin.properties.reported;
  if (reported.$version > 1) return true;
  for (const key in reported) {
    if (key === '$version') continue;
    if (reported[key].$version && reported[key].$version > 1) return true;
  }
  return false;
}

/**
 * Updates a device twin with reported properties.
 * Checks for desired properties (including proxy commands) and triggers 
 * `CommandRequest` events if applicable to writable properties
 * @param {Object} context The app function context (logging)
 * @param {Object} device The device metadata
 * @param {Object} [device.reportedProperties] The set of properties to update
 * @param {Object} [device.patch] Writable property patches
 */
async function updateDeviceTwin(context, device) {
  if (!device) throw new Error(`No device metadata provided`);
  context.log.verbose(`Getting IoT Hub Twin for ${device.id}`);
  let twin;
  try {
    twin = await hubClient.getTwin();
  } catch (err) {
    context.log.error(`Could not connect to IoT Hub: ${err.toString()}`);
    throw err;
  }
  context.log.verbose(`Processing updates for device ${device.id}`);
  let patch;
  const template = getTemplate(device);
  const componentUpdates = getComponentModel(context, device);
  const delta = twin.properties.desired;
  if (!isTwinInitialized(twin)) {
    context.log.info(`Initializing ${device.id} as ${device.modelName}`);
    patch = device.lib.initialize(device.mobileId);
  } else {
    for (const key in delta) {
      if (key === '$version') continue;
      if (key in componentUpdates) {
        const component = delta[key];
        for (const propName in component) {
          if (propName === '__t' || propName === '$version') continue;
          const desiredValue = component[propName];
          const version = component.$version;
          const reported = twin.properties.reported[key][propName];
          patch = getPatch(context, device, propName, desiredValue, reported, version, patch);
        }
      } else {   // root interface
        const propName = key;
        const desiredValue = delta[key];
        const version = delta.$version;
        const reported = twin.properties.reported[propName];
        patch = getPatch(context, device, propName, desiredValue, reported, version, patch);
      }
    }
  }
  if (device.reportedProperties || patch) {
    const updates = Object.assign({}, device.reportedProperties, patch);
    for (const tag in updates) {
      if (updates[tag]) {
        const component = getComponentName(template, tag);
        componentUpdates[component][tag] = updates[tag];
      }
    }
    for (const component in componentUpdates) {
      if (_.isEmpty(componentUpdates[component])) continue;
      let update = {};
      if (component !== defaultComponentName) {
        update[component] = componentUpdates[component];
        update.__t = 'c';
      } else {   // root interface
        update = componentUpdates[component];
      }
      if (testMode) {
        context.log.warn(`Test mode enabled - NOT updating properties:` +
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
 * Attempts to provision the device and returns a connection string
 * @param {Object} context 
 * @param {string} deviceId 
 * @param {*} payload 
 * @returns {string} connectionString
 */
async function provisionDevice(context, deviceId, payload) {
  if (deviceCache[deviceId] && deviceCache[deviceId].connectionString) {
    //: TODO check if this will speed things up or cause problems
    // return deviceCache[deviceId].connectionString;
  }
  context.log.verbose(`Getting device ${deviceId} SAS key`);
  const registrationId = deviceId;
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
  //TODO: unclear why this payload setting doesn't work
  // if (!!(payload)) {
  //   provisioningClient.setProvisioningPayload(payload);
  // }
  context.log.verbose(`Registering provisioning client`);
  try {
    const result = await provisioningClient.register();
    const connectionString = 
        `HostName=${result.assignedHub}` +
        `;DeviceId=${result.deviceId}` +
        `;SharedAccessKey=${deviceSasKey}`;
    context.log.verbose(`Registration successful`);
    deviceCache[deviceId].connectionString = connectionString;
    return connectionString;
  } catch (err) {
    context.log.error(`Device registration: ${err.toString()}`);
    throw err;
  }
}

/**
 * Listens for offline commands to process upon connection
 */
function listenForOfflineCommands() {
  if (!hubClient) throw new Error(`IOT Hub Client invalid`);
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
}

/**
 * Sends device information to IoT Hub/Central
 * @param {Object} context The function app context (for logging)
 * @param {Object} device The device metadata
 * @param {string} device.id The unique (IoT Hub/Central) ID
 * @param {string} device.modelName The device model
 * @param {string} device.mobileId The unique IDP modem identifier
 * @param {Object} [device.telemetry] A set of telemetry
 * @param {Object} [device.reportedProperties] A set of reported properties
 * @param {Object} [device.patch] Orchestrator-triggered property write updates
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
  if (!device.modelName) {
    throw new Error(`No device model defined for ${device.id}`);
  }
  // context.bindings.outputEvent = [];
  device.modelNameId = getTemplate(device)['@id'];
  const connectionString = await provisionDevice(context, device.id, device.modelNameId);
  context.log.verbose(`Connecting to IoT Hub ${connectionString.split(';')[0]}`);
  hubClient = Client.fromConnectionString(connectionString, IotHubTransport);
  listenForOfflineCommands();
  //TODO: Automated provisioning if modelId is known
  // if (device.modelNameId) {
  //   hubClient.setOptions({ modelId: device.modelNameId });
  // }
  await hubClient.open();
  device.lib = require('./deviceModels')[device.modelName];
  if (device.telemetry) await sendTelemetry(context, device);
  await updateDeviceTwin(context, device);
  await hubClient.close();
}

module.exports = {
  azureIotDeviceBridge,
  sendTelemetry,
  updateDeviceTwin,
};

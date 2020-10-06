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
  try {
    const res = await hubClient.sendEvent(message)
    context.log(`Sent telemetry: ${message.getData()}`
        + (res ? `; status: ${res.constructor.name}` : ``));
  } catch (e) {
    context.log.error(`Failed to send telemetry: ${e.stack}`);
  }
}

/* TODO: concept below would monitor for Commands
async function processCommandResult(context, commandResult, twin) {
  const properties = {};
  properties[commandResult.command] = {
    value: commandResult.result
  };
  const err = await twin.properties.reported.update(update);
  context.log(`Sent device properties: ${JSON.stringify(update)}`
      + (err ? `; error: ${err.toString()}` : ` status: success`));
}

async function setupCommandHandlers(context, device) {
  // Template: all functions over satellite link will be asynchronous
  const directMethods = {};
  //: Generically map each supported model's direct methods
  const deviceModel = require('./deviceModels')[device.model];
  for (const commandName in deviceModel.commands) {
    directMethods[commandName] = async (req, res) => {
      const err = await res.send(202);
      const dm = require('./deviceModels')[device.model];
      //TODO: this probably won't work...needs some thought
      dm.commands[commandName](req);
    };
    hubClient.onDeviceMethod(commandName, directMethods[commandName]);
  }
}
// */

/**
 * 
 * @param {Object} context 
 * @param {Object} properties 
 * @param {Object} device
 */
async function handleTwin(context, properties, device) {
  try {
    const twin = await hubClient.getTwin();
    let patch;
    //: Not using twin.on('properties.desired') since it won't trigger immediate
    if (twin.properties.desired) {
      patch = {};
      const writableProperties = [];
      const delta = Object.assign({}, twin.properties.desired);
      context.log(`Desired property changes: ${JSON.stringify(delta)}`);
      if (properties) {
        for (const propName in delta) {
          if (propName === '$version') continue;
          if (propName in properties &&
              _.isEqual(delta[propName], properties[propName])) {
            context.log(`Desired ${propName} already set on device`);
            delete delta[propName];
            patch[propName] = {
              value: properties[propName],
              ad: 'completed',
              ac: 200,
              av: delta.$version,
            };
          }
        }
      }
      for (const propName in delta) {
        //: If writable in the device model get the OTA command setup
        if (propName === '$version') continue;
        const deviceModel = require('./deviceModels')[device.model];
        const writable = deviceModel.writeProperty(propName, delta[propName]);
        if (writable) {
          patch[propName] = {
            value: delta[propName],
            ad: 'pending',
            ac: 202,
            av: delta.$version,
          };
          //: If this is a command proxy response accept and overwrite
          if (properties &&
              writable.completion &&
              properties[propName] === writable.completion.resetValue) {
            patch[propName].value = properties[propName];
            patch[propName].ad = 'commandComplete';
            patch[propName].ac = 200;
          } else {
            writable.property = propName;
            writable.newValue = delta[propName];
            writableProperties.push(writable);
          }
        } else {
          patch[propName] = {
            value: delta[propName],
            ad: 'not writable',
            ac: 400,
            av: delta.$version,
          };
          context.log.warning(`${propName} not writable`
              + ` in model ${device.model}`);
        }
      }
      if (writableProperties.length > 0) {
        context.bindings.outputEvent = [];
        writableProperties.forEach(prop => {
          //: publish event to EventGrid for orchestrator
          const event = {
            id: uuid(),
            subject: `IOTC Desired property ${prop.property}=${prop.newValue}`
                + ` for ${device.mobileId}`,
            dataVersion: '2.0',
            eventType: 'CommandRequest',
            data: {
              mobileId: device.mobileId,
              command: prop.command,
              completion: prop.completion,
              retries: prop.retries
            },
            eventTime: new Date().toISOString()
          };
          context.log.verbose(`Publishing ${JSON.stringify(event)}`);
          context.bindings.outputEvent.push(event);
        });
      }
    };
    if (properties || patch) {
      const update = Object.assign({}, properties, patch);
      for (const prop in update) {
        if (prop in twin.properties.reported &&
            _.isEqual(update[prop], twin.properties.reported[prop])) {
          delete update[prop];
        }
      }
      if (!_.isEmpty(update)) {
        const err = await twin.properties.reported.update(update);
        context.log(`Sent device properties: ${JSON.stringify(update)}`
            + (err ? `; error: ${err.toString()}` : ` status: success`));
      }
    }
  } catch (e) {
    context.log.error(e.stack);
  }
}

/**
 * Placeholder for keeping a connection open listening for commands
 * @private
 * @param {number} milliseconds 
 */
function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

/**
 * Sends device information to IoT Hub/Central
 * @param {Object} context The function app context (for logging)
 * @param {{id: string, model: string, mobileId: string}} device 
 * @param {Object} [telemetry] A set of telemetry
 * @param {Object} [properties] A set of reported properties
 * @param {string} [timestamp] ISO8601 compliant timestamp
 * @param {number} [wait] Seconds to wait for pending commands or desired props
 */
async function bridge(context, device, telemetry, properties, timestamp, wait) {
  let registrationId;
  if (device) {
    if (!device.id || 
        !/^[a-zA-Z0-9-._:]*[a-zA-Z0-9-]+$/.test(device.id)) {
      throw new Error(`Invalid format: deviceId must be alphanumeric and` +
          ` may contain '-', '.', '_', ':' where the` +
          ` last character must be alphanumeric or hyphen.`);
    }
    registrationId = device.id;
  } else {
    throw new Error('Invalid format: a device specification must be provided.');
  }
  const deviceSasKey = await getDeviceKey(registrationId);
  const provisioningSecurityClient =
      new SymmetricKeySecurityClient(registrationId, deviceSasKey);
  const provisioningClient = ProvisioningDeviceClient.create(
      provisioningHost,
      idScope,
      new singleProvisioningTransport(),
      provisioningSecurityClient);
  const result = await provisioningClient.register();
  const connectionString = 
      `HostName=${result.assignedHub}` 
      + `;DeviceId=${result.deviceId}`
      + `;SharedAccessKey=${deviceSasKey}`;
  hubClient = Client.fromConnectionString(connectionString, singleIotHubTransport);
  await hubClient.open();
  if (telemetry) await sendTelemetry(context, telemetry, timestamp);
  await handleTwin(context, properties, device);
  if (wait) {
    //listenForCommands(wait * 1000);
  }
  await hubClient.close();
}

module.exports = bridge;

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

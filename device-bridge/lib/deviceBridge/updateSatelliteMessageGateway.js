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


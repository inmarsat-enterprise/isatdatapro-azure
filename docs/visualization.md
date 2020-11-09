# Visualization with Azure IoT Central

Our architecture chose to make use of **IoT Central** as a hosted IoT platform 
with ready to use dashboards and integration plug-ins to other business tools.

The [Device Bridge](https://github.com/Inmarsat/isatdatapro-azure/tree/master/device-bridge.md)
uses the [IoT Central REST API](https://docs.microsoft.com/en-us/rest/api/iotcentral/)
**Device Templates** and **Devices** capabilities to correlate to device model 
proxy(s) used for satellite messaging.

## Device Templates

Periodically the Device Bridge connects to IoT Central to query available 
Device templates and push updates stored in the device bridge function app. See 
[templates](https://github.com/Inmarsat/isatdatapro-azure/tree/master/device-bridge.md#device-capability-model-templates)

## Customizing Device Templates

Prior to use, the device templates pushed by Device Bridge are intended to be 
manually configured by a *Builder* to define **Views** relevant to data 
visualization.

One example is a very simple device based on Inmarsat's *Plug-N-Play* developer 
kit which periodically sends satellite signal strength telemetry along with its 
location.  Location can be displayed on a map, while signal strength can be 
plotted on a chart as time series data.

![Example Device View](media/inmarsat-pnp-devkit-view.png)

## Device Auto-provisioning

By default, the 
[Device Bridge](https://github.com/Inmarsat/isatdatapro-azure/tree/master/device-bridge.md) 
automatically registers new satellite-connected devices using an IoT Central 
Shared Access Signature via the Azure IoT Hub Device Provisioning Service, 
trusting the globally unique *Mobile ID* which has been authenticated by the 
Inmarsat network and device provisioning process.

>: Note: For enhanced security, you could adopt a more explicit provisioning 
process of pre-loading approved device IDs into IoT Central.

When a *NewReturnMessage* is detected, the Device Bridge looks up all 
provisioned devices in the IoT Central instance and if none contain the Mobile 
ID it assigns a device name `idp-<mobileId>` that will appear in the Devices 
list of IoT Central with Device status *unassociated* and Device template 
*unassigned*.

A user can ***migrate*** an unassigned device to one of the available templates. 
After a migration has been done, all subsequent messages from that device will 
be routed to the Device data model in IoT Central.

## Next Steps

Walk through the [initial set-up](setup.md)
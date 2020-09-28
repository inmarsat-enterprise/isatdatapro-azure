# Device Bridge for IsatData Pro

* Allows for creation of Device Capability Models using device template 
(DTDL v1) creation and upload to IoT Central

* Allows for Virtual Device Models to define data translation i.e. message 
parsing and command translation

* **DeviceBridge** picks up event `NewReturnMessage` and assesses against device 
templates based on `codecServiceId` (SIN) and `codecMessageId` (MIN)
  * If match is found, parse appropriately as modem properties (SIN 0), 
  telemetry (SIN 100), device properties (SIN 101), command response (SIN 102) 
  or edge/Crosser logic (SIN 99)
  * Checks for pending *desired properties* and if the device supports, 
  publishes a `CommandRequest` to EventGrid indicating the expected completion.

* **CommandHandler** maintains a connection to each IDP twin in IoT Central (/Hub) 
for commands or desired property changes based on the device template to publish 
a `CommandRequest` to EventGrid indicating the expected completion.

**`CommandRequest`** event is formatted as:
```
{
  mobileId: {string},
  command: {Object},
  completion: {[Object]},
  retries: {[number]}
}
```

A separate orchestrator function processes the `CommandRequest` as follows:
1. If the same forwardMessage is already in progress, ignore the new request.
2. Else submit command (`MessageForward`) and monitor for the completion.
3. If forward message fails, retry up to `retries` count.
4. After retries failure, publish `CommandFailure`.

>: **Note**: IoT Central device IDs must contain the IDP *mobileId*.  If no 
default ID format is provided as an environment variable 
**`IOTC_DFLT_DEVICE_ID_FORMAT`** the default will be `idp-{mobileId}`.

## Device Capability Models & Device Models

Device capability models can be expanded by adding templates for interfaces 
and/or devices to the project directories:
```
  + lib
  |
  +-+ deviceCapabilityModels
  | |
  | +-+ interfaces
  | | |
  | | +-+ {interfaceName}.json
  | |
  | +-+ devices
  |   |
  |   +-+ {deviceName}.json
  |
  +-+ deviceModels
    |
    +-+ {deviceName}.js
```

Device Models are effectively proxy operations that define message parsing and 
remote operations bridging between an IoT Hub/Central Device Twin and a 
satellite messaging (non-IP) connected device.

### idpmodem Interface

The **idpmodem** interface defines the standard set of properties and 
operations for an IDP satellite modem, communicated using codecServiceId 0 
(aka SIN 0 [core modem messages]()).

### inmarsatPnpDevKit Device

The Inmarsat *Plug-N-Play* developer kit for IsatData Pro consists of a 
Raspberry Pi Zero Wireless connected to an ORBCOMM ST2100 packaged modem (aka 
*smart antenna*).

### inmarsatPnpDevKit Device Model

...
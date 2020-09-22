# Device Bridge for IsatData Pro

* Allows for creation of Device Capability Models using device template 
(DTDL v1) creation and upload to IoT Central

* Allows for Virtual Device Models to define data translation i.e. message 
parsing and command translation

* Picks up event `NewReturnMessage` and assesses against device templates based 
on `codecServiceId` (SIN) and `codecMessageId` (MIN)
  * If match is found, parse appropriately as modem properties (SIN 0), 
  telemetry (SIN 100), device properties (SIN 101), command response (SIN 102) 
  or edge/Crosser logic (SIN 99)

* Checks IoT Central (/Hub) for commands or property settings based on device 
template to create new forward message submission, indirectly generating 
`NewForwardMessage` event

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
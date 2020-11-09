# Device Bridge for IsatData Pro

* Uses Device Capability Models based on the Azure Digital Twin Definition 
Language (DTDL v1) created and uploaded to IoT Central

* Allows for virtual Device Model code to define data translation i.e. message 
parsing and command proxy/translation

* **DeviceToCloudBridge** picks up event `NewReturnMessage` or 
`OtaCommandResponse` and processes data using a device model stored in 
the library of **deviceModels** based on looking up its **deviceTemplate**.
  * The device model parses incoming data as telemetry or reported properties.
  * Checks for pending *desired properties* and if the device supports, 
  publishes a `CommandRequest` to EventGrid indicating the expected completion.

* **CloudToDeviceBridge** runs periodically against each provisioned device with 
an IDP Mobile ID to check for new *desired properties* in between return 
messages and publishes a `CommandRequest` to EventGrid indicating the expected 
completion.

* *writable properties* are implemented by defining an over-the-air message 
in a device model.

* *commands* are implemented as writable properties with optional completion 
metadata for expected responses.  This is because the satellite messaging 
modems do not maintain a connection to the IoT Hub/Central.

A separate orchestrator function processes the `CommandRequest` as follows:
1. If the same forwardMessage is already in progress, ignore the new request.
2. Else submit command (`MessageForward`) and monitor for the completion.
3. If completion is specified, publish `OtaCommandResponse` to be picked up 
by the **deviceToCloudBridge**

>: **Note**: IoT Central device IDs must contain the IDP *mobileId*.  If no 
default ID format is provided as an environment variable 
**`IOTC_DFLT_DEVICE_ID_FORMAT`** the default will be `idp-{mobileId}`.

## Device Capability Models & Device Models

Device capability models can be expanded by adding templates for interfaces 
and/or devices to the project directories:
```
  + lib
  |
  +-+ deviceTemplates
  | |
  | +-+ templates
  | | |
  | | +-+ {deviceName}.json
  | |
  | +-+ capabilityModels
  | | |
  | | +-+ {deviceName}.json
  | |
  | +-+ interfaces
  |   |
  |   +-+ idpmodem.json
  |   |
  |   +-+ {interfaceName}.json
  |
  +-+ deviceModels
    |
    +-+ {deviceName}
      |
      +-+ messageParser.json
```

### Device Capability Model Templates

Device Capability Models follow the Azure Device Twin Definition Language v1 
where a *template* contains a *capabilityModel* which in turn contains 
*interfaces*.  These elements can be merged together into a device template 
based on the examples provided in `/lib/deviceTemplates`.

### Device Models

Device Models are effectively proxy operations that define message parsing and 
remote operations bridging between an IoT Hub/Central Device Twin and a 
satellite messaging (non-IP) connected device.  They are Javascript modules 
named to match a corresponding *template*, and stored in the 
`/lib/deviceModels` directory stored as part of the Function App code.

### idpmodem Interface

The **idpmodem** interface defines the standard set of properties and 
operations for an IDP satellite modem, communicated using codecServiceId 0 
(aka SIN 0 **core modem messages**).

### inmarsatPnpDevKit Device

The Inmarsat *Plug-N-Play* developer kit for IsatData Pro consists of a 
Raspberry Pi Zero Wireless connected to an ORBCOMM ST2100 packaged modem (aka 
*smart antenna*).

### Custom device models

The **index.js** file must export the following functions:

* **`initialize`***`()`* is called the first time the device reports or is 
provisioned manually in IoT Central, and should return the default set of 
*telemetry* and *reportedProperties*, where writable properties should be 
objects with a `value` property, an `ac: 200` property and `av: 1` property.

* **`parse`***`(context, message)`* defines data parsing for (return) messages 
into *telemetry* and *reportedProperties* with optional *timestamp*, where 
writable properties should be objects with a `value` property.

* *(optional)* **`writableProperties`** an array of writable property names

* **`writeProperty`***`(propName, propValue)`* function structured as follows:
```
{
  "command": {
    "payloadJson": {
      "codecServiceId": <number>,
      "codecMessageId": <number>,
      "fields": [
        {
          "name": "<myFieldName>",
          "stringValue": "<myValueAsString>",
          "dataType": "<myDataType>"
        }
      ]
    }
  },
  completion: {
    "codecServiceId": <number>,
    "codedMessageId": <number>,
    "property": "<myProxyCommandProperty>",
    "resetValue": <myProxyCommandResetValue>
  },
}
```
Where **`command`** could use either a `payloadJson` format as above, or a decimal-
coded binary payload such as:
```
"payloadRaw": [<codecServiceId>,<codecMessageId>,<dataByte>]
```

**`completion`** is intended for use with writable properties for the 
orchestrator to validate an over-the-air message command/response workflow.
  * *`codecServiceId`* is the first byte of the return message
  * *`codecMessageId`* is the second byte of the return message
  * *`property`* is the "proxy" property name in the device template / IOTC
  * *`resetValue`* is the value the proxy property should be set to upon 
  completion

>: **Note** the completion value (`resetValue`) is not quite working as 
desired due to the way IoT Central maintains state/versions.

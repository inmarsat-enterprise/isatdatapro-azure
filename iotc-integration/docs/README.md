# IoT Central Device Bridge

Adapted from https://github.com/Azure/iotc-device-bridge

Implements an HTTP listener which pushes data into a configured IOTC application
using the following format:
```json
{
    "device": {
        "deviceId": "my-cloud-device"
    },
    "measurements": {
        "temp": 20.31,
        "pressure": 50,
        "humidity": 8.5,
        "location": {
          "lat": 0.0,
          "lon": 0.0,
          "alt": 0.0
        }
    }
}
```

Each key in the `measurements` object must match the name of a capability in 
the device template in the IoT Central application.  Because this solution 
doesn't support specifying the interface Id in the message body, if two 
different interfaces have a capability with the same name, the measurement 
will be presented in both capabilities.

An optional `timestamp` field can be included in the body, to specify the UTC 
date and time of the message.  This field must be in ISO format: 
YYYY-MM-DDTHH:mm:ss.sssZ (for example, `2020-06-08T20:16:54.602Z` is a valid 
timestamp). If `timestamp` is not provided, the current date and time will be 
used.

An optional `modelId` field can also be included in the body. This will cause 
the device to be associated to a Device Template during provisioning. This 
functionality is not supported by legacy apps.

> NOTE: `deviceId` must be alphanumeric, lowercase, and may contain hyphens.

When a message with a new `deviceId` is sent to IoT Central by the device 
bridge, a new _unassociated device_ will be created.  The device will initially 
be under `Devices > All devices`. Select the device then click `migrate` to 
choose the appropriate template.

[[insert screenshot]]

Returns a HTTP response (success or error)

## To-Do

* Confirm deviceId can include uppercase (e.g. manufacturer code, checksum for IDP)
* Implement SAS key in key vault (currently a local/env setting)
* Include modelId and test against sample device template
* Update API versions to 2020 baseline
* Detail provisioning steps and create auto-provisioning script
* Add bi-directional functionality (commands, twin)
* Add libraries for other IOT network interfaces e.g. LoRaWAN
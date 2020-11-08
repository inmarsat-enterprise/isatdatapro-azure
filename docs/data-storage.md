# Data Storage

> :warning: Work in Progress

## Warm Storage in Cosmos DB

All raw data and metadata related to the IDP modems and messages are stored in 
the Cosmos DB tagged by category:

* **satellite_gateway** entities are perpetual and allow for connection to 
Inmarsat or other IDP message gateway system operators. Metadata keeps track of 
the current *alive* state of the API based on successful or failed API calls. 
Entities can be created or updated indirectly using an IoT Central *Satellite 
Messaging Gateway* device template. 

* **mailbox** entities are perpetual and maintain a unique relationship to a 
*SatelliteGateway*. Each entity holds (encrypted) credentials used in API calls. 
Entities can be created or updated indirectly using an IoT Central *Satellite 
Mailbox* device template. 

* **mobile** entities are perpetual and contain the latest metadata derived from 
messages sent by or to the modem. Metadata includes information about satellite 
registration, last message received, and configuration settings. Entities are 
updated automatically as messages are retrieved or submitted.

* **message_return** and **message_forward** entities are essentially a kind of 
time-series data with a configurable time-to-live property in the database with 
a default of 90 days. The Cosmos DB automatically culls aged messages after the 
ttl expires.

* **api_call_log** entities contain metadata about the success or failure of 
the call (used for API Notifications) as well as *high water mark* for 
successive API polling calls. These logs have a default time-to-live of 7 days 
in the database.

## Device Twin Templates and Models

### Device Twin Definition templates

Currently templates used by the Device Bridge are stored within a subdirectory 
in the **satellite-device-bridge** function app: `/lib/deviceTemplates`. These 
templates supported by IoT Central currently follow the 
[Digital Twin Definition Language v1](https://github.com/Azure/opendigitaltwins-dtdl/blob/master/DTDL/v1-preview/dtdlv1.md)
specification.

### Device Twin models

Currently models may be produced by an integrator or manufacturer and must be 
stored in the **satellite-device-bridge** function app: `/lib/deviceModels`. 
These are structured as Node.js modules.

## Next Steps

Read more about:

* [Satellite Device Bridge implementation](https://github.com/Inmarsat/isatdatapro-azure/tree/master/device-bridge)
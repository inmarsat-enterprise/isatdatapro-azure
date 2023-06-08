<!--
---
languages:
- nodejs
- javascript
products:
- azure
- azure-functions
- azure-logic-apps
- azure-event-grid
- azure-cosmos-db
- azure-storage
- azure-app-service
---
-->
# Satellite IoT Messaging Microservice

## IsatData Pro System Architecture

![IsatData Pro System Architecture](docs/media/idp-architecture.png)

* A ***Mailbox*** provides authentication credentials for API calls to the 
Inmarsat service, and provides access to an interest group of devices associated 
with a satellite modem (aka *Mobile*).

* A ***Mobile*** is the satellite modem associated with a remote Device or Edge 
Gateway, identified by a globally unique *Mobile ID*.  The Mobile could also be 
considered a leaf device in that it includes location services and various 
configuration and property metadata.

* A ***Message*** contains the data payload sent over the satellite link in a 
given direction:
  * ***Return*** messages (aka Mobile-Originated) are sent from the modem 
  such as telemetry, properties, metadata
  * ***Forward*** messages (aka Mobile-Terminated) are sent to the modem such 
  as commands or configuration and have corresponding ***Status*** to indicate 
  state and reason for the state

* A ***Satellite Gateway*** is effectively an API server URL associated with a 
network operator, and is modeled to include the API/server state

## MessageReturnGet
*Timer Trigger*

Periodically polls all Mailboxes stored in the database, with a default interval 
of 30 seconds. The invoked library function puts the message content and 
metadata in the database after checking/discarding duplicates.

Publishes the following EventGrid Events:
* ``NewReturnMessage``
* ``NewMobile``
* ``ApiOutage``
* ``ApiRecovery``

## MessageForwardSubmit
*EventGrid Trigger*

When a *NewForwardSubmission* is published to the EventGrid, the invoked library 
submits the message to transmit over the satellite network, and if successful 
stores its content and initial status in the database.

Publishes the following EventGrid Events:
* ``NewForwardMessage``
* ``ApiOutage``
* ``ApiRecovery``
* TODO: FailedMessageSubmission

> TODO: IoT Hub and/or front-end web GUI to create/send a Forward Message into 
this service, and handle failed message submissions

## MessageForwardStatusGet
*Timer Trigger*

Periodically polls all Mailboxes stored in the database, with a default interval 
of 30 seconds.  The invoked library function checks against known 
messages/statuses in the database and updates the status in the database 
accordingly.  If a status is retrieved that does not correspond to a known 
message in the database, it publishes *OtherClientForwardSubmission*.

Publishes the following EventGrid Events:
* ``ForwardMessageStateChange``
* ``OtherClientForwardSubmission``
* ``ApiOutage``
* ``ApiRecovery``

## MessageForwardGet
*EventGrid Trigger*

When an *OtherClientForwardSubmission* is published to the EventGrid, the 
invoked library retrieves the message via the Inmarsat API and puts the content 
and status in the database.

Publishes the following EventGrid Events:
* ``NewMobile``
* ``ApiOutage``
* ``ApiRecovery``

## MobileGet
*EventGrid Trigger*

When a `NewMobile` is published to the EventGrid, the invoked library retrieves 
the Mobile metadata from the Inmarsat API and updates the database.

Publishes the following EventGrid Events:
* ``NewMobile``
* ``ApiOutage``
* ``ApiRecovery``

## MailboxUpdate
*EventGrid Trigger*

When a `MailboxUpdate` is published to the EventGrid, the invoked library stores 
the Mailbox metadata in the database (encrypting the password at rest).

> TODO: Front-end GUI to administer Mailboxes

## SatelliteGatewayUpdate
*EventGrid Trigger*

When a `SatelliteGatewayUpdate` is published to the EventGrid, the invoked 
library stores the Satellite Gateway metadata in the database.

> TODO: Front-end GUI to administer Satellite Gateways which publishes TBD

## SharedCode

### eventGrid (deprecated)
The invoked API library provides an eventHandler emitter that has the 
following events which this module publishes to EventGrid:
  * **NewMobile**: mobileId, mailboxId, source
  * **NewReturnMessage**: messageId, mobileId, mailboxId, source
  * **NewForwardMessage**: messageId, mobileId, mailboxId, source
  * **ForwardMessageStateChange**: messageId, mobileId, newState
  * **OtherClientForwardSubmission**: messageId, mailboxId
  * **ApiOutage**: satelliteGateway, timestamp
  * **ApiRecovery**: satelliteGateway, timestamp

### logger
The invoked API library provides a Winston-based logger with helpful JSON-format 
logs and provides a wrapper to include the calling function name for debug 
purposes.  These can be viewed using Streaming Logs.

### appInsights (Not Implemented)
Is intended to allow for logs from the invoked library to be pushed into 
Application Insights.

> TODO: convert relevant logs into Insights

## Developer Section

This project has been designed using VS Code using Node.js / Javascript for
Azure Functions.

### Prerequisites

Using the **Azure Portal**:

- [x] Created a **Resource Group** called `satellite-iot-serverless`
- [x] Created and configured a **Cosmos DB** called `IsatDataPro`
- [x] Created and configured a **Storage Account** called `idpfunctionstore`
- [x] Created a **Function App** called `satelliteMessaging`
- [x] Created an **Event Grid Topic** called `SatelliteMessagingExternalizations`
- [x] Created and configured a **Logic App** called `IdpApiNotifications`
- [x] Created and configured an **IoT Central Application** or **Azure IoT Hub**

### Local Environment Setup

* Using the template `example.local.settings.json`,
create a `local.settings.json` file in the `/satellite-messaging` folder with
the following `Values`, which can be found using your Azure portal login under
the resource group you created:
    * `AzureWebJobsStorage`: The connection string of an Azure Storage account.
    * `COSMOS_DB_HOST`: The URI for your Azure Cosmos DB.
    * `COSMOS_DB_PASS`: The connection string for your Cosmos DB.
    * `EVENTGRID_TOPIC_ENDPOINT`: The EventGrid resource topic endpoint 
    * `EVENTGRID_TOPIC_KEY`: The EventGrid resource topic key
    * `MAILBOX_SECRET`: A Configuration property in the `satelliteMessaging`
    Function App used to encrypt IDP mailbox passwords for storage in Cosmos DB.

* Ensure that your `launch.json` file for this sub-project in the `.vscode`
folder has different `port` and `preLaunchTask` settings from the other
microservices (`satelliteMessagingOrchestrator` and
`satelliteMessagingDeviceBridge`).

* Ensure that your `tasks.json` file for this sub-project in the `.vscode`
folder aligns the task `command` for the function app with the `preLaunchTask`
value in `launch.json`.

### Testing

> :warning: Work in Progress

The **`satelliteMessaging`** Function App provides a thin wrapper for
the Inmarsat **`isatdatapro-microservices`** project.

The top-level project provides a Collection and Environment for use with
[**Postman**](get.postman.com)

### Deployment

> :warning: Work in Progress

### Upgrading Azure Functions Runtime

> :warning: Over time Microsoft updates the Azure Functions versions and stops support of
previous versions.

[Upgrading](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions?tabs=azure-cli%2Cwindows%2Cin-process%2Cv4&pivots=programming-language-javascript#upgrade-your-local-project)

Install the most current LTS version of Node.js using **`nvm`** and update
node modules using **`npm`**:
    ```
    $ nvm install --lts && npm update
    ```

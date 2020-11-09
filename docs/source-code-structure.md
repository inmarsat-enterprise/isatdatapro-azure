# Source Code Structure

> :warning: Work in Progress

The project is primarily comprised of three Function Apps written in Javascript 
(Node.js) as a common programming language for convenience.

* [`/satellite-messaging`]() implements the following:
  * `/MessageReturnGet` is a timer-triggered Azure Function that polls the 
  Inmarsat API periodically to retrieve mobile-originated messages and publishes 
  *NewReturnMessage* events.
  * `/MessageForwardSubmit` is an event-triggered Azure Function that submits a 
  new mobile-terminated message from a *NewForwardSubmission* and publishes a 
  *NewForwardMessage* event.
  * `/MessageForwardStatusGet` is a timer-triggered Azure Function that polls 
  the Inmarsat API periodically to get state updates on submitted forward 
  messages and publishes *ForwardMessageStateChange* events.
  * `/MessageForwardGet` is an event-triggered Azure Function that is invoked 
  if a status is found for a forward message that was not submitted via the 
  *MessageForwardSubmit* function.
  * `/MailboxUpdate` is an event-triggered Azure Function that updates Inmarsat 
  API credentials in the Cosmos DB.
  * `/SatelliteGatewayUpdate` is an event-triggered Azure Function that updates 
  IDP network operator API host information.
  * `/SharedCode` provides various helper functions.

* [`/device-bridge`]() implements the following:
  * `/DeviceToCloudBridge` is an Azure Function triggered by Event Grid Events 
  *NewReturnMessage* or *OtaCommandResponse* which invokes the IoT Central REST 
  API and the IoT Hub Device Provisioning Service
  * `/CloudToDeviceBridge` is an Azure Function timer-triggered which invokes 
  the IoT Central REST API and the IoT Hub Device Provisioning Service
  * `/lib` contains shared code, device templates and device models
    * `/deviceTemplates` contains the following:
      * `/templates` are the top-level template JSON documents for each device 
      class
      * `/capabilityModels` define modular capabilities that can be 
      automatically imported into a template during push
      * `/interfaces` define modular interfaces that can be automatically 
      imported into a capabilityModel (and template) during push
    * `/deviceModels` contains satellite messaging codecs and command proxies 
    that match each device template.
      * `/idpDefault` includes messaging codec and remote commands supported by 
      any Inmarsat Type-Approved IDP modem, and may be referenced by any custom 
      model following the example in `inmarsatPnpDevKit`.
      * `/inmarsatPnpDevKit` provides an example model extending `idpDefault`.
      * `/mailbox` provides a model for updating Inmarsat API credentials via 
      IoT Central into the Cosmos DB.
      * `/satelliteGateway` provides a model for updating IDP network operator 
      API host details in the Cosmos DB.
    * `/codecCommonMessageFormat.js` provides a parsing utility for IDP devices 
    making use of a *Message Definition File* for JSON message structures on the 
    Inmarsat API.
    * `/idpDeviceInterfaceBridge.js` manages the interface to IoT Central using 
    the IoT Hub Device Provisioning Service to push telemetry and reported 
    properties and check for desired properties (including proxy commands)
    * `/iotcDcmApi.js` interfaces to the IoT Central REST API to manage device 
    templates and fetch provisioned devices.
    * `/utilities.js` provides various helper functions.

* [`/orchestrators`]() implements the following:
  * `/OtaCommandStart` is a durable function starter triggered by an 
  *OtaCommandRequest* from the Device Bridge.
  * `/OtaCommandOrchestrator` is the main durable orchestrator that manages 
  progression of a command proxy chain to completion.
  * `/OtaCommandSubmit` is the first chained function, which publishes a 
  *NewForwardSubmission* event to be handled by the satellite messaging function
  app.
  * `/OtaCommandSending` is the second chained function, which picks up the 
  unique *NewForwardMessage* ID for the orchestrator to track to completion.
  * `/OtaCommandDelivery` is the third chained function, which picks up a 
  *ForwardMessageStateChange* for the pending command to progress the 
  orchestrator.
  * `/OtaCommandResponse` is the fourth chained function, which is used if the 
  command proxy defines an explicit response using a specific *NewReturnMessage*.
  * `/OtaCommandCleanup` runs periodically to cull any orchestrator instances 
  that have been running for a longer time than expected progression of an OTA 
  command to closure.
  * `/SharedCode` provides various helper functions.

* [`/arm`]() implements the Azure Resource Manager configuration:
  * `/azuredeploy.json`
  * `/azuredeploy.parameters.json`

* [`/web`]() is currently unused.
# IsatData Pro Orchestrators

The intent of this set of functions is to:

1. Manage the flow of remote commands between a device twin in IoT Hub/Central
and the IoT device/gateway connected remotely via satellite messaging
(*non-IP*).

2. *(Future)* Facilitate web app administrative operations
to visualize and update the IsatDataPro database,
in particular adding *Mailbox* accounts.

## Device Twin / Command Proxy IP-to-IDP

* Depends on **device-bridge** function app to provide proxy message definitions 
as writable properties on a device.

* Depends on **satellite-messaging** function app to pick up and generate OTA 
message related EventGrid events.

* IoT Central can be used to set a writable property value or send an offline 
command defined in a device model, which maps to an IDP forward message.

### Orchestration flow

* **OtaCommand1Start** is triggered by an EventGrid `CommandRequest` event which 
instantiates the **OtaCommandOrchestrator** function chain / monitor pattern.

* **OtaCommand2Submit** is the next in the chain which publishes an Eventgrid 
`NewForwardSubmission` event and returns a unique submission ID to the 
orchestrator.

* **OtaCommand3Sending** is triggered by a `NewForwardMessage` published to
EventGrid by the *satellite-messaging* function app to correlate the satellite
network-assigned message ID to the submission ID in the orchestrator by raising
a `CommandSending` internal event.

* **OtaCommand4Delivery** is triggered by `ForwardMessageStateChange` to confirm 
delivery or failure of the forward message with matching network-assigned ID to
the orchestrator, raising a `CommandDelivered` internal event.

* **OtaCommand5Response** is only awaited if a *response* is defined in the
`CommandRequest`, and is triggered by a `NewReturnMessage` matching the
*codecServiceId* and *codecMessageId* from the remote device to
raise a `ResponseReceived` internal event.

* Finally, **OtaCommand6Completion** publishes an `OtaCommandResponse` to
EventGrid to be picked up by *device-brige* function app to complete the
orchestration and update Azure IOT Central.

The following timeouts are also managed and may be configured in Function App
settings:

  * **functionTimeout** is recommended to be 30 seconds to allow for
    action functions to execute.
  * **commandTimeout** defaults to 10 minutes (600 seconds) but may be
    dynamically extended if the orchestrator determines the modem is using
    low power mode scheduled message delivery.
  * **deliveryGraceTime** defaults to 75 seconds allowing one or two cycles
    of the *satellite-messaging* timer driven updates to detect state change.
  * **responseTimeout** defaults to 75 seconds.

Additionally, a periodic **OtaCommandInstanceCleanup** runs to terminate any
long-standing incomplete orchestrations.

## Administrative Operations for IsatDataPro Database

>: **Note** not yet implemented.
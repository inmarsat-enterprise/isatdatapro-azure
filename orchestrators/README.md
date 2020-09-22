# idpOrchestratorsFunctionApp

The intent of this set of functions is to:

1. Manage the flow of remote commands between a device twin in IoT Hub and the 
IoT device/gateway connected remotely via satellite messaging (*non-IP*).
2. Facilitate web app administrative operations to visualize and update the 
IsatDataPro database, in particular adding *Mailbox* accounts.

## Command proxy IP-to-IDP

* IoT Central sends a command based on the defined template
* `NewForwardMessage` triggers OtaCommandStage (1) - lookup expected response
* Monitor for `ForwardMessageStateChange` DELIVERED
* Map to expected response (if any)

## Administrative Bridge for IsatDataPro Database

This...
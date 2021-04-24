const uuid = require('uuid').v4;
const testConstants = require('./testConstants');

const OtaCommandComplete = {
  "id": `${uuid()}`,
  "dataVersion": "2.0",
  "subject": `Command complete for IOTC Desired property wakeupPeriod=0 from iotc for idp-01459438SKYFEE3`,
  "eventType": "OtaCommandComplete",
  "data": {
    "commandDeliveredTime": `${new Date().toISOString()}`,
    "otaCommandId": `${testConstants.otaCommandUuid}`,
    "mobileId": `${testConstants.mobileId}`,
    "completion": {
        "property": "idpWakeupPeriod",
        "av": 6,
        "value": 0
    }
 },
  "eventTime": `${new Date().toISOString()}`
}
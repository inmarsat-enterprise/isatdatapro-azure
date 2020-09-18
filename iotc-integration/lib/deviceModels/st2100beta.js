'use strict';

const initialReportedPropertiesPatch = {
  lastPatchReceivedId: '',
  serialNumber: '',
  hardwareVersion: '',
  firmwareVersion: '',
  wakeupPeriod: 0,
  lastRegistrationTimeUtc: '',
  lastRegistrationRegion: '',
  lastReturnMessageTimeUtc: '',
};

const writeableProperties = {
  'name': (newValue, callback) => {
    setTimeout(() => {
      callback(newValue, 'pending', 202);
    }, 1000);
  },
};

const methods = {
  'doSomething': (request, response) => {
    context.log(`Received asynchronous call to do something`);
    const responsePayload = { status: `doing ${request.payload}` };
    response.send(202, (err) => {
      if (err) {
        context.log.error(`Unable to send method response: ${err.toString()}`);
      } else {
        //send a remote command...twin will be updated later by return message
        //simulate long response...need to manage with orchestrater
        setTimeout(() => {
          //sendDeviceProperties(twin, properties);
        }, 30000);
        console.log(responsePayload);
      }    
    });
  },
};
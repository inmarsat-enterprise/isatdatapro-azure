/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an HTTP starter function.
 * 
 * Before running this sample, please:
 * - create a Durable activity function (default name is "Hello")
 * - create a Durable HTTP starter function
 * - run 'npm install durable-functions' from the wwwroot folder of your 
 *    function app in Kudu
 */

const df = require("durable-functions");

module.exports = df.orchestrator(function* (context) {
    let outputs = [];
    const input = context.df.getInput();
    /*
    input: {
        commandDetails,
        callback or event to post
    }
    */
    if (input) console.log(`Orchestrating command: ${JSON.stringify(input)}`);
    // TODO: lookup command and expected response
    const { otaMessage, expectedResponse } = input;
    // Submit command as OTA message
    const messageId = yield context.df.callActivity("OtaCommand", otaMessage);
    outputs.push({commandId: messageId});
    // Wait for event ForwardMessageStateChange for messageId
    outputs.push({commandReceiveTime: ''});
    // Wait for event NewReturnMessage with expectedResponse identifier(s)
    outputs.push({responseId: 0});
    // Callback or post event with response details
    outputs.push({publishedTo: ''});
    return outputs;
});
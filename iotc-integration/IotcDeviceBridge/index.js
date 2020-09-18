const handleMessage = require('../lib/engine');
const getKeyVaultSecret = require('../lib/keyvault');

const parameters = {
  idScope: process.env.ID_SCOPE,
  primaryKeyUrl: process.env.IOTC_KEY_URL
};

module.exports = async function (context, req) {
  context.log(`IOTC bridge received ${JSON.stringify(req.body)}`);
  try {
    await handleMessage(
      { ...parameters, log: context.log, getSecret: getKeyVaultSecret },
      req.body.device,
      req.body.measurements,
      req.body.timestamp,
      req.body.modelId
    );
  } catch (e) {
    context.log.error(e.message);
    context.res = {
      status: e.statusCode ? e.statusCode : 500,
      body: e.message
    };
  }
};

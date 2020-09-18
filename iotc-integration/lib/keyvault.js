
const request = require('request-promise-native');

require('dotenv');
//TODO: not clear where this MSI information comes from may need to be in FuncApp index.js
const msiEndpoint = process.env.MSI_ENDPOINT;
const msiSecret = process.env.MSI_SECRET;

const localSecret = process.env.TEMP_IOTC_SAS_KEY;

let kvToken;

/**
 * Fetches a Key Vault secret. Attempts to refresh the token on authorization errors.
 * @param {object} context The Function App context (used for logging)
 * @param {string} secretUrl The Key Vault url
 * @param {boolean} [forceTokenRefresh]
 */
async function getKeyVaultSecret(context, secretUrl, forceTokenRefresh = false) {
  // Workaround complexity of storing secret in vault
  if (typeof(localSecret) === 'string') {
    context.log.warn(`Using temporary variable SAS key`);
    return localSecret;
  }
  // Production version should use key vault properly
  if (!kvToken || forceTokenRefresh) {
    const options = {
      uri: `${msiEndpoint}/?resource=https://vault.azure.net&api-version=2017-09-01`,
      headers: { 'Secret': msiSecret },
      json: true
    };
    try {
      context.log('[HTTP] Requesting new Key Vault token');
      const response = await request(options);
      kvToken = response.access_token;
    } catch (e) {
      throw new Error('Unable to get Key Vault token');
    }
  }
  // with Key Vault access token
  try {
    context.log('[HTTP] Requesting Key Vault secret', secretUrl);
    const options = {
      url: `${secretUrl}?api-version=2016-10-01`,
      headers: { 'Authorization': `Bearer ${kvToken}` },
      json: true
    };
    const response = await request(options);
    return response && response.value;
  } catch (e) {
    if (e.statusCode === 401 && !forceTokenRefresh) {
      return await getKeyVaultSecret(context, secretUrl, true);
    } else {
      throw new Error('Unable to fetch secret');
    }
  }
}

module.exports = getKeyVaultSecret;

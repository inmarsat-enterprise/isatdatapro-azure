/**
 * Initiatlizes a new gateway for IOT Central
 * @param {string} name The gateway shorthand name
 * @param {string} url The gateway base URL
 */
function initialize(name, url) {
  const patch = {
    name: {
      value: name || '',
      ac: 200,
      av: 1
    },
    url: {
      value: url || '',
      ac: 200,
      av: 1
    },
    alive: true,
    aliveStateChangeTime: (new Date()).toISOString(),
  };
  return patch;
}

module.exports = {
  initialize,
};
/**
 * 
 * @param {number} value The number to round
 * @param {number} decimals The number of decimal places to use
 * @returns {number} Rounded to requested precision
 */
function round(value, decimals) {
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

/**
 * Converts seconds since epoch to Date object
 * @param {number} unixTimestamp A unix timestamp seconds since 1970-01-01T00:00:00Z
 * @param {boolean} [isoFormat] Optional indication to return ISO string instead of Date
 * @returns {Date|string} A date object or ISO formatted string
 */
function unixToDate(unixTimestamp, isoFormat=false) {
  if (isoFormat) {
    return new Date(unixTimestamp * 1000).toISOString();
  }
  return new Date(unixTimestamp * 1000);
}

function importDirectory(dirname) {
  const normalizedPath = require('path').join(dirname);
  let modules = {};
  
  require('fs').readdirSync(normalizedPath).forEach(file => {
    let moduleName = file.split('.')[0];
    modules[moduleName] = require(`./${moduleName}`);
  });
  
  return modules;
}

module.exports = {
  round,
  unixToDate,
  importDirectory,
};
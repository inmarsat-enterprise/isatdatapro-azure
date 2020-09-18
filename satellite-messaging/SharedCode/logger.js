'use strict';

const component = 'azure-microservice-messaging';
const logging = require('isatdatapro-microservices').logging;

function logger(caller) {
  return logging.loggerProxy(caller, component);
}

module.exports = logger;
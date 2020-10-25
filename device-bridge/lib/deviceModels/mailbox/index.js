const writable = [
  'name',
  'satelliteGatewayName',
  'mailboxId',
  'accessId',
  'password',
];

const readOnly = [];

function parse(context, query) {
  const reportedProperties = {};
  for (const propName in query) {
    if (writable.includes(propName)) {
      reportedProperties[propName] = {
        value: query[propName],
        ac: 200
      };
    } else if (readOnly.includes(propName)) {
      reportedProperties[propName] = query[propName];
    }
  }
  return { reportedProperties: reportedProperties };
}

module.exports = { parse };
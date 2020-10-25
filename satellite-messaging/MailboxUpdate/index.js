const idp = require('isatdatapro-microservices');
const { eventGrid } = require('../SharedCode');
const secret = process.env.MAILBOX_SECRET;

module.exports = async function (context, eventGridEvent) {
  context.log(`${__filename} called with ${JSON.stringify(eventGridEvent)}`);
  if (eventGridEvent.eventType !== 'MailboxUpdate') {
    throw new Error(`Triggered by incorrect event ${eventGridEvent.eventType}`);
  }
  let mailbox;
  let changes = false;
  try {
    const category = 'Mailbox';
    const filter = {
      include: {
        mailboxId: String(eventGridEvent.data.mailboxId),
        satelliteGatewayName: eventGridEvent.data.satelliteGatewayName,
      },
    };
    const exists = await idp.getEntity(category, filter);
    if (exists.length > 0) {
      mailbox = exists[0];
      const password = mailbox.passwordGet(secret);
      if (eventGridEvent.data.password &&
          password !== eventGridEvent.data.password) {
        changes = true;
      }
      for (const propName in eventGridEvent.data) {
        if (propName !== 'password' &&
            mailbox.hasOwnProperty(propName) &&
            mailbox[propName] !== eventGridEvent.data[propName]) {
          changes = true;
          break;
        }
      }
    } else {
      changes = true;
    }
    if (changes) {
      await idp.updateMailbox(eventGridEvent.data);
      mailbox = await idp.getEntity(category, filter)[0];
    } else {
      context.log.warn(`No changes to mailboxes in database`);
    }
    const eventType = 'MailboxQuery';
    const subject = `Mailbox query for ${mailbox.mailboxId}`;
    const data = mailbox;
    const eventTime = (new Date()).toISOString();
    const event = new eventGrid.Event(eventType, subject, data, eventTime);
    context.log(`Publishing ${JSON.stringify(event)}`);
    context.bindings.outputEvent = event;
  } catch (e) {
    context.log(e.stack);
  }
};
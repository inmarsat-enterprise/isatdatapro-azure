# GetReturnMessages - JavaScript/Nodejs

Automatically retrieves new ***Return*** messages sent by all ***Mobile***s within the scope of all provisioned ***Mailbox***es, 
by default every 15 seconds.

## How it works

Using a `TimerTrigger`, you provide a schedule in the form of a [cron expression](https://en.wikipedia.org/wiki/Cron#CRON_expression)(See the link for full details). A cron expression is a string with 6 separate expressions which represent a given schedule via patterns. The pattern we use to represent every 15 seconds is `*/15* * * * * *`. This, in plain text, means: "When seconds is divisible by 15, for any minute, hour, of the day, day of the month, month, day of the week, or year".

The function calls a library that retreives messages, stores them uniquely in a database, and generates events for each of:
* New Return Message received/stored
* New Mobile auto-discovered
* Satellite network API outage/unavailable
* Satellite network API recovered

The events are then passed to an Azure Event Grid for further processing.

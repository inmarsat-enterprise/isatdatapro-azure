---
languages:
- nodejs
- javascript
products:
- azure
- azure-functions
- azure-logic-apps
- azure-event-grid
- azure-cosmos-db
- azure-sql-database
- azure-storage
- azure-app-service
page_type: sample
description: "This architecture walks you through the process involved in 
integrating Inmarsat's IsatData Pro (**IDP**) satellite IoT connectivity 
into your Azure application."
---

# Satellite IoT Serverless Microservices Reference Architecture

> :warning: UNDER CONSTRUCTION

## The reference architecture

![IsatData Pro Macro Architecture](docs/media/isatdatapro-azure-macro-architecture.png)

This reference architecture walks you through the decision-making process 
involved in designing, developing, and delivering a back-end infrastructure for 
IoT data using Inmarsat's IsatData Pro (**IDP**) satellite messaging system. 
You will be given hands-on instructions for configuring and deploying all of the 
architecture's components, with helpful information about each component along 
the way. The goal is to provide you with practical hands-on experience 
inter-working Inmarsat IDP with several integral Azure services and the 
technologies that effectively use them in a cohesive way to build a 
serverless-based microservices architecture. We hope this will accelerate 
your solutions offerings to include satellite connectivity for managing 
remote assets, enhancing business value and delivering digital transformation.

<!--
## Customer scenario

AgriGrow is an established provider of irrigation systems. Many of AgriGrow's 
customers have field operations outside of cellular and WiFi coverage and as a 
result still have a number of time- and labour-intensive operations to manage 
yield in those areas.  If something malfunctions or is mis-positioned it could 
mean hours of ineffective or even damaging water or fertilizer distribution.  
The ability to automate some of these operations would free up specialized 
skills to proactively fix problems rather than lose time in detecting the 
problem in the first place, and in many cases could avoid the need to travel to 
the remote field.  Satellite messaging provides an economical and 
power-efficient way to automate remote machinery and improve responsiveness to 
changing operating conditions.

AgriGrow wants to provide more value to its customers and get a leading edge on 
its competition.  It needs a solution that can scale and deploy anywhere in the 
world to maximize its addressable markets, and can be connected anywhere.  The 
company's technical leadership knows that its solutions have to be easy to use 
and ultra-reliable to deliver customer excellence and success.  But they are not 
interested in maintaining infrastructure, since they feel as though their 
company's time is best spent on their core strength: delivering market leading 
agricultural productivity solutions to farmers. The details of implementation 
like serverless and cloud don't matter to their customers, but the promise of 
consumption-based pricing, where you only pay for what you use and nothing more, 
enables them to grow and adapt their solution over time. Furthermore, they have 
heard many good things about how serverless platforms help you prototype and 
develop faster by reducing the amount of code and configuration required by more 
traditional web platforms.

The AgriGrow team already uses 2G/3G/4G communications where available, and 
after researching options for remote connectivity has decided that Inmarsat's 
*IsatData Pro* service delivers global coverage, ultra-low power consumption, 
and reliable two-way communications with near real-time data delivery.

During their initial research phase consisting of comparing serverless offerings 
and creating rapid prototypes, AgriGrow's team has decided to build their 
irrigation automation application on Azure's serverless components, given the 
breadth of options and unique capabilities for orchestrating serverless 
activities, such as 
[Durable Functions](https://docs.microsoft.com/azure/azure-functions/durable-functions-overview). 
They also want to investigate using the [microservices](https://aka.ms/azure-microservices) 
pattern in their solution design, as it seems like a good fit alongside 
[Azure functions](https://docs.microsoft.com/azure/azure-functions/functions-overview), 
[API Management](https://docs.microsoft.com/azure/api-management/api-management-key-concepts), 
[Event Grid](https://docs.microsoft.com/azure/event-grid/overview), and other 
key components and services. Being able to monitor the solution as a whole is 
an important capability they want to put in place from the start, especially 
since they are relying on so many components. Finally, they wish to simplify 
the lifecycle management of all these pieces of the puzzle by applying 
[DevOps](https://docs.microsoft.com/azure/devops/learn/what-is-devops) practices 
to automate continuous integration and deployment, end-to-end.

## Explore AgriGrow's solution using serverless and microservices

[Read about AgriGrow's solution](tbd url) and overall architecture design and 
decisions. The article will briefly explain the concepts around both serverless 
and microservices, satellite messaging, and how they can be used together to 
build solutions with little to no infrastructure overhead. It will then walk you 
through the sample solution you will deploy in the lab, broken down into its 
architectural components.

## Deploy AgriGrow's solution today with a hands-on lab

After learning about AgriGrow's 
[serverless microservices architecture](docs/introduction.md), 
deploy the companion solution by following the step-by-step 
[hands-on lab](docs/setup.md), 
or take the shortcut and deploy with a few clicks [using our templates](tbd).

Each section of the lab will briefly explain what you are trying to accomplish 
and why. It will also link you to the relevant portion of the 
[architecture](documentation/architecture-overview.md).
-->

## Detailed documentation

Use the table of contents below for detailed documentation of each component of 
the reference architecture.

- [Introduction to serverless microservices](docs/introduction.md)
- [Architecture overview](docs/architecture-overview.md)
  - [Macro architecture](docs/architecture-overview.md#macro-architecture)
  - [Data flow](docs/architecture-overview.md#data-flow)
- [Initial setup](docs/setup.md)
- [API endpoints using Azure Functions](docs/api-endpoints.md)
  - [Satellite Provisioning APIs](docs/api-endpoints.md#satellite-infrastructure)
  - [Durable Orchestrators](docs/api-endpoints.md#durable-orchestrators)
- [Services intercommunication using Event Grid](docs/services-intercommunication.md)
  - [Logic App handler](docs/services-intercommunication.md#logic-app-handler)
  - [SignalR handler](docs/services-intercommunication.md#signalr-handler)
    - [JavaScript SignalR client](docs/services-intercommunication.md#javascript-signalr-client)
  - [Power BI handler](docs/services-intercommunication.md#power-bi-handler)
  - [Data Archiver handler](docs/services-intercommunication.md#trip-archiver-handler)
- [Gateway with API Management](docs/api-management.md)
- [Data storage](docs/data-storage.md)
- [Client application](docs/client-application.md)
  - [Remote Infrastructure page](docs/client-application.md#passengers-page)
  - [Authentication](docs/client-application.md#authentication)
  - [Wrapping HTTP calls with authentication token](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/client-application.md#wrapping-http-calls-with-authentication-token)
- [Monitoring and testing](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/monitoring-testing.md)
  - [Integration testing](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/monitoring-testing.md#integration-testing)
  - [Monitoring](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/monitoring-testing.md#monitoring)
    - [Telemetry correlation](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/monitoring-testing.md#telemetry-correlation)
    - [Monitoring for different audiences](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/monitoring-testing.md#monitoring-for-different-audiences)
- [Source code structure](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/source-code-structure.md)
  - [Node.js](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/source-code-structure.md#nodejs)
  - [Web](https://github.com/Azure-Samples/Serverless-microservices-reference-architecture/blob/master/documentation/source-code-structure.md#web)

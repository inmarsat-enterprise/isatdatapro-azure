# Introduction: Serverless Microservices for Satellite IoT

- [What are microservices?](#what-are-microservices)
- [What is serverless?](#what-is-serverless)
- [Next steps](#next-steps)

## What were the goals?

AgriGrow runs a lean operation yet has opportunities in a large global market. 
They needed the ability to move quickly and incrementally without a significant 
investment in new skills or infrastructure:

1. Rapid development by their lean development team who can focus on specific 
components of the solution, ideally using a single programming language.
2. Global distribution of their architecture, with automatic scaling of 
individual components based on demand.
3. Consumption-based billing that saves them money during off-peak hours.
4. The ability to deploy updates to portions of the solution without affecting 
the application as a whole.

AgriGrow recognized the value in combining the flexibility and service isolation 
of a *microservices architecture*, with the consumption-based (pay based on 
usage) distributed nature of *serverless* technologies on Azure. The 
combination of these architectures, deemed "serverless microservices", was ideal 
for helping them reach their goals for this application.

The following sections detail AgriGrow's architectural decisions, based on these 
goals.

## What are microservices?

Microservices are independent modules that are small enough to take care of a 
single action, and can be independently built, verified, deployed, and 
monitored. Applications that are based on microservices combine these 
independent modules into a highly decoupled collection, providing the following 
additional benefits over traditional "monolithic" applications:

- **Autonomous scalability**: The independent microservices modules and their 
related services can be individually and automatically scaled based on their 
respective demands without impacting the application's overall performance. The 
ability to independently scale removes the need to scale the entire app up or 
down, potentially saving costs and reducing downtime.
- **Isolated points of failure**: Each of the services can be managed 
independently, isolating potential problem areas to individual services, and 
replacing or retiring services when deprecated or unused without affecting the 
overall structure and functionality.
- **Pick what's best**: Microservices solutions let development teams use the 
best deployment approach, language, platform and programming model for each 
service, providing flexibility in choosing technologies and tools.
- **Faster value delivery**: Microservices increase agility putting new features 
in production and adding business value to solutions, as the deployment of small 
and independent modules requires much less time and several teams can be working 
on different services at the same time, reducing development time and 
simplifying deployment.

AgriGrow chose to capitalize on these benefits of a microservices architecture 
to help them build their irrigation automation solutino in a way that enables 
their teams of developers to independently focus on portions of the solution 
based on their strengths without too many dependencies on what other teams are 
working on.

[Read more information](https://aka.ms/azure-microservices) on the benefits of 
building microservice-based applications.

## What is serverless?

A serverless architecture simply means you focus "less on servers", and more on 
the functionality and features of your solution. This is because serverless 
abstracts away servers so:

* You do not need to worry about server configuration;
* Scaling of underlying resources is usually automatically handled for you based 
on load, number of messages, and other heuristics; and
* Your deployments are done at the service and application-level rather than at 
the infrastructure-level.

The end result is increased productivity, ease of development, simplified 
interoperability with other services through event-driven triggers and 
preconfigured service hooks, and increased choice of languages and tooling for 
the solution as a whole through mixing and matching various serverless 
components.

You can also [read more about serverless on Azure](https://aka.ms/serverless-azure)
for more information on the serverless components used in this solution.

## Next steps

Read an overview of the reference architecture:

- [Architecture overview](architecture-overview.md)

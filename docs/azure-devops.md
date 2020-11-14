# Deployment

## Azure DevOps

[Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/index?view=vsts)
provides development collaboration tools, source code repositories, and
DevOps-specific services, such as
[DevOps Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/?view=vsts),
that help you easily set up continuous integration and continuous delivery
(CI/CD) for your applications.

When configuring build pipelines, Azure Pipelines enables you to configure and
automate your build and delivery tools and environments in YAML (as
Infrastructure-as-Code), through the visual designer in your Azure DevOps web
portal at <https://dev.azure.com> or manually through the Azure Portal. 
The preferred method is to use YAML files, as build configurations can be 
managed in code and included as part of the CI/CD process. The visual designer 
is good when you are new to creating CI/CD pipelines or are unsure of the 
available options.

While it is possible to define your release pipeline to Azure from within the
YAML file, it is best practice to create a separate
[release pipeline](https://docs.microsoft.com/en-us/azure/devops/pipelines/release/what-is-release-management?view=vsts&WT.mc_id=azurepipelines-blog-dabrady).
This gives you the flexibility to build once and release to several places,
including deployment slots.

This section will walk you through creating a simple pipeline from the Azure 
Portal. Alternatively you can explore [Creating pipelines using YAML]().

### Prerequisites

- You need an Azure DevOps organization. If you don't have one, you can
  [create one for free](https://go.microsoft.com/fwlink/?LinkId=307137). If your
  team already has one, then make sure you're an administrator of the Azure DevOps
  project that you want to use.

- You need a GitHub account, where you can fork the repository.

### Fork the repository (optional)

1. [Follow these steps](https://docs.github.com/en/free-pro-team@latest/github/getting-started-with-github/fork-a-repo)

### Create an Azure DevOps project

1.  Sign in to <https://dev.azure.com>.

2.  Select **New Project**.

3.  Enter information into the form provided.

    1. Provide a name for your project.
       Your project name can't contain special characters, such as
       / : \ ~ & % ; @ ' " ? < > | # \$ \* } { , + = [ ],
       can't begin with an underscore, can't begin or end with a period,
       and must be 64 or fewer characters.
       Enter an optional description.
       Choose the visibility, initial source control type, and work item process.
       For more information, see
       [Choosing the right version control for your project](https://docs.microsoft.com/en-us/azure/devops/repos/tfvc/comparison-git-tfvc?view=azure-devops)
       and [Choose a process](https://docs.microsoft.com/en-us/azure/devops/boards/work-items/guidance/choose-process?view=azure-devops).
    2. Select visibility of either public or private. When you choose public
       visibility, anyone on the internet can view your project. With private
       visibility, only people who you give access to can view your project. For more
       information about public projects, see
       [Create a public project in your organization](https://docs.microsoft.com/en-us/azure/devops/organizations/public/create-public-project?view=azure-devops).
       If the **Public** option isn't available, you need to change the policy.
    3. Select **Create**
    4. You can optionally choose to [Add users to a project or team](https://docs.microsoft.com/en-us/azure/devops/organizations/security/add-users-team-project?view=azure-devops).

### Manually set up CI Deployment from Azure Portal

1. Login to <https://portal.azure.com>

2. Select your resource group e.g. `satellite-iot-serverless`.

3. Select the `satelliteMessaging` function app.

4. In the sidebar under **Deployment** select **Deployment Center**.

    1. For *Source Control* select **GitHub** (you may need to authorize your repo)
    then click **Continue**.

    2. For *Build Provider* select **Azure Pipelines** and click **Continue**.

    3. Under **Code** select your Organization, Repository and Branch (master).

    4. Under **Build** select your Azure DevOps Organization, Project and use
    Function App Type `Script Function App`.

    5. Click **Continue**, then **Finish** and wait for completion.

5. Repeat steps 3-4 for `satelliteDeviceBridge` and 
`satelliteMessagingOrchestrators`.

6. Confirm the 3 build **Pipelines** in your project at <https://dev.azure.com>.

## Next Steps

You should consider setting up staging/development pipelines and 
[learn more about pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/?view=azure-devops).
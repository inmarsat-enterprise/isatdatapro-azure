# Satellite IoT serverless microservices reference architecture

In this document:

- [Resources](#resources)
- [Provision](#provision)
    - [Manual via the Portal](#manual-via-the-portal)
        - [Create the Resource Group](#create-the-resource-group)
        - [Create the Azure Cosmos DB assets](#create-the-azure-cosmos-db-assets)
        - [Create the Storage account](#create-the-storage-account)
        - [Create the Azure Function Apps](#create-the-azure-function-apps)
        - [Create the Event Grid Topic](#create-the-event-grid-topic)
        - [Create and Configure the Notifications Logic App](#create-and-configure-the-notifications-logic-app)
        - [Create the IoT Central Application](#create-the-iot-central-application)
        <!--
        - [Create the Application Insights resource](#create-the-application-insights-resource)
        - [Create Azure Key Vault](#create-azure-key-vault)
        -->
    - [Deploy from ARM template](#deploy-from-arm-template)
- [Setup](#setup)
    - [Set up the local development environment](#set-up-the-local-development-environment)
        - [Prerequisites](#prerequisites)
        - [Clone the repository](#clone-the-repository)
        - [Configure the development environment](#configure-the-development-environment)
        - [Deploy Function Apps to Azure from VS Code](#deploy-function-apps-to-azure-from-vs-code)
    - [Configure Event Grid Subscriptions for Function Apps](#configure-event-grid-subscriptions-for-function-apps)
    <!--
    - [Function App Application Settings](#function-app-application-settings)
    - [Satellite Messaging Function App](#satellite-messaging-function-app)
    - [Device Bridge Function App](#device-bridge-function-app)
    - [Orchestrators Function App](#orchestrators-function-app)
    -->
- [Deployment](#deployment)
    - [CI using Azure DevOps](#ci-using-azure-devops)
<!--
- [Seeding](#seeding)
- [Containers](#containers)
-->

## Resources

The following is a summary of all Azure resources required to deploy the solution:

| Prod Resource Name | Dev Resource Name | Type | Provision Mode |
|---|---|---|:---:|
| satellite-iot-serverless | satellite-iot-serverless-dev | Resource Group | Auto | 
| iotstoragewarm | iotstoragewarm-dev | Cosmos DB Account | Auto |
| IsatDataPro | IsatDataProDev | Cosmos DB Container | Auto |
| idpfunctionstore | idpfunctionstore-dev | Storage Account | Auto |
| *Location*Plan | *Location*Plan | App Service (Consumption) Plan | Auto |
| satelliteMessaging | satelliteMessagingDev | Function App | Auto |
| satelliteMessagingOrchestrators | satelliteMessagingOrchestratorsDev | Function App | Auto |
| satelliteMessagingDeviceBridge | satelliteMessagingDeviceBridgeDev | Function App | Auto |
| SatelliteMessagingExternalizations | SatelliteMessagingExternalizationsDev | Event Grid Topic | Manual |
| IdpApiNotifications | IdpApiNotificationsDev | Logic App | Manual |
| isatdatapro | isatdatapro-dev | Application Insights | Manual |
<!--
| IdpVault | IdpVaultDev | Azure Key Vault | Manual |
| IdpAdminAppServicePlan | IdpAdminAppServicePlanDev | Web App Service Plan | Auto |
| IdpAdmin | IdpAdminDev | Web App Service | Auto |
| idpadmin | N/A | API Management Service | Manual |
-->

> :exclamation: **Please note** that, in some cases, the resource names 
must be unique globally. We suggest you append an identifier to the above 
resource names so they become unique i.e. `isatdatapro-xyzw`, etc.

[Top](#satellite-iot-serverless-microservices-reference-architecture)

## Provision

### Manual via the Portal

Log in to the [Azure portal](https://portal.azure.com).

#### Create the Resource Group

1.  Type **Resource** into the Search box at the top of the `All Services` 
page, then select **Resource Groups**  section.

2.  Click the **Add** button to create a new resource group.

3.  Complete the resource group creation form with the following:

    1. **Name**: Enter a unique value for the **resource group** 
    e.g. `satellite-iot-serverless`.
    2. **Subscription**: Select your Azure subscription.
    3. **Location**: Select a region closest to you. Make sure you select the 
    same region for the rest of your resources.

    ![Screenshot of the resource group form](media/resource-group-creation.png)

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Create the Azure Cosmos DB assets

1.  Type **Cosmos** into the Search box at the top of the `All Services` page, 
then select **Azure Cosmos DB**  section.

2.  Click the **Add** button to create a new Cosmos DB Account.

3.  Complete the resource group creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Group**: Select the Resource Group you created above, 
    such as `satellite-messaging`.
    3. **Account Name**: Enter a unique ID for the **Cosmos DB Account**, 
    such as `iotstoragewarm`.
    4. **API**: Select `Core (SQL)`.
    5. **Location**: Select a region closest to you. Make sure you select the 
    same region for the rest of your resources.
    6. **Capacity mode** Select `Provisioned throughput`
    7. **Geo-Redundancy**: Disable.
    8. **Multi-region Writes**: Disable.

    ![Screenshot of the Cosmos DB form](media/comos-creation.png)

4.  Select **Review + Create**, then select **Create** on the review screen.

    **Please note** that this process of creating a Cosmos DB Account can take 
    between 5-10 minutes.

5.  Once Cosmos Database is online, open it and select **Data Explorer** on the 
left-hand menu.

6.  (Optional) Select **New Container** on the toolbar. In the Add Container 
form that appears, enter the following:

    1. **Database ID**: Select **Create new** and enter `IsatDataPro`.
    2. **Container Id**: Enter `Main`.
    3. **Partition key**: Enter `/category`.
    4. **Throughput**: Select `400`.

7.  (Optional) Repeat step 6 for a new container called `IsatDataProDev`

8.  Open **Keys** and take note of the DB **URI** and **Primary Key**:

    ![Screenshot of the cosmos DB account](media/comos-creation2.png)

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Create the Storage account

1.  Type **Storage** into the Search box at the top of the `All Services` page, 
then select **Storage accounts**  section.

2.  Click the **Add** button to create a new Storage Account.

3.  Complete the storage creation form with the following:

    1. **Name**: Enter a unique name for the **Storage Account** 
    e.g. `idpfunctionstore`.
    2. **Deployment Model**: Select `Resource Manager`.
    3. **Account Kind**: Select `Storage V2`.
    4. **Location**: Select a region closest to you. Make sure you select the 
    same region for the rest of your resources.
    5. **Subscription**: Select your Azure subscription.
    6. **Resource Group**: Select the resource group to which you have added 
    your other services, such as `satellite-iot-serverless`.
    7. **Replication**: Select `RA-GRS`

    ![Screenshot of the storage creation](media/storage-creation.png)

4.  Take note of the DB Account keys:

    ![Screenshot of the storage account](media/storage-creation2.png)

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Create the Azure Function Apps

In this step, you will be creating several new Azure Function Apps in the Azure 
portal. There are many ways this can be accomplished, such as 
[Visual Studio Code](https://docs.microsoft.com/en-us/azure/azure-functions/functions-develop-vs-code), 
[Visual Studio](https://docs.microsoft.com/en-us/azure/azure-functions/functions-develop-vs), 
[Azure CLI](https://docs.microsoft.com/en-us/azure/azure-functions/functions-create-first-azure-function-azure-cli?tabs=bash%2Cbrowser&pivots=programming-language-javascript), Azure [Cloud Shell](https://docs.microsoft.com/en-us/azure/azure-functions/scripts/functions-cli-create-function-app-vsts-continuous),
[Azure Resource Manager (ARM) template](https://docs.microsoft.com/en-us/azure/azure-functions/functions-create-first-function-resource-manager?tabs=visual-studio-code%2Cazure-cli), 
and through the Azure portal.

Each of these Function Apps act as a hosting platform for one or more functions. 
In our solution, they double as microservices with each function serving as an 
endpoint or method. Having functions distributed amongst multiple function apps 
enables isolation, providing physical boundaries between the microservices, as 
well as independent release schedules, administration, and scaling.

1.  Log in to the [Azure portal](https://portal.azure.com).

2.  Type **Function App** into the Search box at the top of the page, then 
select **Function App** within the Marketplace section.

3.  Complete the function app creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Group**: Select the resource group to which you have added 
    your other services, such as `satellite-iot-serverless`.
    3. **Function App name**: Enter a unique value for the 
    **`satelliteMessaging`** function app.
    4. **Publish**: Select `Code`.
    5. **Runtime stack**: Select `Node.js`.
    6. **Version**: Select `10 LTS`.
    7. **Region**: Select a region closest to you. Make sure you select the 
    same region as the rest of your resources.
    8. Click **Next: Hosting >**
    9. **Storage Account**: Select the storage account created above e.g. 
    `idpfunctionstore`.
    10. **Operating System**: Select `Windows`.
    11. **Plan Type**: Select `Consumption (Serverless)`.
    12. Click **Next: Monitoring >**
    9. **Enable Application Insights**: Select `No`. We will create an 
    Application Insights instance later that will be associated with all of the 
    Function Apps and other services.

    ![Screenshot of the Function App creation form](media/new-function-app-form.png 'Create Function App form')

4.  Repeat the steps above to create the **satelliteMessagingOrchestrators** and 
**satelliteMessagingDeviceBridge** function apps.

    - Enter a unique value for the App name, ensuring it has the word **tbd** 
    within the name so you can easily identify it.
    - Make sure you enter the same remaining settings and select the storage 
    account you created in the previous step.

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Create the Event Grid Topic

1.  Type **Event Grid Topic** into the Search box at the top of the 
`All Services` page, then select **Event Grid Topic**  in Marketplace.

2.  Complete the event grid topic creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Group**: Select the resource group to which you have added 
    your other services, such as `satellite-iot-serverless`.
    3. **Name**: Enter a unique value for the Event Grid **Topic** 
    i.e. `SatelliteMessagingExternalizations`.
    4. **Location**: Select a region closest to you. Make sure you select the 
    same region as the rest of your resources.
    5. Click the **Review + create** button.
    6. Once completed, click the resource group link, then click the Event Grid 
    Topic link.

    ![Screenshot of the Event Grid Topic form](media/event-grid-topic-creation.png)

3. Take note of the newly-created topic endpoint URL:

    ![Screenshot of the Event Grid Topic endpoint](media/event-grid-topic-creation2.png)

5. Take note of the newly-created topic key from Settings > Access Keys:

    ![Screenshot of the Event Grid Topic key](media/event-grid-topic-creation3.png)

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Create and Configure the Notifications Logic App

1.  In the Azure portal, type **Logic Apps** into the Search box at the top of 
the `All Services` page, then select **Logic Apps**  section.

2.  Click the **Add** button to create a new Logic App.

3.  Complete the logic app creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource group**: Select your existing Resource Group.
    3. **Logic App name**: Enter a unique value for the logic app i.e. 
    `IdpApiNotifications`.
    4. **Location**: Select a region closest to you. Make sure you select the 
    same region for the rest of your resources.
    5. **Log Analytics**: (Optional) Turn on Log Analytics and reference your 
    existing workspace/project.

    ![Screenshot of the Logic App form](media/logic-app-creation1.png)

4. Once the resource is created, navigate to it and select `Blank Logic App`. 
In the `Search connectors and triggers`, type `Event Grid` and select the 
`Azure Event Grid` trigger, then `When a resource event occurs`.

5. In the dialog for `When a resource event occurs` complete the form:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Type**: Select `Microsoft.EventGrid.Topics`.
    3. **Resource Name**: Select the Event Grid Topic you provisioned i.e. 
    `SatelliteMessagingExternalizations`.
    4. **Event Type Item - 1**: Enter `ApiOutage` and use it as a custom value.
    5. **Event Type Item - 2**: Enter `ApiRecovery` and use it as a custom value.

    ![Screenshot of the Logic App form](media/logic-app-creation2.png)

6. Then click on the `New Step` and type in the `Choose an action` search box 
`SendGrid` and click the SendGrid icon:

    1. Select `Send Email (v4)`.
    2. You may need to setup a [SendGrid account](https://sendgrid.com/) if you 
    have not done so already. Create a `Full Access` API key and store it in a 
    secure location.
    3. **Connection Name**: a unique name i.e. `IdpApiNotificationSendGrid`

7. Fill out the Send email (V4) form:
    1. **From**: The email address you wish this notification be sent from
    2. **To**: The email address(es) you wish this notification be sent to
    3. **Subject**: Enter a subject e.g. `IsatData Pro: `. You can include the 
    event type by adding Dynamic Content i.e. `Event Type`
    4. **Body**: If you select this field, you can type whatever static content 
    you want and/or pick from one the dynamic fields shown. Search for `data` 
    in Dynamic content and select `Data object`.

    ![Screenshot of the Logic App sender](media/logic-app-creation3.png)

8. Click `Save`.

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Create the IoT Central Application

1.  Type **IoT Central** into the Search box at the top of the `All Services` 
page, then select **IoT Central Application**  section.

2.  Click the **Create** button to create a new IoT Central Application.

3.  Complete the IoT Central Application creation form with the following:

    1. **Resource Name**: Enter a name for the application such as 
    `satellite-iot`.  The Application URL should complete automatically.
    2. **Subscription**: Select your Azure subscription.
    3. **Resource Group**: Select the resource group to which you have added 
    your other services, such as `satellite-iot-serverless`.
    4. **Pricing Plan**: Select `Standard 1`.
    5. **Template**: Select `Custom application`.
    6. **Location**: Select a location closest to you, ideally the same as your 
    resource group.

4. Click the **Create** button.

5. Once the creation is complete, go to the resource and click the 
**IoT Central Application URL**.

6. From the IoT Central Application, click **Administration**, then click 
**API tokens**, then click **Generate token** and complete the form:

    1. **Token name**: Enter a unique value i.e. `device-templates`.
    2. **Role**: Select `Builder`.
    3. Click **Generate** then copy the token and save it in a secure location.

7. From the IoT Central **Administration** menu, click **Device connection** 
and then:

    1. Make note of the **ID Scope**
    2. Enable **Auto-approve new devices** (On)
    3. If no enrollment group exists, click **Create enrollment group** and 
    complete the form using **Group type** `IoT Devices` and 
    **Attestation type** `Shared access signature (SAS)`
    4. Once the enrollment group has been created, open it and take note of 
    the **Primary key**

[Top](#satellite-iot-serverless-microservices-reference-architecture)

### Deploy from ARM template

> :TODO

[Top](#satellite-iot-serverless-microservices-reference-architecture)

## Setup

### Set up the local development environment

#### Prerequisites

You should have [**VS Code**](https://code.visualstudio.com/) installed on your 
local machine, along with the following Extensions:
  * **Azure Account**
  * [**Azure Functions**](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
  * **ESLint**
  * **DTDL**
  * **Azure Databases**
  * [**Deploy to Azure**](https://marketplace.visualstudio.com/items?itemName=ms-vscode-deploy-azure.azure-deploy)
  * **Azure Resource Manager (ARM) Tools**

You should have a Long-Term Support (LTS) version of 
[**Node.js**](https://nodejs.org) version 10 or 12 installed locally.

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Clone the repository

1. In a console or Powershell enter
`git clone https://github.com/Inmarsat/isatdatapro-azure.git`

2. Install the npm packages in each folder using `npm install`.

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Configure the development environment

1. Launch the VS code workspace by opening `isatdatapro-azure.code-workspace`.

2. Open the **Command Palette (F1)** enter 
**Azure Functions: Install or Update Azure Functions Core Tools**, and press 
**Enter** to run the command.

3. Configure the `local.settings.json` file for **satellite-messaging** Values:
    ```
    "DB_TYPE": "azureCosmos",
    "COSMOS_DB_HOST": "<yourCosmosDbUri>",
    "COSMOS_DB_PASS": "<yourCosmosDbPrimaryKey>",
    "COSMOS_DB_NAME": "IsatDataPro",
    "COSMOS_DB_CONTAINER": "Main",
    "COSMOS_DB_PARTITION": "category",
    "COSMOS_DB_THROUGHPUT": "400",
    "MAILBOX_SECRET": "<yourPrivateEncryptionKey>",
    "EVENTGRID_TOPIC_KEY": "<yourEventGridTopicKey>",
    "EVENTGRID_TOPIC_ENDPOINT": "<yourEventGridTopicEndpoint>",
    ```

4. Configure the `local.settings.json` file for **device-bridge** Values:
    ```
    "IOTC_APPLICATION_URL": "<yourIotCentralUrl",
    "IOTC_ID_SCOPE": "<yourIdScope>",
    "IOTC_GROUP_ENROLL_SAS_KEY": "<yourPrimarySasKey>",
    "IOTC_BUILDER_TOKEN": "<yourBuilderToken>",
    "EVENTGRID_TOPIC_KEY": "<yourEventGridTopicKey>",
    "EVENTGRID_TOPIC_ENDPOINT": "<yourEventGridTopicEndpoint>",
    ```

5. Configure the `local.settings.json` file for **orchestrators** Values:
    ```
    "EVENTGRID_TOPIC_KEY": "<yourEventGridTopicKey>",
    "EVENTGRID_TOPIC_ENDPOINT": "<yourEventGridTopicEndpoint>",
    "INSTANCE_MAX_AGE_SECONDS": "3600",
    ```

[Top](#satellite-iot-serverless-microservices-reference-architecture)

#### Deploy Function Apps to Azure from VS Code

1. In VS Code, select the Azure logo to open the **Azure Explorer**, then under 
**FUNCTIONS**, select the blue "up" arrow to deploy each app:

    1. **satellite-messaging** folder should be deployed to your 
    **satelliteMessaging** app created previously in Azure portal.
    2. **device-bridge** folder should be deployed to your 
    **satelliteMessagingDeviceBridge** app created previously in Azure portal.
    3. **orchestrators** folder should be deployed to your 
    **satelliteMessagingOrchestrators** app created previously in Azure portal.

2. After each app is deployed, expand it in Azure Explorer to find and 
right-click **Application Settings** then **Upload Local Settings**.

[Top](#satellite-iot-serverless-microservices-reference-architecture)

### Configure Event Grid Subscriptions for Function Apps

1. In the Azure portal, select the **Event Grid Topic** resource you created 
earlier.

2. Click **+ Event Subscription** and complete the form:

    1. **Name**: The unique subscription name i.e. `DeviceToCloudBridge`
    2. Under **Event Types** click **Add Event Type** and enter 
    `NewReturnMessage`, `OtaCommandResponse`
    3. **Endpoint Type**: select `Azure Function` then click 
    **Select an endpoint**:
        a. **Function app**: select `satelliteMessagingDeviceBridge`
        b. **Function**: select `DeviceToCloudBridge`
        c. Click **Confirm selection**
    4. Click **Create**

3. Repeat step #2 using the following configurations for each subscription:

    | Subscription Name | Event Types | Function app | Function |
    |---|---|---|---|
    |`OrchestratorCommandRequest`|`CommandRequest`|`satelliteMessagingOrchestrators`|`OtaCommandStart`|
    |`NewForwardSubmission`|`NewForwardSubmission`|`satelliteMessaging`|`MessageForwardSubmit`|
    |`OrchestratorCommandSending`|`NewForwardMessage`|`satelliteMessagingOrchestrators`|`OtaCommandSending`|
    |`OrchestratorForwardMessageStateChange`|`ForwardMessageStateChange`|`satelliteMessagingOrchestrators`|`OtaCommandDelivery`|
    |`OrchestratorCommandResponse`|`NewReturnMessage`|`satelliteMessagingOrchestrators`|`OtaCommandResponse`|
    |`MailboxUpdate`|`MailboxUpdate`|`satelliteMessaging`|`MailboxUpdate`|
    |`SatelliteGatewayUpdate`|`SatelliteGatewayUpdate`|`satelliteMessaging`|`SatelliteGatewayUpdate`|
    |`OtherClientForwardSubmission`|`OtherClientForwardSubmission`|`satelliteMessaging`|`ForwardMessageGet`|
    |`NewMobileFetch`|`NewMobile`|`satelliteMessaging`|`MobileGet`|

[Top](#satellite-iot-serverless-microservices-reference-architecture)

## Deployment

### CI using Azure DevOps

[Azure DevOps](azure-devops.md)

[Top](#satellite-iot-serverless-microservices-reference-architecture)

<!--
#### Create the Web App

1.  Type **Web App** into the Search box at the top of the `All Services` page, 
then select **Web App** from the Marketplace.

2.  Complete the app service creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Group**: Select the resource group to which you have added your other services, such as `satellite-iot-serverless`.
    3. **Name**: Enter a unique value for the i.e. `SatelliteMessagingAdmin`.
    4. **Runtime stack**: Choose a preferred Node version e.g. `Node 10 LTS`
    5. **Operating system**: Select preference i.e. Windows or `Linux`
    6. **App Service Plan**: Select existing or create a new Free Tier.
    7. **Application Insights**: Select `Off`.

    ![Screenshot of the app service](media/app-service-creation.png)

3. Click the **Review + Create** button, then **Create**

#### Create a Log Analytics Workspace resource

1.  Type **Log Analytics** into the Search box at the top of the 
`All Services` page, then select **Application Insights**  from the Marketplace.

2.  Complete the Log Analytics workspace creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Group**: Select the resource group to which you have added 
    your other services, such as `satellite-iot-serverless`.
    3. **Name**: Enter a unique value e.g. `SatelliteIotMessaging`.
    4. **Region**: Select the same region as your other resources.

    ![Screenshot of the log analytics form](media/log-analytics-workspace-creation.png)

3. Click the **Review + Create** button, then **Create**

#### Create the Application Insights resource

1.  Type **Application Insights** into the Search box at the top of the 
`All Services` page, then select **Application Insights**  from the Marketplace.

2.  Complete the application insights creation form with the following:

    1. **Subscription**: Select your Azure subscription.
    2. **Resource Group**: Select the resource group to which you have added 
    your other services, such as `satellite-iot-serverless`.
    3. **Name**: Enter a unique value e.g. `SatelliteMessagingMonitor`.
    4. **Resource mode**: Use the default `Workspace-based`.
    5. **Log analytics workspace**: Select the workspace created in the prior 
    steps.

    ![Screenshot of the Application Insights form](media/application-insights-creation.png)

3. Click the **Review + Create** button, then **Create**

4. Take note of the newly-created resource instrumentation key:

    ![Screenshot of the Application Insights instrumentation key](media/application-insights-creation2.png)


#### Create the API Management Service

1.  Type **API Management** into the Search box at the top of the `All Services` page, then select **API Management**  section.

2.  Click the **Add** button to create a new API Management service.

3.  Complete the API Management service creation form with the following:

    1. **Name**: Enter a unique value for the APIM Service i.e. `rideshare`.
    2. **Subscription**: Select your Azure subscription.
    3. **Resource Group**: Select the resource group to which you have added your other services, such as `satellite-iot-serverless`.
    3. **Location**: Select a region closest to you. Make sure you select the same region for the rest of your resources.
    5. **Organization name**: Type in your organization name.
    6. **Administrator email**: Type in an admin email.
    7. **Pricing tier**: Select `Developer (No SLA)`.

    ![Screenshot of the API Management form](media/apim-creation.png)

#### Create Azure Key Vault

Azure Key Vault is used to securely store all secrets, such as database connection strings and keys. It is accessible by all Function Apps, which helps prevent storing duplicate values.

1.  Click **Create a resource** and type **Key Vault** into the Search box, then select **Key Vault** from the search results.

2.  Click the **Create** button to create a new Key Vault.

3.  Complete the Key Vault service creation form with the following:

    1. **Resource Name**: Enter a unique value for Key Vault, such as `RideshareVault`.
    2. **Subscription**: Select your Azure subscription.
    3. **Resource Group**: Select the resource group to which you have added your other services, such as `satellite-iot-serverless`.
    4. **Location**: Select a region closest to you. Make sure you select the same region for the rest of your resources.
    5. **Pricing tier**: Select `Standard`.
    6. **Access policies**: Leave as default.
    7. **Virtual Network Access**: Leave as default (all networks can access).

    ![Screenshot of the Key Vault form](media/key-vault-creation.png)
-->
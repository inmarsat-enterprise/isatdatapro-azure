# Azure Resource Manager Templates

>:warning: Work in Progress

* Uses a [linked templates](https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/linked-templates?tabs=azure-powershell#linked-template) approach.

## Prerequisites

You must have an Azure account. If you don't have one you can get one free for
12 months: [Start Azure Free](https://azure.microsoft.com/en-us/free/)

You must [create a subscription](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/create-subscription) in your Azure account. You subscription name should include
`IoT`.

>If your company already uses Azure, you may need to request your IT department
to create a subscription for you.

You must [install Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
to use these commands.

### Determine your closest Azure location

https://azure.microsoft.com/en-ca/explore/global-infrastructure/geographies/#overview

## Deploy

1. Login to Azure CLI using `az login`.

1. Store your Azure subscription ID in the `parameters.json` file:
    ```
    subscriptionId="$(az account list --query "[?contains(name, 'IoT')].id" -o tsv)"
    sed -i '' "s|{subscription-id}|$subscriptionId|" "./parameters.json"
    ```

1. Get a list of available resource locations (sorted alphabetically), then pick
the one closest to you and set the variable `rgLocation`:
    ```
    az account list-locations --query "[*].name" --out tsv | sort
    location=<closestLocation>
    ```

1. Create an empty resource group named `satellite-iot-serverless`:
    ```
    az deployment sub create \
      --subscription $subscriptionId \
      --name satelliteIotSubDeployment \
      --location $location \
      --template-uri "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/subscription-deployments/create-rg/azuredeploy.json" \
      --parameters rgName=satellite-iot-serverless
    ```

1. Deploy the template
    ```
    az deployment group create \
      --name satalliteIotDeployment \
      --resource-group satellite-iot-serverless \
      --template-file azuredeploy.json \
      --parameters @azuredeploy.parameters.json
    ```

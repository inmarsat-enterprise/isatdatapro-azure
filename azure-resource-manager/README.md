# Azure Resource Manager Templates

>:warning: Work in Progress

* Uses a [linked templates](https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/linked-templates?tabs=azure-powershell#linked-template) approach.

You must [install Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
to use these commands.

## Query available locations

```
az provider show \
  --namespace Microsoft.Batch \
  --query "resourceTypes[?resourceType=='batchAccounts'].locations | [0]" \
  --out table
```

## Deploy

1. Create the resource group
    ```
    az deployment sub create --template-file resourceGroup.json
    ```
    or...
    ```
    az group create \
        --name satellite-iot-serverless \
        --location "Central US"
    ```

```
az deployment group create \
  --name SatelliteIotDeployment \
  --template-file main.json \
  --parameters @parameters.json
```
#!/bin/bash
# Stock Scraper - Setup Azure Logic App for daily scheduling
# Creates automatic daily execution at 2 AM JST

set -e

echo "⏰ Stock Scraper - Setting up daily scheduler (Logic App)..."

# Configuration
RESOURCE_GROUP="yuyama"
LOGIC_APP_NAME="stock-scraper-daily-scheduler"
CONTAINER_GROUP_NAME="stock-scraper-daily"
SUBSCRIPTION_ID=$(az account show --query id --output tsv)

# Create the daily container group that will be restarted by Logic App
echo "📦 Creating daily container group..."
ACR_NAME="qastregistry"
IMAGE_NAME="stock-scraper:ubuntu"
STORAGE_ACCOUNT="yuyamablobstorage"

# Get credentials
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
ACR_USERNAME=$(az acr credential show --name ${ACR_NAME} --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name ${ACR_NAME} --query passwords[0].value --output tsv)
STORAGE_KEY=$(az storage account keys list --resource-group ${RESOURCE_GROUP} --account-name ${STORAGE_ACCOUNT} --query '[0].value' --output tsv)
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net"

# Delete existing container group if exists
az container delete \
    --resource-group ${RESOURCE_GROUP} \
    --name ${CONTAINER_GROUP_NAME} \
    --yes \
    2>/dev/null || true

# Create container group for daily execution
az container create \
    --resource-group ${RESOURCE_GROUP} \
    --name ${CONTAINER_GROUP_NAME} \
    --image "${ACR_LOGIN_SERVER}/${IMAGE_NAME}" \
    --os-type Linux \
    --registry-login-server ${ACR_LOGIN_SERVER} \
    --registry-username ${ACR_USERNAME} \
    --registry-password ${ACR_PASSWORD} \
    --cpu 4 \
    --memory 8 \
    --restart-policy Never \
    --environment-variables \
        NODE_ENV=production \
        HEADLESS=true \
        DEBUG=false \
        STOCK_LOGIN_URL=https://www.stock-app.jp/teams/sign-in \
        STOCK_URL=https://www.stock-app.jp/teams/c20282/dashboard \
        TEST_MODE=false \
        SCRAPE_CONCURRENCY=2 \
        SCRAPE_BATCH_SIZE=5 \
        SCRAPE_TIMEOUT_MS=120000 \
        PAGE_LOAD_DELAY=5000 \
        REQUEST_DELAY_MS=5000 \
        SCRAPE_DELAY_MS=5000 \
        BATCH_DELAY_MS=2000 \
        MAX_RETRY_ATTEMPTS=3 \
        NETWORK_TIMEOUT=90000 \
        AZURE_STORAGE_CONNECTION_STRING="${AZURE_STORAGE_CONNECTION_STRING}" \
    --log-analytics-workspace "yuyama-batch-logs"

echo "⏱️ Creating Logic App for daily scheduling..."

# Logic App definition for daily execution at 2 AM JST
LOGIC_APP_DEFINITION=$(cat << 'EOF'
{
    "definition": {
        "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {},
        "triggers": {
            "Recurrence": {
                "recurrence": {
                    "frequency": "Day",
                    "interval": 1,
                    "schedule": {
                        "hours": ["2"],
                        "minutes": [0]
                    },
                    "timeZone": "Tokyo Standard Time"
                },
                "type": "Recurrence"
            }
        },
        "actions": {
            "RestartStockScraperContainer": {
                "type": "Http",
                "inputs": {
                    "method": "POST",
                    "uri": "https://management.azure.com/subscriptions/SUBSCRIPTION_ID/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ContainerInstance/containerGroups/CONTAINER_GROUP_NAME/restart?api-version=2023-05-01",
                    "authentication": {
                        "type": "ManagedServiceIdentity"
                    }
                },
                "runAfter": {}
            }
        }
    }
}
EOF
)

# Replace placeholders in Logic App definition
LOGIC_APP_DEFINITION=$(echo "$LOGIC_APP_DEFINITION" | sed "s/SUBSCRIPTION_ID/${SUBSCRIPTION_ID}/g")
LOGIC_APP_DEFINITION=$(echo "$LOGIC_APP_DEFINITION" | sed "s/RESOURCE_GROUP/${RESOURCE_GROUP}/g")
LOGIC_APP_DEFINITION=$(echo "$LOGIC_APP_DEFINITION" | sed "s/CONTAINER_GROUP_NAME/${CONTAINER_GROUP_NAME}/g")

# Save Logic App definition to temporary file
echo "$LOGIC_APP_DEFINITION" > /tmp/stock-scraper-logic-app.json

# Create Logic App
echo "📝 Creating Logic App workflow..."
az logic workflow create \
    --resource-group ${RESOURCE_GROUP} \
    --name ${LOGIC_APP_NAME} \
    --definition /tmp/stock-scraper-logic-app.json

# Enable managed identity for the Logic App
echo "🔐 Enabling managed identity..."
az logic workflow identity assign \
    --resource-group ${RESOURCE_GROUP} \
    --name ${LOGIC_APP_NAME}

# Get the managed identity principal ID
PRINCIPAL_ID=$(az logic workflow identity show \
    --resource-group ${RESOURCE_GROUP} \
    --name ${LOGIC_APP_NAME} \
    --query principalId \
    --output tsv)

# Assign Contributor role to the managed identity for container operations
echo "🎭 Assigning permissions..."
az role assignment create \
    --assignee ${PRINCIPAL_ID} \
    --role "Contributor" \
    --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ContainerInstance/containerGroups/${CONTAINER_GROUP_NAME}"

# Clean up temporary file
rm -f /tmp/stock-scraper-logic-app.json

echo "✅ Stock Scraper daily scheduler setup complete!"
echo ""
echo "📊 Configuration summary:"
echo "Logic App: ${LOGIC_APP_NAME}"
echo "Container Group: ${CONTAINER_GROUP_NAME}"
echo "Schedule: Daily at 2:00 AM JST"
echo "Resource Group: ${RESOURCE_GROUP}"
echo ""
echo "🔍 Monitor Logic App runs:"
echo "az logic workflow show --resource-group ${RESOURCE_GROUP} --name ${LOGIC_APP_NAME}"
echo ""
echo "⚙️ To change the schedule time, edit line 27 of this script and re-run"
#!/bin/bash
# Stock Scraper - ACI test deployment
# Small-scale test on Azure Container Instances (5 items)

set -e

echo "🧪 Stock Scraper - Testing on Azure Container Instances..."

# Configuration
RESOURCE_GROUP="yuyama"
CONTAINER_NAME="stock-scraper-test"
ACR_NAME="qastregistry"
IMAGE_NAME="stock-scraper:ubuntu"
STORAGE_ACCOUNT="yuyamablobstorage"

# Get the ACR login server and credentials
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
ACR_USERNAME=$(az acr credential show --name ${ACR_NAME} --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name ${ACR_NAME} --query passwords[0].value --output tsv)

# Get storage account key
STORAGE_KEY=$(az storage account keys list --resource-group ${RESOURCE_GROUP} --account-name ${STORAGE_ACCOUNT} --query '[0].value' --output tsv)
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net"

echo "🗑️ Cleaning up any existing test container..."
az container delete \
    --resource-group ${RESOURCE_GROUP} \
    --name ${CONTAINER_NAME} \
    --yes \
    2>/dev/null || true

echo "🚀 Starting ACI test container..."
az container create \
    --resource-group ${RESOURCE_GROUP} \
    --name ${CONTAINER_NAME} \
    --image "${ACR_LOGIN_SERVER}/${IMAGE_NAME}" \
    --os-type Linux \
    --registry-login-server ${ACR_LOGIN_SERVER} \
    --registry-username ${ACR_USERNAME} \
    --registry-password ${ACR_PASSWORD} \
    --cpu 2 \
    --memory 4 \
    --restart-policy Never \
    --environment-variables \
        NODE_ENV=test \
        HEADLESS=true \
        DEBUG=false \
        STOCK_LOGIN_URL=https://www.stock-app.jp/teams/sign-in \
        STOCK_URL=https://www.stock-app.jp/teams/c20282/dashboard \
        TEST_MODE=true \
        MAX_URLS_COLLECT=10 \
        MAX_SCRAPE_COUNT=5 \
        SCRAPE_CONCURRENCY=1 \
        SCRAPE_BATCH_SIZE=3 \
        SCRAPE_TIMEOUT_MS=90000 \
        PAGE_LOAD_DELAY=4000 \
        REQUEST_DELAY_MS=3000 \
        SCRAPE_DELAY_MS=3000 \
        BATCH_DELAY_MS=1000 \
        MAX_RETRY_ATTEMPTS=2 \
        NETWORK_TIMEOUT=60000 \
        AZURE_STORAGE_CONNECTION_STRING="${AZURE_STORAGE_CONNECTION_STRING}" \
        STOCK_EMAIL="tool@eraxai.info" \
        STOCK_PASSWORD="Ma37533259@" \
    --log-analytics-workspace "yuyama-batch-logs"

echo "⏳ Waiting for container to complete..."
echo "You can monitor progress with:"
echo "az container logs --resource-group ${RESOURCE_GROUP} --name ${CONTAINER_NAME} --follow"

# Wait for completion
while true; do
    STATE=$(az container show --resource-group ${RESOURCE_GROUP} --name ${CONTAINER_NAME} --query containers[0].instanceView.currentState.state --output tsv)
    if [ "$STATE" = "Terminated" ]; then
        EXIT_CODE=$(az container show --resource-group ${RESOURCE_GROUP} --name ${CONTAINER_NAME} --query containers[0].instanceView.currentState.exitCode --output tsv)
        echo "✅ Container completed with exit code: $EXIT_CODE"
        break
    fi
    echo "Container state: $STATE - waiting..."
    sleep 30
done

echo "📋 Final logs:"
az container logs --resource-group ${RESOURCE_GROUP} --name ${CONTAINER_NAME}

if [ "$EXIT_CODE" = "0" ]; then
    echo "✅ Test completed successfully!"
    echo "Next step: ./scripts/deploy-production.sh"
else
    echo "❌ Test failed with exit code: $EXIT_CODE"
    exit 1
fi
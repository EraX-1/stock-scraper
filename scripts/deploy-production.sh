#!/bin/bash
# Stock Scraper - Production deployment for full-scale scraping
# Deploys with high-performance configuration (all available stock data)

set -e

echo "🏭 Stock Scraper - Production deployment (全件実行)..."

# Configuration
RESOURCE_GROUP="yuyama"
CONTAINER_NAME="stock-scraper-production"
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

echo "🗑️ Cleaning up any existing production container..."
az container delete \
    --resource-group ${RESOURCE_GROUP} \
    --name ${CONTAINER_NAME} \
    --yes \
    2>/dev/null || true

echo "🚀 Starting production container (4 vCPU, 8GB RAM)..."
echo "📊 Target: All available stock data"
echo "⏱️ Expected runtime: 2-3 hours"
echo "💰 Estimated cost: ¥200-300"

az container create \
    --resource-group ${RESOURCE_GROUP} \
    --name ${CONTAINER_NAME} \
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
        STOCK_EMAIL="tool@eraxai.info" \
        STOCK_PASSWORD="Ma37533259@" \
    --log-analytics-workspace "yuyama-batch-logs"

echo "✅ Production container started successfully!"
echo ""
echo "📊 Container details:"
echo "Name: ${CONTAINER_NAME}"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "CPU: 4 vCPU"
echo "Memory: 8GB"
echo "Target: 全Stock文書（動的収集）"
echo ""
echo "🔍 Monitor with:"
echo "az container logs --resource-group ${RESOURCE_GROUP} --name ${CONTAINER_NAME} --follow"
echo ""
echo "📈 Check status with:"
echo "az container show --resource-group ${RESOURCE_GROUP} --name ${CONTAINER_NAME} --query containers[0].instanceView.currentState"
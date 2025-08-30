#!/bin/bash
# Stock Scraper - Push to Azure Container Registry
# Pushes the AMD64 image to qastregistry (shared with qast-scraper)

set -e

echo "📤 Stock Scraper - Pushing to Azure Container Registry..."

# Azure Container Registry settings (same as qast-scraper)
ACR_NAME="qastregistry"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
IMAGE_NAME="stock-scraper"
TAG="ubuntu"

echo "🏷️ Tagging image for registry..."
docker tag stock-scraper:ubuntu "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${TAG}"
docker tag stock-scraper:ubuntu "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

echo "🔐 Logging in to Azure Container Registry..."
az acr login --name ${ACR_NAME}

echo "📤 Pushing images to registry..."
docker push "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${TAG}"
docker push "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

echo "✅ Successfully pushed to Azure Container Registry!"
echo ""
echo "📊 Registry information:"
echo "Registry: ${ACR_LOGIN_SERVER}"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo "Image: ${IMAGE_NAME}:latest"
echo ""
echo "Next step: ./scripts/test-ubuntu-aci.sh"
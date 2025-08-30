#!/bin/bash
# Stock Scraper - AMD64 override build for Azure Container Instances
# Rebuilds the image for production AMD64 architecture

set -e

echo "🔄 Stock Scraper - Rebuilding for AMD64 (Azure Container Instances)..."

# Build the Docker image for AMD64 production
echo "🔨 Building Docker image for AMD64 (production)..."
docker build \
    -f Dockerfile.ubuntu \
    --platform linux/amd64 \
    -t stock-scraper:ubuntu .

echo "✅ AMD64 production image built successfully!"
echo ""
echo "📊 Image details:"
docker images stock-scraper:ubuntu

echo ""
echo "Next step: ./scripts/push-ubuntu-to-registry.sh"
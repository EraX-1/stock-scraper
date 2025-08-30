#!/bin/bash
# Stock Scraper - Local test build for ARM64 (M3 Mac)
# Based on qast-scraper deployment architecture

set -e

echo "🏗️ Stock Scraper - Building local ARM64 test image..."

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker rm -f stock-scraper-local-test 2>/dev/null || true

# Build the Docker image for local ARM64 testing
echo "🔨 Building Docker image for ARM64 (local testing)..."
docker build \
    -f Dockerfile.ubuntu \
    --platform linux/arm64 \
    -t stock-scraper:local-test .

echo "✅ ARM64 local test image built successfully!"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/run-local-test.sh"
echo "2. Then: ./scripts/build-amd64-override.sh"
echo "3. Then: ./scripts/push-ubuntu-to-registry.sh"
echo "4. Test: ./scripts/test-ubuntu-aci.sh"
echo "5. Deploy: ./scripts/deploy-production.sh"
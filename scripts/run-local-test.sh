#!/bin/bash
# Stock Scraper - Local Docker test run
# Tests with limited stock data (5 items) on local ARM64

set -e

echo "🚀 Stock Scraper - Local test run starting..."

# Clean up any existing containers
docker rm -f stock-scraper-local-test 2>/dev/null || true

# Create local test environment file if it doesn't exist
if [ ! -f .env.test ]; then
    echo "📝 Creating test environment file..."
    cat > .env.test << EOF
NODE_ENV=test
HEADLESS=true
DEBUG=true

# Stock application URLs
STOCK_LOGIN_URL=https://www.stock-app.jp/teams/sign-in
STOCK_URL=https://www.stock-app.jp/teams/c20282/dashboard

# Test mode settings (limited data)
TEST_MODE=true
MAX_URLS_COLLECT=10
MAX_SCRAPE_COUNT=5

# Azure Storage (ダミー設定 - ローカルテスト用)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=dummy;AccountKey=dGVzdGtleWZvcmxvY2FsZW52aXJvbm1lbnQ=;EndpointSuffix=core.windows.net

# Scraping configuration for testing
SCRAPE_CONCURRENCY=1
SCRAPE_BATCH_SIZE=3
SCRAPE_TIMEOUT_MS=90000
PAGE_LOAD_DELAY=4000
REQUEST_DELAY_MS=3000
SCRAPE_DELAY_MS=3000
BATCH_DELAY_MS=1000
MAX_RETRY_ATTEMPTS=2
NETWORK_TIMEOUT=60000
EOF
fi

echo "🐳 Starting local test container..."
echo "🎯 Testing with limited stock data (max 5 items)"

# Run the container with test configuration
docker run \
    --name stock-scraper-local-test \
    --env-file .env.test \
    -v "$(pwd)/stock-mhtml:/app/stock-mhtml" \
    -v "$(pwd)/session:/app/session" \
    --rm \
    stock-scraper:local-test

echo "✅ Local test completed!"
echo ""
echo "🔍 Check the stock-mhtml directory for results:"
ls -la stock-mhtml/ | head -10
echo ""
echo "Next step: ./scripts/build-amd64-override.sh"
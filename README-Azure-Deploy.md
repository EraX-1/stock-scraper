# Stock Scraper - Azure Deployment Guide

## 概要

Stock Scraperは、Stock-app.jpからチーム内の文書情報を自動収集してMHTMLファイルとして保存するシステムです。qast-scraperと同様のアーキテクチャを使用し、Azure Container InstancesとLogic Appsによる完全自動化されたスケジューリング機能を提供します。

**主な処理フロー**:
1. **URL収集**: Stock一覧ページからすべての文書URLを動的に収集
2. **MHTMLスクレイピング**: 収集したURLを個別にアクセスしてMHTML形式で保存
3. **Azure展開**: ローカルファイルをAzure Blob Storageにアップロード
4. **RAGインデックス**: 文書をベクトル化してRAG検索用インデックスを作成

## アーキテクチャ

### 全体構成
- **Docker**: Multi-architecture対応（開発: ARM64、本番: AMD64）
- **Azure Container Registry**: `qastregistry` (qast-scraperと共用)
- **Azure Container Instances**: 本番実行環境
- **Azure Blob Storage**: `yuyamablobstorage` (データ保存先)
- **Azure Logic Apps**: 自動スケジューリング（毎日2時実行）

### データ構造
```
Azure Blob Storage: yuyamablobstorage
└── stock-mhtml/
    └── data/
        ├── stock_1000001.mhtml
        ├── stock_1000002.mhtml
        └── ...
```

## 必要な環境

### ローカル環境
- Docker Desktop (Apple Silicon対応)
- Azure CLI
- Node.js 20+
- TypeScript

### Azure リソース
- **Resource Group**: `yuyama`
- **Container Registry**: `qastregistry`
- **Storage Account**: `yuyamablobstorage`
- **Log Analytics**: `yuyama-batch-logs`

## デプロイメント手順

### 1. ローカルテスト (ARM64)
```bash
# 1-1. ARM64イメージをビルド
./scripts/build-local-test.sh

# 1-2. 5件のテストデータでローカル実行
./scripts/run-local-test.sh
```

**確認ポイント**:
- `stock-mhtml/` ディレクトリに5件のMHTMLファイルが生成される
- コンテナが正常に完了する (exit code 0)

### 2. 本番用AMD64イメージビルド
```bash
# 2-1. AMD64アーキテクチャでリビルド
./scripts/build-amd64-override.sh
```

### 3. Azure Container Registryへプッシュ
```bash
# 3-1. ACRにイメージをプッシュ
./scripts/push-ubuntu-to-registry.sh
```

**注意**: Azure CLIでログインが必要です
```bash
az login
az acr login --name qastregistry
```

### 4. Azure Container Instancesでテスト
```bash
# 4-1. 5件のテストデータでACI実行
./scripts/test-ubuntu-aci.sh
```

**実行仕様**:
- **CPU**: 2 vCPU
- **Memory**: 4GB
- **対象**: 株式ID 1-5件
- **実行時間**: 約5-10分
- **費用**: 約¥10-20

### 5. 本番環境デプロイ（全件）
```bash
# 5-1. 本番規模での実行
./scripts/deploy-production.sh
```

**実行仕様**:
- **CPU**: 4 vCPU
- **Memory**: 8GB
- **対象**: 全Stock文書（動的収集）
- **実行時間**: 約2-3時間（文書数による）
- **費用**: 約¥200-300

### 6. 自動スケジューリング設定
```bash
# 6-1. Logic App作成（毎日2時実行）
./scripts/setup-cron.sh
```

**スケジュール**:
- **実行時間**: 毎日 2:00 AM (JST)
- **対象**: 全Stock文書（動的収集）
- **自動実行**: Logic Appによるコンテナ再起動

## 環境変数

### 本番環境設定
```bash
NODE_ENV=production
HEADLESS=true
SCRAPE_START_ID=1
SCRAPE_END_ID=5000
SCRAPE_CONCURRENCY=2
SCRAPE_BATCH_SIZE=5
SCRAPE_TIMEOUT_MS=120000
PAGE_LOAD_DELAY=5000
REQUEST_DELAY_MS=5000
MAX_RETRY_ATTEMPTS=3
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=yuyamablobstorage;..."
```

### テスト環境設定
```bash
NODE_ENV=test
HEADLESS=true
DEBUG=true
STOCK_LOGIN_URL=https://www.stock-app.jp/teams/sign-in
STOCK_URL=https://www.stock-app.jp/teams/c20282/dashboard
TEST_MODE=true
MAX_URLS_COLLECT=10        # URL収集の上限
MAX_SCRAPE_COUNT=5         # スクレイピング実行の上限
SCRAPE_CONCURRENCY=1
SCRAPE_BATCH_SIZE=3
SCRAPE_TIMEOUT_MS=90000
PAGE_LOAD_DELAY=4000
REQUEST_DELAY_MS=3000
SCRAPE_DELAY_MS=3000
BATCH_DELAY_MS=1000
MAX_RETRY_ATTEMPTS=2
NETWORK_TIMEOUT=60000
```

## 監視とログ

### コンテナ監視
```bash
# リアルタイムログ監視
az container logs --resource-group yuyama --name CONTAINER_NAME --follow

# コンテナ状態確認
az container show --resource-group yuyama --name CONTAINER_NAME --query containers[0].instanceView.currentState
```

### Logic App監視
```bash
# Logic App実行履歴
az logic workflow show --resource-group yuyama --name stock-scraper-daily-scheduler

# 実行ログ確認
az monitor log-analytics query --workspace yuyama-batch-logs --analytics-query "ContainerInstanceLog_CL | limit 100"
```

### Blob Storage監視
```bash
# デプロイ済みファイル一覧
npm run deploy-azure:list

# ファイル数確認
az storage blob list --account-name yuyamablobstorage --container-name stock-mhtml --prefix "data/" --query "length(@)"
```

## トラブルシューティング

### 1. ローカルテストが失敗する
```bash
# Dockerイメージを確認
docker images stock-scraper:local-test

# ローカルログを確認
docker logs stock-scraper-local-test
```

### 2. ACIデプロイが失敗する
```bash
# ACR認証を確認
az acr login --name qastregistry

# イメージが存在するか確認
az acr repository list --name qastregistry --query "[?contains(@, 'stock-scraper')]"
```

### 3. Logic Appが実行されない
```bash
# Logic App状態確認
az logic workflow show --resource-group yuyama --name stock-scraper-daily-scheduler --query "state"

# 権限を再設定
./scripts/setup-cron.sh
```

### 4. ストレージアップロードが失敗する
```bash
# 接続文字列を確認
az storage account show-connection-string --name yuyamablobstorage --resource-group yuyama

# コンテナ権限確認
az storage container show --name stock-mhtml --account-name yuyamablobstorage
```

## パフォーマンス最適化

### スクレイピング設定調整
- **concurrency**: 並行処理数（1-3推奨）
- **batchSize**: バッチサイズ（3-10推奨）
- **delayMs**: リクエスト間隔（3000-10000ms）

### リソース設定調整
- **テスト**: 2 vCPU, 4GB RAM
- **本番**: 4 vCPU, 8GB RAM
- **大規模**: 8 vCPU, 16GB RAM

### スケジュール調整
```bash
# setup-cron.sh の line 27 を編集
"hours": ["2"],        # 実行時間（0-23）
"minutes": [0]         # 実行分（0-59）
```

## 費用見積もり

### Azure Container Instances
- **テスト実行** (2 vCPU, 4GB, 10分): 約¥10-20
- **本番実行** (4 vCPU, 8GB, 3時間): 約¥200-300
- **月額自動実行** (毎日): 約¥6,000-9,000

### Azure Storage
- **1万ファイル** (平均1MB): 約¥100-200/月
- **転送費用**: 約¥50-100/月

### その他
- **Container Registry**: 約¥500/月
- **Logic Apps**: 約¥100/月 (実行回数課金)

## サポート

### ファイル構成
```
stock-scraper/
├── scripts/                    # デプロイスクリプト
│   ├── build-local-test.sh     # ローカルテスト用ビルド
│   ├── run-local-test.sh       # ローカル実行
│   ├── build-amd64-override.sh # AMD64ビルド
│   ├── push-ubuntu-to-registry.sh # ACR プッシュ
│   ├── test-ubuntu-aci.sh      # ACI テスト
│   ├── deploy-production-5000.sh # 本番デプロイ
│   └── setup-cron.sh           # スケジューラ設定
├── Dockerfile.ubuntu           # 本番用Dockerfile
├── src/
│   ├── containerMain.ts        # コンテナエントリーポイント
│   └── azureDeploy.ts          # Azure デプロイ処理
└── README-Azure-Deploy.md      # このファイル
```

### 関連リポジトリ
- **qast-scraper**: `/Users/umemiya/Desktop/erax/qast-scraper/`
- **stock-scraper**: `/Users/umemiya/Desktop/erax/stock-scraper/`

同じAzureリソースを共用して効率的な運用を実現しています。
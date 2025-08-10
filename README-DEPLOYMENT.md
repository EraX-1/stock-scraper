# Stock Scraper - Azure デプロイメントガイド

このドキュメントでは、Stock Scraperを Azure Container Registry と Azure Container Instances を使ってデプロイする方法を説明します。

## 前提条件

- Azure CLI がインストール済み
- Docker がインストール済み
- Azureサブスクリプションへのアクセス権

## デプロイメント手順

### 1. Azure リソースの準備

```bash
# リソースグループの作成
az group create --name stock --location japaneast

# Container Registry の作成
az acr create \
  --resource-group stock \
  --name stockregistry \
  --sku Basic \
  --location japaneast

# Admin ユーザーを有効化
az acr update --name stockregistry --admin-enabled true
```

### 2. Docker イメージのビルド・プッシュ

```bash
# ACR にイメージをビルド・プッシュ
./deploy-to-acr.sh
```

### 3. Container Instance での実行

#### 手動実行
```bash
# 一回限りの実行
./deploy-to-aci.sh
```

#### スケジューラー実行 (Logic App)
```bash
# Logic App スケジューラーの作成
./deploy-logic-app.sh
```

### 4. 環境変数の設定

Container Instance 実行時に以下の環境変数を設定：

```bash
STOCK_LOGIN_URL=https://www.stock-app.jp/sign-in
STOCK_EMAIL=your-email@example.com
STOCK_PASSWORD=your-password
STOCK_URL=https://www.stock-app.jp/teams/YOUR_TEAM_ID/dashboard/
HEADLESS=true
DEBUG=false
```

## スクリプトの説明

### deploy-to-acr.sh
- Docker イメージをビルド
- Azure Container Registry にプッシュ

### deploy-to-aci.sh  
- Container Instance を作成
- 一回限りの実行

### deploy-logic-app.sh
- Logic App スケジューラーを作成
- 毎日定時に自動実行

## 監視とログ

### Container Instance のログ確認
```bash
az container logs \
  --resource-group stock \
  --name stock-scraper-instance
```

### Logic App の実行履歴確認
```bash
az logic workflow show \
  --resource-group stock \
  --name stock-scraper-scheduler
```

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - ACR の認証情報を確認
   - Logic App の Managed Identity 権限を確認

2. **メモリ不足**
   - Container Instance のメモリを増加
   - 並行処理数を減らす

3. **タイムアウト**
   - Container の実行時間制限を確認
   - ネットワークの問題を確認

### デバッグ方法

```bash
# ローカルでのテスト実行
npm run container

# ACR イメージの確認
az acr repository list --name stockregistry

# Container Instance の状態確認
az container show \
  --resource-group stock \
  --name stock-scraper-instance \
  --query "{provisioningState:provisioningState,state:containers[0].instanceView.currentState.state}"
```

## コスト最適化

- Container Instance は実行時のみ課金
- ACR は使用量ベースの課金
- Logic App は実行回数ベースの課金

定期実行の場合、Logic App + Container Instance の組み合わせが最も費用対効果が高いです。

## セキュリティ

- Container Registry は Admin ユーザー無効化を推奨（本番環境）
- Logic App は Managed Identity を使用
- 環境変数での機密情報管理に注意
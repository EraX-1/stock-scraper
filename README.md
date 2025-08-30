# Stock Scraper

情報共有プラットフォーム「Stock」からのデータ自動収集・保存システム

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Latest-green.svg)](https://playwright.dev/)
[![Azure](https://img.shields.io/badge/Azure-Container%20Instances-blue.svg)](https://azure.microsoft.com/services/container-instances/)
[![Docker](https://img.shields.io/badge/Docker-Multi%20Platform-blue.svg)](https://www.docker.com/)

## 🌟 概要

Stock Scraperは、情報共有プラットフォーム「Stock」から記事・資料を自動収集するWebスクレイピングシステムです。  
qast-scraperアーキテクチャをベースに、Stock特有の動的URL収集とセッション管理に対応した高性能スクレイピングツールです。

### 🎯 主な用途
- **社内ナレッジの自動バックアップ**: 業務情報・手順書・FAQ等の定期取得
- **情報アーカイブシステム**: 重要な業務情報の長期保存・検索基盤構築
- **データ分析プラットフォーム**: 収集データを活用した独自分析・レポート作成
- **BCP対応**: 情報資産の外部保存によるリスク対策

### ⚙️ アーキテクチャ
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Logic Apps    │───▶│  Container      │───▶│  Azure Blob     │
│  (Scheduler)    │    │  Instances      │    │   Storage       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───── 定期実行 ─────────┼────── 実行結果 ────────┘
                                │
                    ┌─────────────────┐
                    │ Log Analytics   │
                    │  (監視・ログ)      │
                    └─────────────────┘
```

### 🚀 技術的特徴
- **高性能**: 並行2スレッド・バッチサイズ5の並列処理
- **堅牢性**: モーダル回避・リトライ機能・セッション復元
- **スケーラブル**: Azure Container Instances自動スケーリング
- **監視対応**: Log Analytics完全ログ出力・メトリクス収集

## 📊 処理能力

| 項目 | テスト環境 | 本番環境 |
|------|------------|----------|
| **URL収集** | 5,402件 | 5,400件超 |
| **MHTML保存** | 10件 | 全件 |
| **実行時間** | 13分 | 2-3時間 |
| **成功率** | 100% | - |
| **リソース** | 2CPU/4GB | 4CPU/8GB |

## 📋 主要機能

### 🔐 認証・セッション管理
- **自動ログイン**: Email/Password認証の完全自動化
- **セッション復元**: 保存されたセッションの自動復旧
- **モーダル回避**: ログイン阻害ダイアログの自動処理
- **Cookie管理**: セッション情報の永続化・管理

### 📊 データ収集
- **動的URL収集**: Stock内全記事URLの自動検出・収集
- **完全スクロール**: 無限スクロール対応の全件取得
- **並列処理**: 最大2並列・バッチサイズ5の高速処理
- **MHTML保存**: 記事全体の完全保存（画像・CSS込み）

### ☁️ クラウド統合
- **Azure Blob Storage**: 自動アップロード・バージョン管理
- **Container Instances**: オートスケール・リソース最適化
- **Log Analytics**: 詳細ログ・メトリクス監視
- **Logic Apps**: 定期実行・スケジューリング

### 🛡️ 信頼性・監視
- **エラーハンドリング**: 3回リトライ・グレースフル障害処理
- **実行監視**: リアルタイムログ・ステータス追跡
- **リソース監視**: CPU・メモリ・ネットワーク使用量
- **結果レポート**: 処理件数・成功率・実行時間

## 🚀 デプロイメント

### 📦 Docker方式（推奨）

#### 1. ローカルテスト（ARM64）
```bash
# ARM64ビルド
docker build --platform linux/arm64 -f Dockerfile.ubuntu -t stock-scraper:arm64 .

# テスト実行
TEST_MODE=true MAX_SCRAPE_COUNT=5 docker run stock-scraper:arm64
```

#### 2. Azure Container Registry
```bash
# AMD64本番ビルド
docker build --platform linux/amd64 -f Dockerfile.ubuntu -t qastregistry.azurecr.io/stock-scraper:ubuntu .

# ACRプッシュ
docker push qastregistry.azurecr.io/stock-scraper:ubuntu
```

#### 3. Azure Container Instances
```bash
# テスト実行
./scripts/test-ubuntu-aci.sh

# 本番デプロイ
./scripts/deploy-production.sh
```

### 🔧 ローカル開発

```bash
# 依存関係インストール
npm install

# TypeScriptビルド
npm run build

# ローカル実行
STOCK_EMAIL="your@email.com" STOCK_PASSWORD="password" node dist/containerMain.js
```

### ⚙️ 環境変数設定

#### 必須設定
```env
# Stock認証情報
STOCK_EMAIL=tool@eraxai.info
STOCK_PASSWORD=your_password
STOCK_LOGIN_URL=https://www.stock-app.jp/teams/sign-in
STOCK_URL=https://www.stock-app.jp/teams/c20282/dashboard

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

#### オプション設定
```env
# 実行モード
NODE_ENV=production          # production | test
TEST_MODE=false              # テスト制限の有効/無効
HEADLESS=true                # ヘッドレスモード

# スクレイピング設定
SCRAPE_CONCURRENCY=2         # 並行処理数
SCRAPE_BATCH_SIZE=5          # バッチサイズ
MAX_URLS_COLLECT=unlimited   # URL収集上限
MAX_SCRAPE_COUNT=unlimited   # スクレイピング上限

# タイミング設定
PAGE_LOAD_DELAY=5000         # ページ読み込み待機時間(ms)
REQUEST_DELAY_MS=5000        # リクエスト間隔(ms)
SCRAPE_TIMEOUT_MS=120000     # スクレイピングタイムアウト(ms)
```

## 📂 プロジェクト構造

```
stock-scraper/
├── src/                          # TypeScriptソースコード
│   ├── containerMain.ts          # コンテナエントリーポイント
│   ├── mainJob.ts               # メインジョブ実行
│   ├── login.ts                 # ログイン・認証処理
│   ├── stockUrlCollector.ts     # URL収集（動的スクロール）
│   ├── stockMhtmlScraper.ts     # MHTMLスクレイピング
│   └── azureDployManager.ts     # Azure統合管理
├── scripts/                     # デプロイメントスクリプト
│   ├── build-local-test.sh      # ローカルビルド（ARM64）
│   ├── build-amd64-override.sh  # 本番ビルド（AMD64）
│   ├── test-ubuntu-aci.sh       # ACIテスト実行
│   ├── deploy-production.sh     # 本番デプロイ
│   └── push-ubuntu-to-registry.sh # ACRプッシュ
├── session/                     # セッション情報
│   └── session.json            # Cookie・localStorage保存
├── stock-mhtml/                # スクレイピング結果
├── dist/                       # ビルド済みコード
├── Dockerfile.ubuntu           # 本番Dockerイメージ
├── package.json               # Node.js設定・依存関係
├── tsconfig.json              # TypeScript設定
└── README.md                  # このファイル
```

## 📊 監視・運用

### 🔍 ログ監視（Log Analytics）

```bash
# リアルタイムログ監視
az container logs --resource-group yuyama --name stock-scraper-production --follow

# Log Analytics クエリ
az monitor log-analytics query \
  --workspace 087c6146-6504-48a8-a030-891b6f0d8b0d \
  --analytics-query "ContainerInstanceLog_CL | where ContainerName_s == 'stock-scraper-production' | order by TimeGenerated desc"
```

### 📈 パフォーマンス指標

| メトリクス | 説明 | 目標値 |
|------------|------|--------|
| **URL収集速度** | URL/秒 | 200-300 URL/秒 |
| **MHTML保存速度** | ファイル/分 | 5-10 ファイル/分 |
| **成功率** | 成功/全体 | 95%以上 |
| **メモリ使用率** | 使用/割当 | 80%以下 |
| **実行時間** | 総実行時間 | 3時間以下 |

### 🚨 アラート設定

```bash
# エラー率監視
ContainerInstanceLog_CL 
| where Message contains "❌" 
| summarize ErrorCount=count() by bin(TimeGenerated, 5m)

# 実行時間監視
ContainerInstanceLog_CL 
| where Message contains "総処理時間" 
| project TimeGenerated, Message
```

### 🔄 定期実行設定

#### Logic Apps設定例
```json
{
  "definition": {
    "triggers": {
      "Recurrence": {
        "recurrence": {
          "frequency": "Day",
          "interval": 1,
          "schedule": {
            "hours": ["02"],
            "minutes": [0]
          }
        }
      }
    }
  }
}
```

## 🛠️ トラブルシューティング

### よくある問題と解決法

#### 1. ログイン失敗
```bash
# 症状: "❌ ログインに失敗しました"
# 原因: セッション期限切れ、モーダル阻害
# 解決: セッションファイル削除、認証情報確認
rm session/session.json
```

#### 2. URL収集エラー
```bash
# 症状: "URL収集中にエラーが発生"
# 原因: ページ構造変更、ネットワークタイムアウト
# 解決: セレクタ更新、タイムアウト延長
```

#### 3. Azure接続エラー
```bash
# 症状: "Azure Storage接続失敗"
# 原因: 接続文字列誤り、権限不足
# 解決: 接続文字列再確認、IAM設定確認
```

### 🔧 デバッグモード
```bash
# デバッグログ有効化
DEBUG=true HEADLESS=false node dist/containerMain.js

# ブラウザ表示でデバッグ
HEADLESS=false TEST_MODE=true node dist/containerMain.js
```

## 📋 開発・メンテナンス

### 🔄 アップデート手順
1. ソースコード修正
2. TypeScriptビルド (`npm run build`)
3. ローカルテスト実行
4. Dockerイメージビルド・プッシュ
5. ACIテスト実行
6. 本番デプロイ

### 🧪 テスト戦略
- **単体テスト**: 各モジュールの機能検証
- **統合テスト**: ACI環境での実行確認
- **負荷テスト**: 大量データでの性能検証
- **回帰テスト**: 既存機能の動作確認

### 📝 ログレベル
- **INFO**: 実行状況・進捗情報
- **WARN**: 警告・リトライ情報  
- **ERROR**: エラー・例外情報
- **DEBUG**: 詳細デバッグ情報

---

## 🤝 貢献・サポート

このプロジェクトはqast-scraperアーキテクチャをベースとした内部ツールです。  
Stock-app.jp特有の仕様に対応した高性能スクレイピングシステムとして設計されています。

**Technology Stack**: TypeScript + Playwright + Azure Container Services  
**Architecture Pattern**: qast-scraper compatible microservices  
**Deployment**: Multi-platform Docker + Azure native integration
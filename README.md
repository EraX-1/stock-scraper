# Stock Scraper

情報蓄積サイト（Stock）からMHTML形式でコンテンツをスクレイピングし、Azure Blob Storageに保存するツールです。

## 🌟 概要

Stock Scraperは、情報共有プラットフォーム「Stock」から記事・資料を自動収集するWebスクレイピングツールです。Playwright を使用してブラウザを自動操作し、認証が必要なページも含めて全コンテンツをMHTML形式で完全保存します。

### 🎯 主な用途
- **社内情報の自動収集**: ナレッジベース、手順書、FAQ等の定期取得
- **情報アーカイブ**: 重要な業務情報の長期保存・検索
- **データ分析基盤**: 収集データを活用した独自分析・レポート作成
- **バックアップ目的**: 情報資産の安全な外部保存

### ⚙️ 技術スタック
- **TypeScript** - 型安全な開発
- **Playwright** - ブラウザ自動操作・スクレイピング
- **Azure Blob Storage** - クラウドデータ保存
- **Docker** - コンテナ化・デプロイ
- **Azure Container Instances** - 自動実行環境
- **Logic Apps** - 定期実行・スケジューリング

### 🚀 特徴
- **完全自動化**: ログインからデータ収集・保存まで無人実行
- **高い信頼性**: エラーハンドリング・リトライ機能で安定動作
- **スケーラブル**: クラウド環境で大量データ処理に対応
- **保守性**: モジュール化された設計で拡張・変更が容易

## 📋 機能

- 🔐 自動ログイン
- 📝 全ページの自動取得・保存
- ⚡ 並列処理による高速スクレイピング
- ☁️ Azure Blob Storage自動アップロード
- 📦 MHTML形式での完全保存

## 🚀 セットアップ

### 環境変数設定
`.env`ファイルを作成：

```env
STOCK_URL=https://your-stock-site.com
STOCK_EMAIL=your_email@example.com
STOCK_PASSWORD=your_password

HEADLESS=false
DEBUG=false

AZURE_STORAGE_CONNECTION_STRING=your_connection_string
```

### インストール・実行

```bash
# 依存関係インストール
npm install

# ローカル実行
npm run auto-sync
```

## 📂 プロジェクト構造

```
stock-scraper/
├── src/               # TypeScriptソースコード
├── mhtml/             # スクレイピング結果
├── cookies/           # 認証情報
├── dist/              # ビルド済みコード
├── package.json       # Node.js設定
├── tsconfig.json      # TypeScript設定
└── .env               # 環境変数
```

## 📋 TODO: qast-scraperと同じ機能を実装

### 1. 基本ファイル構造の作成
- [ ] `src/auth/` ディレクトリ作成
  - [ ] `cookieManager.ts` - Cookie管理機能
  - [ ] `stockAuth.ts` - Stock認証処理
- [ ] `src/storage/` ディレクトリ作成  
  - [ ] `azureBlobManager.ts` - Azure Blob Storage管理
- [ ] `src/types/` ディレクトリ作成
  - [ ] `index.ts` - 型定義ファイル
- [ ] `mhtml/` ディレクトリ作成（スクレイピング結果保存用）
- [ ] `cookies/` ディレクトリ作成（認証情報保存用）

### 2. 認証・ログイン機能
- [ ] `loginSeparate.ts` - 独立ログイン処理
- [ ] Cookie保存・読み込み機能
- [ ] JWT認証対応（必要に応じて）

### 3. スクレイピング機能
- [ ] `improvedScraper.ts` - 改良版スクレイパー（qastのimprovedMemoScraperに相当）
- [ ] `fullUpdateScraper.ts` - 全件スクレイピング
- [ ] MHTML形式での保存機能
- [ ] 並列処理対応
- [ ] エラーハンドリング・リトライ機能

### 4. 自動同期・統合機能  
- [ ] `autoSync.ts` - 自動同期処理（ログイン→スクレイピング→アップロード）
- [ ] Azure Blob Storage自動アップロード
- [ ] 404ページ自動除外機能
- [ ] 連続エラー時の停止制限

### 5. Docker・デプロイ対応
- [ ] `Dockerfile` 作成
- [ ] Docker関連スクリプト作成
- [ ] Azure Container Instances対応
- [ ] Logic Apps定期実行設定

### 6. 設定・環境変数
- [ ] `.env`ファイル本格設定
- [ ] 設定値のバリデーション
- [ ] デバッグモード対応

### 7. 実装の参考
qast-scraperの以下ファイルを参考に実装：
- `src/auth/qastAuth.ts` → `src/auth/stockAuth.ts`
- `src/improvedMemoScraper.ts` → `src/improvedScraper.ts`  
- `src/fullUpdateScraper.ts` → `src/fullUpdateScraper.ts`
- `src/autoSync.ts` → `src/autoSync.ts`
- `src/containerMain.ts` → `src/containerMain.ts`
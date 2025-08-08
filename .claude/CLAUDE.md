# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
常に日本語で回答してください。

## プロジェクト概要

**Stock Scraper** - 情報蓄積サイト（Stock）からMHTMLキャプチャしてAzure Blob Storageにデプロイする完全自動化ツール

このツールは以下の目的で作成されています：
- 社内情報の自動収集（ナレッジベース、手順書、FAQ等の定期取得）
- 情報アーカイブ（重要な業務情報の長期保存・検索）
- データ分析基盤（収集データを活用した独自分析・レポート作成）
- バックアップ目的（情報資産の安全な外部保存）
- 完全自動化によるログインからデータ収集・保存まで無人実行

## 🚀 主要コマンド

### 🤖 完全自動化（推奨）
```bash
# ログイン + 全件更新を一括実行
npm run auto-sync

# ログイン + 全件更新 + Azure デプロイ
npm run auto-sync && npm run deploy
```

### 🔐 認証
```bash
# ログイン（認証情報を保存）
npm run login
```

### 📄 スクレイピング
```bash
# 指定範囲でスクレイピング
npm run scrape [開始ID] [終了ID] [並列数]

# 全件更新（未来の記事まで自動検索）
npm run scrape-all
```

### ☁️ Azure デプロイ
```bash
# フルデプロイ
npm run deploy

# テスト実行（アップロードなし）
npm run deploy -- --dry-run

# Azure状況確認
npm run deploy -- --status
```

### 🧹 メンテナンス
```bash
# データクリーンアップ
npm run cleanup

# Azure 接続テスト
npm run test-azure
```

## 📋 環境設定

### .env ファイル設定
```env
# Stock認証情報
STOCK_URL=https://your-stock-site.com
STOCK_EMAIL=your_email@example.com
STOCK_PASSWORD=your_password

# 実行オプション
HEADLESS=false
DEBUG=false

# Azure Storage設定
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
```

## 🏗️ アーキテクチャ概要

### 主要機能

1. **🔐 自動認証システム**
   - Cookie管理による自動ログイン
   - 認証状態の永続化
   - エラー時の自動再認証

2. **📝 高度なスクレイピング**
   - 全ページの自動取得・保存
   - 並列処理による高速化
   - 404ページ除外機能
   - エラーハンドリング・リトライ機能

3. **📁 MHTML管理**
   - 完全保存（画像・CSS・JS含む）
   - ID-タイトル形式のファイル名
   - 重複排除機能

4. **☁️ Azure Blob Storage統合**
   - 自動コンテナー作成
   - 日付プレフィックス管理
   - 並列アップロード
   - 進捗表示とエラーハンドリング

5. **🧹 データ管理**
   - 状況確認機能
   - データクリーンアップ
   - ログ管理

### 技術スタック

- **Node.js** + **TypeScript**
- **Playwright** - ブラウザ自動化・JWT認証
- **Azure SDK** - Blob Storage統合
- **Chrome DevTools Protocol** - MHTMLキャプチャ

### ディレクトリ構造

```
stock-scraper/
├── src/
│   ├── auth/                    # 認証機能
│   │   ├── stockAuth.ts         # Stockログイン処理
│   │   └── cookieManager.ts     # Cookie管理
│   ├── storage/                 # Azure Storage
│   │   └── azureBlobManager.ts  # Blob操作・デプロイ
│   ├── types/                   # 型定義
│   │   └── index.ts             # 型定義ファイル
│   ├── improvedScraper.ts       # メインスクレイパー
│   ├── fullUpdateScraper.ts     # 全件更新
│   ├── autoSync.ts              # 自動同期
│   ├── azureDeploy.ts           # Azure デプロイ
│   ├── loginSeparate.ts         # ログイン処理
│   └── containerMain.ts         # コンテナ用メイン
├── mhtml/                      # MHTML保存用
├── cookies/                    # 認証情報保存用
├── dist/                       # ビルド済みコード
└── .env                        # 環境変数
```

## 🔧 認証アーキテクチャ

### Cookieベース認証
```typescript
// 認証情報構造
interface AuthData {
  timestamp: string;
  cookies: any[];
  sessionData?: Record<string, string>;
}

// 使用方法
const cookieManager = new CookieManager();
const authData = await cookieManager.loadAuthData();
if (authData?.cookies) {
  // Cookie設定
  await context.addCookies(authData.cookies);
}
```

## 📊 スクレイピング仕様

### ページ読み込み安定性
```typescript
// 段階的ページ読み込み
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(2000); // 安定化待機
try {
  await page.waitForLoadState('networkidle', { timeout: 8000 });
} catch { /* タイムアウト許容 */ }
await this.waitForAssetsLoaded(page); // 画像・添付ファイル
```

### 404判定ロジック
```typescript
// 多重404判定
1. タイトル判定: エラーページ特定タイトル検出
2. コンテンツ判定: 404メッセージ検出
3. DOM構造判定: エラー要素確認
4. コンテンツ存在判定: 有効コンテンツ確認
5. URL妥当性判定: 正規パターンマッチ
```

## ☁️ Azure統合仕様

### Blob Storage構造
```
Container: stock-mhtml
├── 2025-08-08/
│   ├── 1500-ナレッジベース記事.mhtml
│   ├── 1501-手順書テンプレート.mhtml
│   └── 2000-FAQ集.mhtml
```

### デプロイ設定
```typescript
// 並列アップロード設定
concurrency: 5,          // 同時アップロード数
preserveStructure: true, // ディレクトリ構造保持
timestampPrefix: true,   // 日付プレフィックス
overwrite: true         // 上書き許可
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

1. **ログインページのMHTMLが保存される**
   - 原因: 認証失敗
   - 解決: `npm run login` で再ログイン

2. **404ページが保存される**
   - 原因: 404判定ロジック通過
   - 解決: check404Page メソッド確認

3. **Azure接続エラー**
   - 原因: Connection String設定誤り
   - 解決: .env設定確認、`npm run test-azure`

4. **並列処理エラー**
   - 原因: 同時実行数過多
   - 解決: concurrency値を1-3に減少

### ログ出力の仕様

- 成功時には適切な絵文字付きの日本語ログを出力
- エラー時にはエラー内容を明確に表示
- 進捗状況を分かりやすく表示

例：
- `🔑 ログイン成功しました`
- `📝 1500: ナレッジベース記事...`
- `☁️ Azure Blobアップロード完了`
- `🎉 Auto-Sync 完了！`

## 🔄 データフロー

### 完全自動化フロー
```
1. 🔐 認証状態チェック → 必要に応じてログイン
2. 🚀 全件更新スクレイピング → 連続404で自動停止
3. 📁 MHTMLファイル生成・保存
4. ☁️ Azure Blob Storage デプロイ（オプション）
5. 📊 結果レポート生成
```

### スクレイピングフロー
```
1. ページURLにアクセス
2. ページ安定化待機
3. 404判定実行
4. 有効コンテンツの場合 → MHTML生成・保存
5. mhtml/フォルダに保存
```

## 📈 パフォーマンス最適化

### 並列処理設定
- スクレイピング: 1-3並列（サーバー負荷考慮）
- Azure アップロード: 5並列（高速化）
- バッチ処理: 適切な待機時間設定

### メモリ効率
- 大量ファイル処理時のバッチ分割
- 適切なタイムアウト設定
- エラー時の部分結果保存

## 🔒 セキュリティ仕様

### 認証情報保護
- トークン値の非表示化
- .env ファイルの Git 除外
- 有効期限管理（24時間）

### エラー情報制御
- ファイルパス情報の制限
- 機密情報のログ出力防止
- 適切なエラーメッセージ

## 🎯 今後の拡張予定

1. **増分更新機能** - 新規・更新記事のみ処理
2. **スケジュール実行** - cron による定期実行
3. **Webhook連携** - Azure Functions トリガー
4. **検索機能** - キャプチャ済み記事の全文検索
5. **メトリクス収集** - パフォーマンス・使用量分析
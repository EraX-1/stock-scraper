# Stock Scraper (Slim Version)

Stockサイトのデータを効率的にスクレイピングするためのスリムなツールです。

## 機能

1. **Stockへのログイン** - Cookie管理による自動ログイン
2. **単一ページのDOM構造解析** - 最適なセレクタの自動検出
3. **対象ページ一覧のクロール** - Stock内のページURLを自動収集
4. **データ抽出** - DOM構造に基づく効率的なデータ抽出
5. **JSON形式で保存** - 構造化されたデータの保存

## セットアップ

### 1. 依存関係のインストール

```bash
cd yuyama-scraper-stock
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下の内容を設定：

```env
# Stock credentials
STOCK_EMAIL=your-email@example.com
STOCK_PASSWORD=your-password

# Browser settings
HEADLESS=false  # true でヘッドレスモード
DEBUG=false     # true でデバッグモード

# Target URL for single page analysis (optional)
TARGET_URL=https://www.stock-app.jp/teams/xxxxx/dashboard/xxxxx/stocks/xxxxx/edit
```

## 使用方法

### 基本的な使用（全体スクレイピング）

```bash
npm run dev
```

このコマンドで以下の処理が実行されます：
1. Stockにログイン
2. ページ一覧を取得
3. 各ページからデータを抽出
4. `data/stock-data-{timestamp}.json`に保存

### 単一ページのDOM構造解析

特定のページのDOM構造を解析する場合：

```bash
npm run analyze <URL>
```

または環境変数で指定：

```bash
TARGET_URL=https://www.stock-app.jp/teams/... npm run analyze
```

## 出力データ形式

### スクレイピングデータ (stock-data-*.json)

```json
[
  {
    "url": "https://www.stock-app.jp/teams/c20282/dashboard/1259144/stocks/19132873/edit",
    "title": "投稿タイトル",
    "content": "投稿内容...",
    "author": "投稿者名",
    "timestamp": "2024-01-20T12:00:00Z",
    "tags": ["タグ1", "タグ2"],
    "teamId": "c20282",
    "dashboardId": "1259144",
    "stockId": "19132873"
  }
]
```

### DOM解析結果 (dom-analysis.json)

```json
{
  "url": "解析対象URL",
  "analyzedAt": "2024-01-20T12:00:00Z",
  "domStructure": {
    "titleSelector": ".dashboardBody__title",
    "contentSelector": ".dashboardBody__content",
    "authorSelector": ".author",
    "timestampSelector": ".timestamp",
    "tagsSelector": ".tag"
  },
  "sampleData": {
    "title": "サンプルタイトル",
    "content": "サンプル内容"
  }
}
```

## ディレクトリ構造

```
yuyama-scraper-stock/
├── src/
│   ├── auth/           # 認証関連
│   │   └── stockAuth.ts
│   ├── scraper/        # スクレイピングロジック
│   │   ├── stockScraper.ts
│   │   └── domAnalyzer.ts
│   ├── types/          # 型定義
│   │   └── index.ts
│   ├── index.ts        # メインエントリーポイント
│   └── analyze.ts      # DOM解析ツール
├── data/               # 出力データ（自動生成）
├── cookies/            # Cookie保存（自動生成）
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 注意事項

- 初回実行時はブラウザでのログインが必要です
- 2回目以降はCookieによる自動ログインが可能です
- レート制限を考慮し、各ページ間に1秒の待機時間を設けています
- デフォルトでは最初の10件のみスクレイピングします（変更可能）

## トラブルシューティング

### ログインできない場合
- 環境変数の設定を確認
- `HEADLESS=false`でブラウザの動作を確認
- `cookies/`フォルダを削除して再ログイン

### セレクタが見つからない場合
- `npm run analyze`で最新のDOM構造を解析
- `src/scraper/domAnalyzer.ts`の代替セレクタを調整

### データが取得できない場合
- `DEBUG=true`でデバッグモードを有効化
- ブラウザのコンソールでエラーを確認
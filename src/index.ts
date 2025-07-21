import 'dotenv/config';
import { StockScraper } from './scraper/stockScraper';
import { ScraperConfig } from './types';

async function main() {
  const config: ScraperConfig = {
    email: process.env.STOCK_EMAIL || '',
    password: process.env.STOCK_PASSWORD || '',
    headless: process.env.HEADLESS === 'true',
    debug: process.env.DEBUG === 'true',
  };

  if (!config.email || !config.password) {
    console.error('環境変数 STOCK_EMAIL と STOCK_PASSWORD を設定してください');
    process.exit(1);
  }

  const scraper = new StockScraper(config);

  try {
    // 1. 初期化とログイン
    await scraper.init();
    const loginSuccess = await scraper.login();

    if (!loginSuccess) {
      throw new Error('ログインに失敗しました');
    }

    // 2. 単一ページのDOM構造解析（オプション）
    const targetUrl = process.env.TARGET_URL;
    let domStructure;

    if (targetUrl) {
      console.log('\n=== DOM構造解析 ===');
      domStructure = await scraper.analyzeSinglePage(targetUrl);
      await scraper.saveToJson({ url: targetUrl, structure: domStructure }, 'dom-structure.json');
    }

    // 3. ページ一覧の取得
    console.log('\n=== ページ一覧取得 ===');
    const baseUrl = 'https://www.stock-app.jp/teams';
    const pageUrls = await scraper.crawlPageList(baseUrl);

    // 4. 各ページのスクレイピング
    console.log('\n=== データ抽出 ===');
    const posts = await scraper.scrapePages(pageUrls.slice(0, 10), domStructure); // 最初の10件のみ

    // 5. JSON形式で保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await scraper.saveToJson(posts, `stock-data-${timestamp}.json`);

    console.log(`\n完了: ${posts.length}件のデータを抽出しました`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);

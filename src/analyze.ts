import 'dotenv/config';
import { StockScraper } from './scraper/stockScraper';
import { ScraperConfig } from './types';

// 単一ページのDOM構造を解析するためのスクリプト
async function analyze() {
  const targetUrl = process.env.TARGET_URL || process.argv[2];
  
  if (!targetUrl) {
    console.error('解析対象のURLを指定してください');
    console.error('使用方法: npm run analyze <URL>');
    console.error('または環境変数 TARGET_URL を設定してください');
    process.exit(1);
  }

  const config: ScraperConfig = {
    email: process.env.STOCK_EMAIL || '',
    password: process.env.STOCK_PASSWORD || '',
    headless: process.env.HEADLESS === 'true',
    debug: process.env.DEBUG === 'true'
  };

  if (!config.email || !config.password) {
    console.error('環境変数 STOCK_EMAIL と STOCK_PASSWORD を設定してください');
    process.exit(1);
  }

  const scraper = new StockScraper(config);

  try {
    await scraper.init();
    const loginSuccess = await scraper.login();
    
    if (!loginSuccess) {
      throw new Error('ログインに失敗しました');
    }

    console.log(`\n解析対象URL: ${targetUrl}`);
    console.log('DOM構造を解析中...\n');
    
    const domStructure = await scraper.analyzeSinglePage(targetUrl);
    
    console.log('=== 検出されたDOM構造 ===');
    console.log(JSON.stringify(domStructure, null, 2));
    
    console.log('\n=== サンプルデータ抽出 ===');
    const sampleData = await scraper.scrapePages([targetUrl], domStructure);
    console.log(JSON.stringify(sampleData[0], null, 2));
    
    await scraper.saveToJson(
      {
        url: targetUrl,
        analyzedAt: new Date().toISOString(),
        domStructure,
        sampleData: sampleData[0]
      },
      'dom-analysis.json'
    );

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

analyze().catch(console.error);
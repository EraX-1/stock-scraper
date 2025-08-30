/**
 * Container main entry point for Azure Container Instances
 * Stock scraper adapted for production workload
 */

import { MainJob } from './mainJob.js';

async function main() {
  console.log('🚀 Stock Scraper Container を開始します');
  
  try {
    const mainJob = new MainJob();
    
    // 環境変数から設定を読み取り
    const isTestMode = process.env.TEST_MODE === 'true';
    const concurrency = parseInt(process.env.SCRAPE_CONCURRENCY || '1');
    const batchSize = parseInt(process.env.SCRAPE_BATCH_SIZE || '5');
    const timeoutMs = parseInt(process.env.SCRAPE_TIMEOUT_MS || '120000');
    const pageLoadDelay = parseInt(process.env.PAGE_LOAD_DELAY || '5000');
    const delayMs = parseInt(process.env.SCRAPE_DELAY_MS || '5000');
    const maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3');
    const maxUrlsCollect = parseInt(process.env.MAX_URLS_COLLECT || '0');
    const maxScrapeCount = parseInt(process.env.MAX_SCRAPE_COUNT || '0');
    
    console.log('📊 Stock スクレイピングを実行中...');
    console.log(`🔧 実行モード: ${isTestMode ? 'TEST' : 'PRODUCTION'}`);
    console.log(`⚙️ 並行処理数: ${concurrency}, バッチサイズ: ${batchSize}`);
    
    // メインジョブ実行（環境変数ベースの設定）
    await mainJob.execute({
      collectUrls: true,
      scrapeToMhtml: true,
      uploadToAzure: !isTestMode,  // テストモードではAzure展開をスキップ
      scrapingConfig: {
        concurrency,
        retryAttempts: maxRetries,
        timeoutMs,
        pageLoadDelay,
        delayMs,
        batchSize,
        maxUrls: isTestMode ? maxUrlsCollect : undefined,
        startIndex: 0
      }
    });
    
    console.log('✅ Stock スクレイピングが完了しました');
    console.log('🏁 コンテナを正常終了します');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 予期しないエラーが発生しました:', error);
  process.exit(1);
});
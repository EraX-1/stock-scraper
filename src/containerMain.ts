/**
 * Container main entry point for Azure Container Instances
 * Stock scraper adapted for production workload
 */

import { MainJob } from './mainJob.js';

async function main() {
  console.log('🚀 Stock Scraper Container を開始します');
  
  try {
    const mainJob = new MainJob();
    
    // メインジョブ実行（コンテナ用設定）
    console.log('📊 Stock スクレイピングを実行中...');
    await mainJob.execute({
      collectUrls: true,
      scrapeToMhtml: true,
      scrapingConfig: {
        concurrency: 1,           // コンテナ環境では安定性重視
        retryAttempts: 3,
        timeoutMs: 120000,        // タイムアウトを長めに設定
        pageLoadDelay: 5000,      // ページ読み込み待機時間を長めに
        delayMs: 5000,            // リクエスト間隔を長めに
        batchSize: 3              // バッチサイズを小さく
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
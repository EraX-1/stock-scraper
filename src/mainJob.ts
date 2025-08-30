import { StockLogin } from './login.js';
import { StockUrlCollector } from './stockUrlCollector.js';
import { StockMhtmlScraper } from './stockMhtmlScraper.js';
import { StockAzureDeployManager } from './azureDeploy.js';
import dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

interface MainJobConfig {
    collectUrls?: boolean;        // URL収集を実行するか
    scrapeToMhtml?: boolean;      // MHTML保存を実行するか
    uploadToAzure?: boolean;      // Azure Blob Storageへのアップロードを実行するか
    scrapingConfig?: {
        concurrency?: number;
        startIndex?: number;
        maxUrls?: number;
        batchSize?: number;
        delayMs?: number;
        retryAttempts?: number;
        timeoutMs?: number;
        pageLoadDelay?: number;
    };
    azureConfig?: {
        dryRun?: boolean;
        timestampPrefix?: boolean;
        concurrency?: number;
    };
}

interface MainJobResult {
    urlCollectionResult?: {
        totalUrls: number;
        savedToFile: string;
    };
    scrapingResult?: {
        totalProcessed: number;
        successCount: number;
        errorCount: number;
        duration: number;
        savedFiles: string[];
    };
    azureUploadResult?: {
        success: number;
        failed: number;
        totalSize: number;
    };
    totalDuration: number;
}

export class MainJob {
    private stockLogin: StockLogin;
    private urlCollector: StockUrlCollector;
    private mhtmlScraper: StockMhtmlScraper;
    private azureDeployManager?: StockAzureDeployManager;
    
    constructor() {
        this.stockLogin = new StockLogin();
        this.urlCollector = new StockUrlCollector();
        this.mhtmlScraper = new StockMhtmlScraper();
        // Azure Deploy Manager は必要時に初期化
    }
    
    /**
     * 🚀 メインジョブ実行（ログイン → URL収集 → MHTML保存）
     */
    async execute(config: MainJobConfig = {}): Promise<MainJobResult> {
        const startTime = Date.now();
        
        console.log('🚀 Stock Scraper メインジョブ開始！');
        console.log('='.repeat(60));
        
        const {
            collectUrls = true,
            scrapeToMhtml = true,
            uploadToAzure = false,
            scrapingConfig = {},
            azureConfig = {}
        } = config;
        
        const result: MainJobResult = {
            totalDuration: 0
        };
        
        try {
            // Step 1: URL収集
            if (collectUrls) {
                console.log('\n📋 Step 1: Stock URL全件収集');
                console.log('-'.repeat(40));
                
                const urls = await this.urlCollector.getAllStockUrls();
                await this.urlCollector.saveUrlsToFile(urls);
                
                result.urlCollectionResult = {
                    totalUrls: urls.length,
                    savedToFile: './stock-urls.txt'
                };
                
                console.log(`✅ URL収集完了: ${urls.length}件`);
            } else {
                console.log('\n⏭️ URL収集をスキップします');
                
                // 既存のURLファイルをチェック
                const urlFilePath = './stock-urls.txt';
                if (!fs.existsSync(urlFilePath)) {
                    throw new Error('❌ stock-urls.txtが存在しません。collectUrls=trueで実行してください');
                }
                
                const content = fs.readFileSync(urlFilePath, 'utf-8');
                const urlCount = content.split('\n').filter(line => line.trim()).length;
                console.log(`📋 既存のURL件数: ${urlCount}件`);
            }
            
            // Step 2: MHTML保存
            if (scrapeToMhtml) {
                console.log('\n💾 Step 2: MHTML一括保存');
                console.log('-'.repeat(40));
                
                const scrapingResult = await this.mhtmlScraper.scrapeAllStocks(scrapingConfig);
                result.scrapingResult = scrapingResult;
                
                console.log(`✅ MHTML保存完了: ${scrapingResult.successCount}件成功`);
            } else {
                console.log('\n⏭️ MHTML保存をスキップします');
            }
            
            // Step 3: Azure Blob Storage アップロード
            if (uploadToAzure) {
                console.log('\n☁️ Step 3: Azure Blob Storage アップロード');
                console.log('-'.repeat(40));
                
                // Azure Deploy Manager を遅延初期化
                if (!this.azureDeployManager) {
                    this.azureDeployManager = new StockAzureDeployManager();
                }
                
                const uploadResult = await this.azureDeployManager.deployStockMhtml({
                    dryRun: azureConfig.dryRun || false,
                    timestampPrefix: azureConfig.timestampPrefix || false,
                    concurrency: azureConfig.concurrency || 5,
                    overwrite: true
                });
                
                // アップロード結果を取得（deployStockMhtmlの戻り値を調整する必要があります）
                result.azureUploadResult = {
                    success: 0, // 実際の値に更新予定
                    failed: 0,  // 実際の値に更新予定
                    totalSize: 0 // 実際の値に更新予定
                };
                
                console.log(`✅ Azure アップロード完了`);
            } else {
                console.log('\n⏭️ Azure アップロードをスキップします');
            }
            
            
        } catch (error) {
            console.error('❌ メインジョブでエラーが発生しました:', error);
            throw error;
        } finally {
            const endTime = Date.now();
            result.totalDuration = endTime - startTime;
            
            // 最終結果表示
            this.displayFinalResults(result);
        }
        
        return result;
    }
    
    /**
     * 📊 最終結果を表示
     */
    private displayFinalResults(result: MainJobResult): void {
        console.log('\n🏁 Stock Scraper メインジョブ完了！');
        console.log('='.repeat(60));
        
        if (result.urlCollectionResult) {
            console.log(`📋 URL収集結果:`);
            console.log(`   └─ 収集URL数: ${result.urlCollectionResult.totalUrls}件`);
            console.log(`   └─ 保存ファイル: ${result.urlCollectionResult.savedToFile}`);
        }
        
        if (result.scrapingResult) {
            console.log(`💾 MHTML保存結果:`);
            console.log(`   ├─ 総処理数: ${result.scrapingResult.totalProcessed}件`);
            console.log(`   ├─ 成功: ${result.scrapingResult.successCount}件`);
            console.log(`   ├─ エラー: ${result.scrapingResult.errorCount}件`);
            console.log(`   ├─ 処理時間: ${Math.round(result.scrapingResult.duration / 1000)}秒`);
            console.log(`   └─ 成功率: ${Math.round((result.scrapingResult.successCount / result.scrapingResult.totalProcessed) * 100)}%`);
        }
        
        if (result.azureUploadResult) {
            console.log(`☁️ Azure アップロード結果:`);
            console.log(`   ├─ 成功: ${result.azureUploadResult.success}件`);
            console.log(`   ├─ 失敗: ${result.azureUploadResult.failed}件`);
            console.log(`   └─ 総サイズ: ${Math.round(result.azureUploadResult.totalSize / 1024 / 1024)}MB`);
        }
        
        console.log(`⏱️  総処理時間: ${Math.round(result.totalDuration / 1000)}秒`);
        console.log(`📁 保存場所: ./stock-mhtml/`);
        
        if (result.scrapingResult && result.scrapingResult.errorCount === 0) {
            console.log('🎉 全件正常に処理されました！');
        }
        
        console.log('='.repeat(60));
    }
    
    /**
     * 📊 保存済みファイルの統計情報
     */
    async getStatistics(): Promise<{
        urlFileExists: boolean;
        urlCount: number;
        mhtmlStats: {
            fileCount: number;
            totalSize: number;
            filenames: string[];
        };
    }> {
        const stats = {
            urlFileExists: false,
            urlCount: 0,
            mhtmlStats: {
                fileCount: 0,
                totalSize: 0,
                filenames: [] as string[]
            }
        };
        
        // URLファイルの確認
        const urlFilePath = './stock-urls.txt';
        if (fs.existsSync(urlFilePath)) {
            stats.urlFileExists = true;
            const content = fs.readFileSync(urlFilePath, 'utf-8');
            stats.urlCount = content.split('\n').filter(line => line.trim()).length;
        }
        
        // MHTMLファイルの統計
        stats.mhtmlStats = await this.mhtmlScraper.getStatistics();
        
        return stats;
    }
}

// メイン処理関数
async function main() {
    const job = new MainJob();
    
    // コマンドライン引数を解析
    const args = process.argv.slice(2);
    const collectUrls = !args.includes('--no-urls');
    const scrapeToMhtml = !args.includes('--no-mhtml');
    const uploadToAzure = args.includes('--azure');
    const fullMode = args.includes('--full');
    
    // 設定表示
    console.log('⚙️  実行設定:');
    console.log(`   ├─ URL収集: ${collectUrls ? '有効' : '無効'}`);
    console.log(`   ├─ MHTML保存: ${scrapeToMhtml ? '有効' : '無効'}`);
    console.log(`   ├─ Azure アップロード: ${uploadToAzure ? '有効' : '無効'}`);
    console.log(`   └─ 全件モード: ${fullMode ? '有効 (5371件全て)' : '無効 (制限付き)'}`);
    console.log('');
    
    if (args.includes('--stats')) {
        // 統計情報のみ表示
        console.log('📊 現在の統計情報:');
        const stats = await job.getStatistics();
        
        console.log(`📋 URL情報:`);
        console.log(`   ├─ ファイル存在: ${stats.urlFileExists ? 'あり' : 'なし'}`);
        console.log(`   └─ URL数: ${stats.urlCount}件`);
        
        console.log(`💾 MHTML情報:`);
        console.log(`   ├─ ファイル数: ${stats.mhtmlStats.fileCount}件`);
        console.log(`   └─ 総サイズ: ${Math.round(stats.mhtmlStats.totalSize / 1024 / 1024)}MB`);
        
        return;
    }
    
    try {
        // メインジョブ実行（全件モードまたは制限モード）
        const config = fullMode ? {
            // 全件モード設定（5371件全て）
            collectUrls,
            scrapeToMhtml,
            uploadToAzure,
            scrapingConfig: {
                concurrency: 1,           // 全件の場合は安定性重視で同時実行数を1に
                retryAttempts: 3,
                timeoutMs: 150000,        // タイムアウトを2.5分に延長
                pageLoadDelay: 8000,      // ページ読み込み後の待機時間を8秒に延長
                delayMs: 4000,            // リクエスト間隔を4秒に延長
                batchSize: 3,             // バッチサイズを3に縮小
                maxUrls: Infinity         // 全件処理
            },
            azureConfig: {
                dryRun: false,
                timestampPrefix: true,    // 全件の場合はタイムスタンプを付与
                concurrency: 3
            }
        } : {
            // 制限モード設定（テスト用）
            collectUrls,
            scrapeToMhtml,
            uploadToAzure,
            scrapingConfig: {
                concurrency: 2,
                retryAttempts: 3,
                timeoutMs: 120000,        // タイムアウトを2分に延長
                pageLoadDelay: 6000,      // ページ読み込み後の待機時間を6秒に延長
                delayMs: 3000,
                batchSize: 5,
                maxUrls: 50               // 制限モードでは50件まで
            },
            azureConfig: {
                dryRun: false,
                timestampPrefix: false,
                concurrency: 5
            }
        };
        
        await job.execute(config);
        
        console.log('🎉 全処理が正常に完了しました！');
        
    } catch (error) {
        console.error('❌ メインジョブでエラーが発生:', error);
        process.exit(1);
    }
}

// このファイルが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
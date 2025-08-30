import { StockLogin } from './login.js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface StockScrapingConfig {
    concurrency?: number;     // 同時実行数
    startIndex?: number;      // 開始インデックス
    maxUrls?: number;         // 最大処理数
    batchSize?: number;       // バッチサイズ
    delayMs?: number;         // 処理間の待機時間
    retryAttempts?: number;   // リトライ回数
    timeoutMs?: number;       // タイムアウト時間
    pageLoadDelay?: number;   // ページ読み込み後の待機時間
}

interface StockScrapingResult {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    duration: number;
    savedFiles: string[];
}

export class StockMhtmlScraper {
    private stockLogin: StockLogin;
    private mhtmlDir: string;
    
    constructor() {
        this.stockLogin = new StockLogin();
        this.mhtmlDir = './stock-mhtml';
    }
    
    /**
     * 📁 MHTMLディレクトリを作成
     */
    private async ensureMhtmlDirectory(): Promise<void> {
        if (!fs.existsSync(this.mhtmlDir)) {
            fs.mkdirSync(this.mhtmlDir, { recursive: true });
            console.log(`📁 MHTMLディレクトリを作成: ${this.mhtmlDir}`);
        }
    }
    
    /**
     * 📄 URLファイルを読み込み
     */
    private async loadStockUrls(): Promise<string[]> {
        const urlFilePath = './stock-urls.txt';
        
        if (!fs.existsSync(urlFilePath)) {
            throw new Error(`❌ URLファイルが見つかりません: ${urlFilePath}`);
        }
        
        const content = fs.readFileSync(urlFilePath, 'utf-8');
        const urls = content.split('\n')
            .map(url => url.trim())
            .filter(url => url && url.startsWith('http'));
        
        console.log(`📋 読み込んだURL数: ${urls.length}件`);
        return urls;
    }
    
    /**
     * 🔤 URLからStock IDを抽出
     */
    private extractStockId(url: string): string {
        const match = url.match(/\/stocks\/(\d+)\/edit/);
        return match ? match[1] : `unknown_${Date.now()}`;
    }
    
    /**
     * 💾 個別Stock URLをMHTMLで保存（リトライ機能付き）
     */
    private async saveStockAsMhtml(
        url: string, 
        page: any, 
        retryAttempts: number = 3, 
        timeoutMs: number = 60000, 
        pageLoadDelay: number = 3000
    ): Promise<{ success: boolean; filename?: string; error?: string; retries?: number }> {
        const stockId = this.extractStockId(url);
        const filename = `stock_${stockId}.mhtml`;
        const filepath = path.join(this.mhtmlDir, filename);
        
        // 既に保存されている場合はスキップ
        if (fs.existsSync(filepath)) {
            return { success: true, filename };
        }
        
        let lastError: string = '';
        
        // リトライループ
        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            try {
                console.log(`📄 処理中: Stock ID ${stockId} (${attempt}/${retryAttempts})...`);
                
                // 段階的なページ読み込み
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: timeoutMs 
                });
                
                // DOMコンテンツ読み込み後の追加待機
                await page.waitForTimeout(pageLoadDelay);
                
                // ネットワークアイドル状態まで待機（タイムアウト付き）
                try {
                    await page.waitForLoadState('networkidle', { timeout: timeoutMs / 2 });
                } catch (networkError) {
                    console.log(`⚠️ ネットワーク待機タイムアウト (Stock ID ${stockId}) - 続行します`);
                }
                
                // ページが正常に読み込まれているかチェック
                const pageTitle = await page.title();
                if (!pageTitle || pageTitle.toLowerCase().includes('error')) {
                    throw new Error(`ページタイトルが不正: "${pageTitle}"`);
                }
                
                // 画像とアセットの完全読み込みを待機
                await this.waitForAssetsLoaded(page);
                
                // 追加の安定化待機（画像読み込み用に延長）
                await page.waitForTimeout(3000);
                
                // CDPセッションを取得してMHTML生成
                const cdpSession = await page.context().newCDPSession(page);
                const { data } = await cdpSession.send('Page.captureSnapshot', { format: 'mhtml' });
                
                // MHTMLデータの有効性チェック
                if (!data || data.length < 1000) { // 最小サイズチェック
                    throw new Error(`MHTMLデータが不完全 (サイズ: ${data?.length || 0})`);
                }
                
                // MHTMLファイルを保存
                fs.writeFileSync(filepath, data, 'utf-8');
                
                console.log(`✅ 保存完了: ${filename} (${attempt}回目で成功)`);
                return { success: true, filename, retries: attempt - 1 };
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                lastError = errorMessage;
                
                if (attempt === retryAttempts) {
                    // 最後の試行で失敗
                    console.error(`❌ 保存失敗: Stock ID ${stockId} (${retryAttempts}回リトライ後) - ${errorMessage}`);
                } else {
                    // リトライ前の待機
                    console.log(`⚠️ Stock ID ${stockId} (${attempt}回目失敗): ${errorMessage} - ${2000 * attempt}ms後にリトライ`);
                    await page.waitForTimeout(2000 * attempt); // 段階的に待機時間を増加
                }
            }
        }
        
        return { success: false, error: lastError, retries: retryAttempts };
    }
    
    /**
     * 🚀 全Stock URLをMHTMLで一括保存
     */
    async scrapeAllStocks(config: StockScrapingConfig = {}): Promise<StockScrapingResult> {
        const startTime = Date.now();
        const {
            concurrency = 2,          // 同時実行数を2に削減（安定性重視）
            startIndex = 0,           // 開始インデックス
            maxUrls = Infinity,       // 全件処理
            batchSize = 5,            // バッチサイズを5に削減
            delayMs = 3000,           // 3秒待機に延長
            retryAttempts = 3,        // リトライ回数
            timeoutMs = 90000,        // タイムアウト90秒に延長
            pageLoadDelay = 4000      // ページ読み込み後4秒待機
        } = config;
        
        console.log('🚀 Stock MHTML一括保存を開始...');
        console.log(`⚙️  設定: 同時実行数=${concurrency}, バッチサイズ=${batchSize}, 待機時間=${delayMs}ms`);
        console.log(`🔄 リトライ設定: ${retryAttempts}回, タイムアウト=${timeoutMs}ms, ページ待機=${pageLoadDelay}ms`);
        
        // 準備処理
        await this.ensureMhtmlDirectory();
        const allUrls = await this.loadStockUrls();
        
        // 処理対象URLを決定
        const targetUrls = allUrls.slice(startIndex, startIndex + maxUrls);
        console.log(`📊 処理対象: ${targetUrls.length}件 (${startIndex + 1}番目から)`);
        
        let totalProcessed = 0;
        let successCount = 0;
        let errorCount = 0;
        const savedFiles: string[] = [];
        
        // ブラウザ初期化
        await this.stockLogin.initialize();
        const loginSuccess = await this.stockLogin.login();
        
        if (!loginSuccess) {
            throw new Error('❌ ログインに失敗しました');
        }
        
        const page = this.stockLogin.getPage();
        if (!page) {
            throw new Error('❌ ページが取得できませんでした');
        }
        
        console.log('🔐 ログイン完了！MHTML保存を開始します...');
        
        // バッチ処理でURLを分割
        for (let i = 0; i < targetUrls.length; i += batchSize) {
            const batchUrls = targetUrls.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(targetUrls.length / batchSize);
            
            console.log(`\n📦 バッチ ${batchNum}/${totalBatches}: ${batchUrls.length}件処理中...`);
            
            // バッチ内を並列処理（制限付き）
            for (let j = 0; j < batchUrls.length; j += concurrency) {
                const concurrentUrls = batchUrls.slice(j, j + concurrency);
                
                // 同時実行（改善されたパラメータを渡す）
                const concurrentPromises = concurrentUrls.map(url => 
                    this.saveStockAsMhtml(url, page, retryAttempts, timeoutMs, pageLoadDelay)
                );
                
                const results = await Promise.allSettled(concurrentPromises);
                
                // 結果処理
                results.forEach((result) => {
                    totalProcessed++;
                    
                    if (result.status === 'fulfilled') {
                        if (result.value.success) {
                            successCount++;
                            if (result.value.filename) {
                                savedFiles.push(result.value.filename);
                            }
                        } else {
                            errorCount++;
                        }
                    } else {
                        errorCount++;
                        console.error(`💥 Promise失敗: ${result.reason}`);
                    }
                });
                
                // 同時実行グループ間の待機
                if (j + concurrency < batchUrls.length) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            
            // バッチ間の進捗表示
            console.log(`📈 進捗: ${totalProcessed}/${targetUrls.length}件 (成功: ${successCount}件, エラー: ${errorCount}件)`);
            
            // バッチ間の待機
            if (i + batchSize < targetUrls.length) {
                console.log(`⏳ ${delayMs}ms待機中...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        // 終了処理
        await this.stockLogin.close();
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 最終結果表示
        console.log('\n🏁 Stock MHTML一括保存完了!');
        console.log('='.repeat(60));
        console.log(`📊 総処理数: ${totalProcessed}件`);
        console.log(`✅ 成功: ${successCount}件`);
        console.log(`❌ エラー: ${errorCount}件`);
        console.log(`📁 保存先: ${this.mhtmlDir}/`);
        console.log(`⏱️  処理時間: ${Math.round(duration / 1000)}秒`);
        console.log(`⚡ 平均速度: ${Math.round(totalProcessed / (duration / 1000))}件/秒`);
        
        return {
            totalProcessed,
            successCount,
            errorCount,
            duration,
            savedFiles
        };
    }
    
    /**
     * 🖼️ 画像とアセットの完全読み込みを待機
     */
    private async waitForAssetsLoaded(page: any): Promise<void> {
        try {
            // 1. すべての画像の読み込み完了を待機
            await page.waitForFunction(() => {
                const images = Array.from(document.images);
                if (images.length === 0) return true;
                return images.every(img => img.complete && img.naturalHeight !== 0);
            }, { timeout: 30000 });
            
            // 2. CSS背景画像の読み込み完了を待機
            await page.waitForFunction(() => {
                const elementsWithBgImage = Array.from(document.querySelectorAll('*')).filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.backgroundImage && style.backgroundImage !== 'none';
                });
                return elementsWithBgImage.length === 0 || elementsWithBgImage.every(el => {
                    const style = window.getComputedStyle(el);
                    const htmlEl = el as HTMLElement;
                    return style.backgroundImage.includes('data:') || htmlEl.offsetHeight > 0;
                });
            }, { timeout: 20000 });
            
            // 3. 動的コンテンツの読み込み完了を確認
            await page.waitForFunction(() => {
                const loaders = document.querySelectorAll('.loading, .spinner, [data-loading="true"], .lazy-loading');
                return loaders.length === 0;
            }, { timeout: 15000 });
            
            console.log(`🖼️ アセット読み込み完了`);
            
        } catch (error) {
            console.log(`⚠️ アセット読み込み待機タイムアウト - 続行`);
        }
    }
    
    /**
     * 📊 保存済みファイルの統計情報
     */
    async getStatistics(): Promise<{ fileCount: number; totalSize: number; filenames: string[] }> {
        if (!fs.existsSync(this.mhtmlDir)) {
            return { fileCount: 0, totalSize: 0, filenames: [] };
        }
        
        const files = fs.readdirSync(this.mhtmlDir).filter(f => f.endsWith('.mhtml'));
        let totalSize = 0;
        
        files.forEach(filename => {
            const filepath = path.join(this.mhtmlDir, filename);
            const stats = fs.statSync(filepath);
            totalSize += stats.size;
        });
        
        return {
            fileCount: files.length,
            totalSize,
            filenames: files
        };
    }
}

// CLIから実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
    const scraper = new StockMhtmlScraper();
    
    // コマンドライン引数を解析
    const args = process.argv.slice(2);
    const startIndex = args[0] ? parseInt(args[0]) : 0;
    const maxUrls = args[1] ? parseInt(args[1]) : Infinity;
    const concurrency = args[2] ? parseInt(args[2]) : 3;
    const batchSize = args[3] ? parseInt(args[3]) : 10;
    
    console.log(`🚀 Stock MHTML一括保存開始:`);
    console.log(`📊 開始インデックス: ${startIndex}`);
    console.log(`📊 最大処理数: ${maxUrls === Infinity ? '全件' : maxUrls}`);
    console.log(`⚡ 同時実行数: ${concurrency}`);
    console.log(`📦 バッチサイズ: ${batchSize}`);
    
    scraper.scrapeAllStocks({ startIndex, maxUrls, concurrency, batchSize }).catch(console.error);
}
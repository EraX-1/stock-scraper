import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

export class StockUrlCollector {
    private stockLogin: StockLogin;
    
    constructor() {
        this.stockLogin = new StockLogin();
    }
    
    /**
     * ⬇️ stockListContainerで下方向スクロールして全件読み込み
     */
    private async performCompleteScroll(page: any): Promise<void> {
        console.log('⬇️ stockListContainerでの全件読み込みを開始...');
        
        // stockListContainerの存在確認
        const container = await page.$('#stockListContainer');
        if (!container) {
            throw new Error('❌ stockListContainerが見つかりません');
        }
        
        // コンテナにフォーカス
        await page.focus('#stockListContainer');
        await page.waitForTimeout(500);
        
        // コンテナの中心にマウスを移動
        const containerBounds = await page.$eval('#stockListContainer', (el: any) => {
            const rect = el.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        });
        
        await page.mouse.move(containerBounds.x, containerBounds.y);
        console.log('🎯 マウスをstockListContainerに配置完了');
        
        let previousCount = 0;
        let currentCount = 0;
        let scrollCount = 0;
        const maxScrolls = 1000; // 大幅増加（数千件対応）
        let noChangeCount = 0; // 変化なしカウンター
        
        while (scrollCount < maxScrolls && noChangeCount < 8) {
            scrollCount++;
            
            // 現在の要素数を確認
            currentCount = await page.$$eval(
                'a[href*="/stocks/"][href*="/edit"]', 
                (elements: any[]) => elements.length
            );
            
            console.log(`⬇️ スクロール ${scrollCount}回目 - 現在のStock数: ${currentCount}件`);
            
            // 大幅に下方向にスクロール（一度に大量スクロール）
            await page.mouse.wheel(0, 1500); // 大幅増加
            await page.waitForTimeout(800);
            
            // さらに追加で大量スクロール
            await page.mouse.wheel(0, 1200);
            await page.waitForTimeout(800);
            
            // 追加の大量スクロール
            await page.mouse.wheel(0, 1000);
            await page.waitForTimeout(800);
            
            // ネットワーク活動を待機
            try {
                await page.waitForLoadState('networkidle', { timeout: 3000 });
            } catch (error) {
                // タイムアウトは正常
            }
            
            // 要素数の変化をチェック
            if (currentCount > previousCount) {
                console.log(`📈 要素追加！ ${previousCount} → ${currentCount}件 (+${currentCount - previousCount})`);
                previousCount = currentCount;
                noChangeCount = 0; // リセット
            } else {
                noChangeCount++;
                console.log(`📊 変化なし (${noChangeCount}/8)`);
                
                // より積極的なスクロールを試行
                if (noChangeCount >= 3) {
                    console.log('🚀 超積極的にスクロール...');
                    await page.mouse.wheel(0, 2000); // さらに大幅増加
                    await page.waitForTimeout(800);
                    await page.mouse.wheel(0, 1800);
                    await page.waitForTimeout(800);
                    await page.mouse.wheel(0, 1500);
                    await page.waitForTimeout(800);
                }
            }
            
            // コンテナの下端チェック
            const scrollInfo = await page.$eval('#stockListContainer', (el: any) => ({
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                isAtBottom: (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 50)
            }));
            
            if (scrollInfo.isAtBottom && noChangeCount >= 5) {
                console.log('📍 下端に到達し、追加読み込みもなくなりました');
                break;
            }
            
            // 進捗報告（100件ごと）
            if (currentCount > 0 && currentCount % 100 === 0) {
                console.log(`🎯 進捗: ${currentCount}件取得済み...`);
            }
        }
        
        if (scrollCount >= maxScrolls) {
            console.log(`⚠️ 最大スクロール数に到達 (${maxScrolls}回)`);
        } else {
            console.log(`✅ 全件読み込み完了！ (${scrollCount}回スクロール)`);
        }
        
        console.log(`🎯 最終的なStock数: ${currentCount}件`);
        
        // 最上部に戻る
        await page.$eval('#stockListContainer', (el: any) => {
            el.scrollTop = 0;
        });
        await page.waitForTimeout(1000);
    }
    
    /**
     * 🔗 Stock URL全件取得
     */
    async getAllStockUrls(): Promise<string[]> {
        try {
            console.log('🚀 Stock URL全件取得を開始...');
            
            // ログイン処理
            await this.stockLogin.initialize();
            const loginSuccess = await this.stockLogin.login();
            
            if (!loginSuccess) {
                throw new Error('❌ ログインに失敗しました');
            }
            
            const page = this.stockLogin.getPage();
            if (!page) {
                throw new Error('❌ ページが取得できませんでした');
            }
            
            // 全Stocksページにアクセス
            const allStocksUrl = 'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks';
            console.log('🔗 全Stocksページにアクセス中...');
            await page.goto(allStocksUrl);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000); // 安全な待機時間
            
            console.log('📊 stockListContainerでStock URL全件収集中...');
            
            // stockListContainerで下方向スクロールして全件読み込み
            await this.performCompleteScroll(page);
            
            // 堅牢なセレクターを使用してURL取得
            const stockUrls = await page.$$eval(
                'a[href*="/stocks/"][href*="/edit"]', 
                (elements) => elements
                    .map(el => el.getAttribute('href'))
                    .filter((href): href is string => href !== null)
                    .filter(href => href.includes('/stocks/') && href.includes('/edit'))
            );
            
            console.log(`✅ Stock URL収集完了: ${stockUrls.length}件`);
            
            // URLを絶対URLに変換
            const baseUrl = 'https://www.stock-app.jp';
            const absoluteUrls = stockUrls.map(url => {
                if (url.startsWith('http')) {
                    return url;
                } else if (url.startsWith('/')) {
                    return baseUrl + url;
                } else {
                    return baseUrl + '/' + url;
                }
            });
            
            // 重複除去
            const uniqueUrls = [...new Set(absoluteUrls)];
            console.log(`🔄 重複除去後: ${uniqueUrls.length}件`);
            
            // URL形式の検証
            const validUrls = uniqueUrls.filter(url => {
                const urlPattern = /\/stocks\/\d+\/edit$/;
                return urlPattern.test(url);
            });
            
            console.log(`✅ 有効なURL: ${validUrls.length}件`);
            
            if (process.env.DEBUG === 'true') {
                console.log('🔍 取得されたURL（最初の10件）:');
                validUrls.slice(0, 10).forEach((url, index) => {
                    console.log(`${index + 1}. ${url}`);
                });
            }
            
            return validUrls;
            
        } catch (error) {
            console.error('❌ URL収集中にエラーが発生:', error);
            throw error;
        } finally {
            await this.stockLogin.close();
        }
    }
    
    /**
     * 📁 URLをファイルに保存
     */
    async saveUrlsToFile(urls: string[], filePath: string = './stock-urls.txt'): Promise<void> {
        try {
            const fs = await import('fs');
            const content = urls.join('\n');
            
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`💾 URLを保存しました: ${filePath} (${urls.length}件)`);
        } catch (error) {
            console.error('❌ ファイル保存中にエラー:', error);
            throw error;
        }
    }
    
    /**
     * 📊 URLからStock IDを抽出
     */
    extractStockIds(urls: string[]): string[] {
        return urls.map(url => {
            const match = url.match(/\/stocks\/(\d+)\/edit/);
            return match ? match[1] : '';
        }).filter(id => id);
    }
}

// スタンドアローン実行用
async function main() {
    const collector = new StockUrlCollector();
    
    try {
        const urls = await collector.getAllStockUrls();
        
        console.log('📋 結果サマリー:');
        console.log(`📊 取得URL数: ${urls.length}件`);
        
        // ファイル保存
        await collector.saveUrlsToFile(urls);
        
        // Stock ID抽出
        const stockIds = collector.extractStockIds(urls);
        console.log(`🔢 抽出されたStock ID数: ${stockIds.length}件`);
        
        if (process.env.DEBUG === 'true') {
            console.log('🔍 Stock ID（最初の10件）:');
            stockIds.slice(0, 10).forEach((id, index) => {
                console.log(`${index + 1}. ${id}`);
            });
        }
        
        console.log('🎉 全処理完了！');
        
    } catch (error) {
        console.error('❌ メイン処理中にエラー:', error);
        process.exit(1);
    }
}

// このファイルが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
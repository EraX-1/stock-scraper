import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function findRobustSelectors() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('🔍 堅牢なセレクターの調査を開始...');
        
        await stockLogin.initialize();
        const loginSuccess = await stockLogin.login();
        
        if (!loginSuccess) {
            throw new Error('❌ ログインに失敗しました');
        }
        
        const page = stockLogin.getPage();
        if (!page) {
            throw new Error('❌ ページが取得できませんでした');
        }
        
        const allStocksUrl = 'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks';
        await page.goto(allStocksUrl);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        console.log('📊 様々なセレクターパターンをテスト中...');
        
        // より堅牢なセレクターパターンを試す
        const testSelectors = [
            // URL パターンベース（最も堅牢）
            'a[href*="/stocks/"][href*="/edit"]',
            'a[href*="/stocks/"]',
            
            // 構造ベース
            'a[href][href*="stocks"]',
            
            // 階層構造ベース  
            'div[class*="stock"] a[href]',
            '[class*="stock"] a',
            
            // より汎用的なパターン
            'a[href][href*="/dashboard/all/stocks/"]',
            'a[href^="https://www.stock-app.jp/teams/c20282/dashboard/all/stocks/"]'
        ];
        
        for (const selector of testSelectors) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`✅ ${selector}: ${elements.length}件`);
                    
                    // 最初の3件のURLをサンプル表示
                    const sampleUrls = await page.$$eval(selector, (elements) => 
                        elements.slice(0, 3).map(el => el.getAttribute('href') || el.href)
                    );
                    sampleUrls.forEach((url, index) => {
                        console.log(`   ${index + 1}. ${url}`);
                    });
                } else {
                    console.log(`❌ ${selector}: 0件`);
                }
            } catch (error) {
                console.log(`❌ ${selector}: エラー - ${error}`);
            }
        }
        
        // 最適なセレクターを選定
        console.log('🎯 最適なセレクターの選定...');
        
        const bestSelector = 'a[href*="/stocks/"][href*="/edit"]';
        const stockUrls = await page.$$eval(bestSelector, (elements) => 
            elements.map(el => el.getAttribute('href') || el.href)
                    .filter(url => url && url.includes('/stocks/') && url.includes('/edit'))
        );
        
        console.log(`🏆 推奨セレクター: ${bestSelector}`);
        console.log(`📊 取得可能URL数: ${stockUrls.length}件`);
        
        console.log('📋 取得されるURL形式の確認:');
        stockUrls.slice(0, 5).forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });
        
        // URL形式の統一性確認
        const uniquePatterns = [...new Set(stockUrls.map(url => {
            const match = url.match(/\/stocks\/(\d+)\/edit/);
            return match ? 'stocks/{id}/edit' : 'その他';
        }))];
        
        console.log('🔍 URL形式パターン:', uniquePatterns);
        
    } catch (error) {
        console.error('❌ セレクター調査中にエラー:', error);
    } finally {
        await stockLogin.close();
    }
}

findRobustSelectors();
import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugInfiniteScroll() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('🔍 無限スクロールのデバッグ調査を開始...');
        
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
        
        console.log('📊 初期状態の要素数確認...');
        let currentCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
        console.log(`📈 現在のStock数: ${currentCount}件`);
        
        // ページの高さを確認
        let currentHeight = await page.evaluate(() => document.body.scrollHeight);
        console.log(`📏 現在のページ高さ: ${currentHeight}px`);
        
        // 手動で複数回スクロールしてみる
        for (let i = 1; i <= 10; i++) {
            console.log(`🔄 手動スクロール ${i}回目...`);
            
            // より積極的なスクロール方法を試す
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(1000);
            
            // さらに下にスクロール
            await page.evaluate(() => {
                window.scrollBy(0, 1000);
            });
            await page.waitForTimeout(2000);
            
            // 新しい高さと要素数を確認
            const newHeight = await page.evaluate(() => document.body.scrollHeight);
            const newCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
            
            console.log(`📏 高さ: ${currentHeight} → ${newHeight} (+${newHeight - currentHeight})`);
            console.log(`📊 Stock数: ${currentCount} → ${newCount} (+${newCount - currentCount})`);
            
            // ローディング要素やページネーション要素を探す
            const loadingElements = await page.$$eval('*', (elements) => 
                elements.filter(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    const className = el.className?.toLowerCase() || '';
                    return text.includes('loading') || text.includes('読み込み') || 
                           text.includes('もっと') || text.includes('次へ') ||
                           className.includes('loading') || className.includes('more');
                }).map(el => ({
                    tag: el.tagName,
                    text: el.textContent?.slice(0, 50) || '',
                    className: el.className
                }))
            );
            
            if (loadingElements.length > 0) {
                console.log('🔄 ローディング要素発見:');
                loadingElements.forEach((el, idx) => {
                    console.log(`  ${idx + 1}. [${el.tag}] ${el.className} - "${el.text}"`);
                });
            }
            
            // 変化がなかった場合は終了
            if (newHeight === currentHeight && newCount === currentCount) {
                console.log('⏹️ 変化なし - スクロール終了');
                break;
            }
            
            currentHeight = newHeight;
            currentCount = newCount;
        }
        
        console.log('🔍 最終的な状況確認...');
        
        // 全体の構造を確認
        const pageStructure = await page.evaluate(() => {
            const allElements = document.querySelectorAll('*');
            const elementCounts = {};
            
            Array.from(allElements).forEach(el => {
                const tag = el.tagName;
                const classes = Array.from(el.classList).join(' ');
                const key = classes ? `${tag}.${classes}` : tag;
                elementCounts[key] = (elementCounts[key] || 0) + 1;
            });
            
            return Object.entries(elementCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([key, count]) => ({ element: key, count }));
        });
        
        console.log('📊 ページ構造（要素数上位20位）:');
        pageStructure.forEach((item, index) => {
            console.log(`${index + 1}. ${item.element}: ${item.count}個`);
        });
        
        // ページの総要素数を確認（343件と表示されていた理由を探る）
        const totalElements = await page.evaluate(() => document.querySelectorAll('*').length);
        console.log(`🔢 ページの総要素数: ${totalElements}個`);
        
        // 以前の調査で343件と表示されていた要素を再調査
        const allStockElements = await page.$$eval('[class*="stock"]', (elements) => elements.length);
        console.log(`📈 [class*="stock"]の要素数: ${allStockElements}件`);
        
    } catch (error) {
        console.error('❌ デバッグ調査中にエラー:', error);
    } finally {
        await stockLogin.close();
    }
}

debugInfiniteScroll();
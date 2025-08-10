import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function investigatePagination() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('📖 ページネーション調査を開始...');
        
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
        
        console.log('🔍 ページ上のすべてのボタンとリンクを調査...');
        
        // すべてのクリック可能な要素を調査
        const clickableElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], .btn, .button, [class*="page"], [class*="more"], [class*="next"], [class*="prev"]'));
            
            return elements.map(el => ({
                tag: el.tagName,
                text: (el.textContent || '').trim().slice(0, 100),
                className: el.className || '',
                id: el.id || '',
                href: el.getAttribute('href') || '',
                role: el.getAttribute('role') || '',
                onclick: el.getAttribute('onclick') || ''
            })).filter(item => 
                item.text || item.className || item.href || item.onclick
            );
        });
        
        console.log(`🔗 発見されたクリック可能要素: ${clickableElements.length}件`);
        
        clickableElements.forEach((el, index) => {
            if (el.text || el.className.includes('page') || el.className.includes('more') || 
                el.text.includes('もっと') || el.text.includes('次') || el.text.includes('more') ||
                el.text.includes('load') || el.text.includes('読み込') || el.href.includes('page')) {
                console.log(`${index + 1}. [${el.tag}] "${el.text}"`);
                if (el.className) console.log(`   クラス: ${el.className}`);
                if (el.href) console.log(`   リンク: ${el.href}`);
                if (el.onclick) console.log(`   onClick: ${el.onclick}`);
            }
        });
        
        // 「もっと見る」や「次のページ」のようなテキストを含む要素を探す
        console.log('🔍 「もっと見る」系のボタンを探索...');
        
        const moreButtons = await page.$$eval('*', (elements) => {
            return elements.filter(el => {
                const text = (el.textContent || '').toLowerCase();
                return text.includes('more') || text.includes('もっと') || 
                       text.includes('次') || text.includes('load') ||
                       text.includes('読み込') || text.includes('表示');
            }).map(el => ({
                tag: el.tagName,
                text: (el.textContent || '').trim(),
                className: el.className || '',
                visible: el.offsetParent !== null
            }));
        });
        
        console.log(`📄 「もっと見る」系要素: ${moreButtons.length}件`);
        moreButtons.forEach((btn, index) => {
            console.log(`${index + 1}. [${btn.tag}] "${btn.text}" (表示: ${btn.visible ? 'Yes' : 'No'})`);
            if (btn.className) console.log(`   クラス: ${btn.className}`);
        });
        
        // 実際には343件あるはずなので、別のページやフィルターがあるかもしれない
        console.log('🔍 フィルターやタブを探索...');
        
        // URLパラメータを変えて全件表示を試す
        const possibleUrls = [
            'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks?per_page=100',
            'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks?limit=100',
            'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks?show=all',
            'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks?page=1&per_page=1000'
        ];
        
        for (const testUrl of possibleUrls) {
            try {
                console.log(`🔗 テストURL: ${testUrl}`);
                await page.goto(testUrl);
                await page.waitForLoadState('networkidle', { timeout: 5000 });
                await page.waitForTimeout(2000);
                
                const count = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
                console.log(`📊 取得数: ${count}件`);
                
                if (count > 20) {
                    console.log('🎉 より多くの件数が取得できました！');
                    break;
                }
            } catch (error) {
                console.log(`❌ URL ${testUrl} でエラー:`, error.message);
            }
        }
        
        // 現在のURLを確認
        console.log('📍 最終的なURL:', page.url());
        
        // JavaScriptでページ内の全データを取得する方法があるかチェック
        console.log('🔍 JavaScript変数やAPIエンドポイントを探索...');
        
        const jsVariables = await page.evaluate(() => {
            const results = [];
            
            // よくあるグローバル変数名をチェック
            const varNames = ['stocks', 'data', 'items', 'list', 'stockData', 'allStocks'];
            
            varNames.forEach(varName => {
                if (typeof window[varName] !== 'undefined') {
                    const value = window[varName];
                    results.push({
                        name: varName,
                        type: typeof value,
                        isArray: Array.isArray(value),
                        length: Array.isArray(value) ? value.length : 'N/A'
                    });
                }
            });
            
            return results;
        });
        
        if (jsVariables.length > 0) {
            console.log('📊 発見されたJavaScript変数:');
            jsVariables.forEach((variable, index) => {
                console.log(`${index + 1}. ${variable.name}: ${variable.type} (配列: ${variable.isArray}, 長さ: ${variable.length})`);
            });
        } else {
            console.log('📊 関連するJavaScript変数は見つかりませんでした');
        }
        
    } catch (error) {
        console.error('❌ ページネーション調査中にエラー:', error);
    } finally {
        await stockLogin.close();
    }
}

investigatePagination();
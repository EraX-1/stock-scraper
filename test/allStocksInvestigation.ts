import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function investigateAllStocksPage() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('📈 全Stocksページの調査を開始...');
        
        // ログイン処理
        await stockLogin.initialize();
        const loginSuccess = await stockLogin.login();
        
        if (!loginSuccess) {
            throw new Error('❌ ログインに失敗しました');
        }
        
        const page = stockLogin.getPage();
        if (!page) {
            throw new Error('❌ ページが取得できませんでした');
        }
        
        // 全Stocksページにアクセス
        const allStocksUrl = 'https://www.stock-app.jp/teams/c20282/dashboard/all/stocks';
        console.log('🔗 全Stocksページにアクセス:', allStocksUrl);
        await page.goto(allStocksUrl);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        console.log('📍 現在のURL:', page.url());
        const title = await page.title();
        console.log('📄 ページタイトル:', title);
        
        // Stockのリスト要素を調査
        console.log('📋 Stock一覧の構造を調査中...');
        
        // よくあるStock一覧のセレクターパターンをチェック
        const stockSelectors = [
            '.stock',
            '.stock-item',
            '.stock-list',
            '[class*="stock"]',
            '.item',
            '.list-item',
            '[class*="item"]',
            '.note',
            '[class*="note"]'
        ];
        
        for (const selector of stockSelectors) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`✅ 発見: ${selector} (${elements.length}件)`);
                    
                    // 最初の数件の内容を確認
                    const sampleCount = Math.min(3, elements.length);
                    for (let i = 0; i < sampleCount; i++) {
                        const text = await elements[i].textContent();
                        const className = await elements[i].getAttribute('class');
                        console.log(`  ${i + 1}. [${className}] ${text?.slice(0, 150)}...`);
                        
                        // リンクがあるかチェック
                        const link = await elements[i].$('a');
                        if (link) {
                            const href = await link.getAttribute('href');
                            console.log(`     リンク: ${href}`);
                        }
                    }
                }
            } catch (error) {
                // セレクターが見つからない場合は無視
            }
        }
        
        // 全てのリンクを再調査
        console.log('🔗 ページ内の全リンクを調査...');
        const allLinks = await page.$$eval('a', (elements) => 
            elements.map(el => ({
                text: el.textContent?.trim() || '',
                href: el.href || el.getAttribute('href') || '',
                className: el.className,
                id: el.id
            })).filter(link => link.href && link.text)
        );
        
        console.log(`🔗 発見されたリンク総数: ${allLinks.length}`);
        
        // Stock詳細ページっぽいリンクを特定
        const stockDetailLinks = allLinks.filter(link => 
            link.href.includes('/stock/') ||
            link.href.includes('/stocks/') ||
            link.href.includes('/note/') ||
            link.href.includes('/notes/') ||
            /\/\d+\/?$/.test(link.href) // 数字で終わるURL
        );
        
        console.log(`📈 Stock詳細と思われるリンク: ${stockDetailLinks.length}件`);
        stockDetailLinks.slice(0, 10).forEach((link, index) => {
            console.log(`${index + 1}. "${link.text}" → ${link.href}`);
            if (link.className) {
                console.log(`   クラス: ${link.className}`);
            }
        });
        
        // ページネーションがあるかチェック
        console.log('📖 ページネーションを調査...');
        const paginationSelectors = [
            '.pagination',
            '.pager',
            '[class*="page"]',
            '.next',
            '.prev',
            '.more'
        ];
        
        for (const selector of paginationSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    console.log(`📖 ページネーション発見: ${selector} - "${text}"`);
                }
            } catch (error) {
                // 見つからない場合は無視
            }
        }
        
        // 無限スクロールかチェック
        console.log('♾️ 無限スクロールをテスト...');
        const initialHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        
        if (newHeight > initialHeight) {
            console.log('♾️ 無限スクロールを確認！スクロールで追加コンテンツが読み込まれます');
        } else {
            console.log('📄 静的なページです（無限スクロールなし）');
        }
        
        console.log('✅ 全Stocksページ調査完了！');
        
    } catch (error) {
        console.error('❌ 調査中にエラーが発生:', error);
    } finally {
        await stockLogin.close();
    }
}

investigateAllStocksPage();
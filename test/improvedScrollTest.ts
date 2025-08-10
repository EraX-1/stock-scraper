import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function testImprovedScroll() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('🔍 改良版スクロールテストを開始...');
        
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
        
        console.log('📦 stockListContainerを確認...');
        const containerExists = await page.$('#stockListContainer');
        
        if (!containerExists) {
            console.log('❌ stockListContainerが見つかりません');
            return;
        }
        
        // 初期状態の要素数を確認
        let currentCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
        console.log(`📊 初期Stock数: ${currentCount}件`);
        
        // コンテナにフォーカス
        await page.focus('#stockListContainer');
        await page.waitForTimeout(500);
        
        // コンテナの位置を取得してマウスを移動
        const containerBounds = await page.$eval('#stockListContainer', (el) => {
            const rect = el.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight
            };
        });
        
        console.log('📐 コンテナ情報:', containerBounds);
        await page.mouse.move(containerBounds.x, containerBounds.y);
        
        // ステップ1: まず下方向にスクロールして、スクロール可能な位置に移動
        console.log('⬇️ ステップ1: 下方向にスクロール...');
        
        for (let i = 1; i <= 5; i++) {
            console.log(`⬇️ 下方向スクロール ${i}回目...`);
            
            // マウスホイールで下にスクロール
            await page.mouse.wheel(0, 300);
            await page.waitForTimeout(1000);
            
            // 現在のスクロール位置を確認
            const scrollInfo = await page.$eval('#stockListContainer', (el) => ({
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight
            }));
            
            console.log(`📍 スクロール位置: ${scrollInfo.scrollTop}px / ${scrollInfo.scrollHeight}px`);
            
            // 要素数の変化を確認
            const newCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
            if (newCount > currentCount) {
                console.log(`📈 下スクロールで要素追加！ ${currentCount} → ${newCount}件 (+${newCount - currentCount})`);
                currentCount = newCount;
            }
            
            // 十分スクロールしたらbreak
            if (scrollInfo.scrollTop > 500) break;
        }
        
        // ステップ2: 上方向にスクロールして追加読み込みをテスト
        console.log('⬆️ ステップ2: 上方向にスクロール...');
        
        for (let i = 1; i <= 10; i++) {
            console.log(`⬆️ 上方向スクロール ${i}回目...`);
            
            // マウスホイールで上にスクロール
            await page.mouse.wheel(0, -200);
            await page.waitForTimeout(1500);
            
            // 現在のスクロール位置を確認
            const scrollInfo = await page.$eval('#stockListContainer', (el) => ({
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight
            }));
            
            console.log(`📍 スクロール位置: ${scrollInfo.scrollTop}px`);
            
            // 要素数の変化を確認
            const newCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
            if (newCount > currentCount) {
                console.log(`🎉 上スクロールで要素追加成功！ ${currentCount} → ${newCount}件 (+${newCount - currentCount})`);
                
                // 新しく追加されたURLの一部を表示
                const newUrls = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => 
                    elements.slice(currentCount).slice(0, 3).map(el => el.getAttribute('href'))
                );
                console.log('🆕 新しく追加されたURL:');
                newUrls.forEach((url, index) => {
                    console.log(`  ${index + 1}. ${url}`);
                });
                
                currentCount = newCount;
                
                // さらに読み込める可能性があるので継続
                continue;
            }
            
            // 上端に到達した場合は停止
            if (scrollInfo.scrollTop <= 0) {
                console.log('📍 上端に到達しました');
                break;
            }
        }
        
        console.log(`📊 最終的なStock数: ${currentCount}件`);
        
        // デバッグ用: 最終的な状態を保存
        if (process.env.DEBUG === 'true') {
            await page.screenshot({ path: './debug_final_state.png', fullPage: true });
            console.log('📸 最終状態のスクリーンショットを保存: debug_final_state.png');
        }
        
    } catch (error) {
        console.error('❌ 改良版スクロールテスト中にエラー:', error);
    } finally {
        await stockLogin.close();
    }
}

testImprovedScroll();
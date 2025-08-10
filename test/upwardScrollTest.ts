import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function testUpwardScroll() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('🔍 stockListContainerでの上方向スクロールテストを開始...');
        
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
        
        // stockListContainerを探す
        console.log('📦 stockListContainerを探索中...');
        const containerExists = await page.$('#stockListContainer');
        
        if (!containerExists) {
            console.log('❌ stockListContainerが見つかりません');
            
            // 代替として他のコンテナを探す
            const altSelectors = [
                '[id*="stock"]',
                '[class*="stockList"]',
                '[class*="list"]',
                '.stocksContent'
            ];
            
            for (const selector of altSelectors) {
                const element = await page.$(selector);
                if (element) {
                    const id = await element.getAttribute('id');
                    const className = await element.getAttribute('class');
                    console.log(`🔍 発見: ${selector} (id: ${id}, class: ${className})`);
                }
            }
            
            return;
        }
        
        console.log('✅ stockListContainerを発見！');
        
        // 初期状態の要素数を確認
        let initialCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
        console.log(`📊 初期Stock数: ${initialCount}件`);
        
        // stockListContainerにフォーカス
        console.log('🎯 stockListContainerにフォーカス...');
        await page.focus('#stockListContainer');
        
        // マウスをstockListContainerの上に移動
        const containerBounds = await page.$eval('#stockListContainer', (el) => {
            const rect = el.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height
            };
        });
        
        console.log('📐 Container位置:', containerBounds);
        
        await page.mouse.move(containerBounds.x, containerBounds.y);
        await page.waitForTimeout(500);
        
        // 上方向にスクロール（マウスホイール）
        console.log('🔄 stockListContainer内で上方向にスクロール...');
        
        // まず現在のスクロール位置を確認
        const initialScrollTop = await page.$eval('#stockListContainer', (el) => el.scrollTop);
        console.log(`📍 初期スクロール位置: ${initialScrollTop}px`);
        
        // 上方向にスクロール（負の値で上方向）
        await page.mouse.wheel(0, -300);
        await page.waitForTimeout(1000);
        
        // スクロール後の位置を確認
        const afterScrollTop = await page.$eval('#stockListContainer', (el) => el.scrollTop);
        console.log(`📍 スクロール後の位置: ${afterScrollTop}px`);
        
        // 追加で要素が読み込まれるまで待機
        console.log('⏳ 追加読み込みを待機中...');
        await page.waitForTimeout(3000);
        
        // ネットワークアクティビティを待機
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (error) {
            console.log('⚠️ ネットワーク待機タイムアウト（続行）');
        }
        
        // 要素数の変化を確認
        let afterScrollCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
        console.log(`📊 スクロール後のStock数: ${afterScrollCount}件`);
        
        if (afterScrollCount > initialCount) {
            console.log(`🎉 追加読み込み成功！ +${afterScrollCount - initialCount}件 追加されました`);
            
            // 新しく追加された要素の一部を表示
            const newUrls = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => 
                elements.slice(initialCount).slice(0, 5).map(el => el.getAttribute('href'))
            );
            console.log('🆕 新しく追加されたURL（最初の5件）:');
            newUrls.forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
        } else {
            console.log('🤔 要素数に変化なし - 追加の上方向スクロールを試行...');
            
            // より大きなスクロール量で再試行
            await page.mouse.wheel(0, -500);
            await page.waitForTimeout(2000);
            
            // JavaScript直接実行でスクロール
            await page.$eval('#stockListContainer', (el) => {
                el.scrollTop = Math.max(0, el.scrollTop - 500);
            });
            await page.waitForTimeout(3000);
            
            // 再度確認
            const retryCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
            console.log(`📊 再試行後のStock数: ${retryCount}件`);
            
            if (retryCount > initialCount) {
                console.log(`🎉 再試行で成功！ +${retryCount - initialCount}件 追加されました`);
            } else {
                console.log('❌ 上方向スクロールでの追加読み込みを確認できませんでした');
            }
        }
        
        // 最終的なコンテナの状態を確認
        const finalContainerInfo = await page.$eval('#stockListContainer', (el) => ({
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            hasScrollbar: el.scrollHeight > el.clientHeight
        }));
        
        console.log('📊 最終的なコンテナ情報:', finalContainerInfo);
        
    } catch (error) {
        console.error('❌ 上方向スクロールテスト中にエラー:', error);
    } finally {
        await stockLogin.close();
    }
}

testUpwardScroll();
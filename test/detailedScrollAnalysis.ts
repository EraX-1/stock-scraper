import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function detailedScrollAnalysis() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('🔍 詳細スクロール分析を開始...');
        
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
        
        // ヘッドレスモードを無効にして、実際に画面を見ながら動作確認
        console.log('👀 ブラウザが非ヘッドレスモードで動作しています（DEBUG目的）');
        
        console.log('📦 stockListContainerの詳細情報を取得...');
        
        const containerInfo = await page.evaluate(() => {
            const container = document.getElementById('stockListContainer');
            if (!container) return null;
            
            const rect = container.getBoundingClientRect();
            const computedStyle = getComputedStyle(container);
            
            return {
                exists: true,
                scrollTop: container.scrollTop,
                scrollHeight: container.scrollHeight,
                clientHeight: container.clientHeight,
                offsetHeight: container.offsetHeight,
                scrollWidth: container.scrollWidth,
                clientWidth: container.clientWidth,
                bounds: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                },
                style: {
                    overflow: computedStyle.overflow,
                    overflowY: computedStyle.overflowY,
                    position: computedStyle.position,
                    display: computedStyle.display
                },
                innerHTML: container.innerHTML.length,
                childElementCount: container.childElementCount
            };
        });
        
        if (!containerInfo || !containerInfo.exists) {
            console.log('❌ stockListContainerが見つかりません');
            return;
        }
        
        console.log('📊 コンテナの詳細情報:');
        console.log(JSON.stringify(containerInfo, null, 2));
        
        // 初期要素数
        let stockCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
        console.log(`📊 初期Stock数: ${stockCount}件`);
        
        // スクロールイベントリスナーを追加してスクロール動作を監視
        await page.evaluate(() => {
            const container = document.getElementById('stockListContainer');
            if (container) {
                container.addEventListener('scroll', () => {
                    console.log(`Scroll event: scrollTop=${container.scrollTop}`);
                });
            }
        });
        
        console.log('🎯 コンテナにマウスを移動...');
        await page.mouse.move(containerInfo.bounds.left + containerInfo.bounds.width / 2, 
                            containerInfo.bounds.top + containerInfo.bounds.height / 2);
        await page.waitForTimeout(1000);
        
        // まず最上部へスクロール（既に上にある場合も含む）
        console.log('⬆️ 最上部へスクロール...');
        await page.$eval('#stockListContainer', (el) => {
            el.scrollTop = 0;
        });
        await page.waitForTimeout(1000);
        
        // 非常に小さな単位で上方向にスクロールを試行（より人間らしい動作）
        console.log('🔄 細かい上方向スクロールを試行...');
        
        for (let i = 1; i <= 10; i++) {
            console.log(`⬆️ 細かいスクロール ${i}回目...`);
            
            // より小さい値で上方向にスクロール
            await page.mouse.wheel(0, -50);
            await page.waitForTimeout(500);
            
            // JavaScriptでも直接スクロール
            await page.evaluate(() => {
                const container = document.getElementById('stockListContainer');
                if (container && container.scrollTop === 0) {
                    // 上端にいる場合、少し下に移動してから上にスクロール
                    container.scrollTop = 10;
                    setTimeout(() => {
                        container.scrollTop = 0;
                    }, 100);
                }
            });
            
            await page.waitForTimeout(1000);
            
            // ネットワークアクティビティを監視
            try {
                await page.waitForLoadState('networkidle', { timeout: 2000 });
            } catch (error) {
                // タイムアウトは正常
            }
            
            // 要素数の変化をチェック
            const newCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
            if (newCount > stockCount) {
                console.log(`🎉 上スクロール成功！ ${stockCount} → ${newCount}件 (+${newCount - stockCount})`);
                stockCount = newCount;
                
                // 成功したらさらに続行
                continue;
            }
            
            // 現在のスクロール位置をログ
            const scrollTop = await page.$eval('#stockListContainer', (el) => el.scrollTop);
            console.log(`📍 現在のスクロール位置: ${scrollTop}px`);
        }
        
        // 下方向スクロールでの追加読み込みも確認
        console.log('⬇️ 下方向スクロールでの追加読み込みもテスト...');
        
        for (let i = 1; i <= 10; i++) {
            console.log(`⬇️ 下方向スクロール ${i}回目...`);
            
            await page.mouse.wheel(0, 200);
            await page.waitForTimeout(1000);
            
            // 要素数の変化をチェック
            const newCount = await page.$$eval('a[href*="/stocks/"][href*="/edit"]', (elements) => elements.length);
            if (newCount > stockCount) {
                console.log(`🎉 下スクロール成功！ ${stockCount} → ${newCount}件 (+${newCount - stockCount})`);
                stockCount = newCount;
                continue;
            }
            
            // 下端に近づいているかチェック
            const scrollInfo = await page.$eval('#stockListContainer', (el) => ({
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                nearBottom: (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 100)
            }));
            
            console.log(`📍 スクロール: ${scrollInfo.scrollTop}px, 下端近く: ${scrollInfo.nearBottom}`);
            
            if (scrollInfo.nearBottom) {
                console.log('📍 下端に到達しました');
                break;
            }
        }
        
        console.log(`📊 最終的なStock数: ${stockCount}件`);
        
        // 長時間待機（手動でブラウザ操作を確認する時間）
        if (process.env.MANUAL_CHECK === 'true') {
            console.log('⏳ 手動確認のため30秒待機中...');
            await page.waitForTimeout(30000);
        }
        
    } catch (error) {
        console.error('❌ 詳細スクロール分析中にエラー:', error);
    } finally {
        await stockLogin.close();
    }
}

detailedScrollAnalysis();
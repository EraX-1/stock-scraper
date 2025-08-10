import { StockLogin } from './login.js';
import dotenv from 'dotenv';

dotenv.config();

async function investigatePage() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('🔍 ページ調査を開始します...');
        
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
        
        console.log('📍 現在のURL:', page.url());
        
        // ページタイトルを取得
        const title = await page.title();
        console.log('📄 ページタイトル:', title);
        
        // メインコンテンツエリアを探す
        console.log('🔍 メインコンテンツエリアを調査中...');
        
        // よくあるセレクターパターンをチェック
        const commonSelectors = [
            'main',
            '[role="main"]',
            '.main-content',
            '.content',
            '.dashboard',
            '.stocks',
            '.stock-list',
            'article',
            '.container'
        ];
        
        for (const selector of commonSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`✅ 発見: ${selector}`);
                    const text = await element.textContent();
                    if (text) {
                        console.log(`   内容の一部: ${text.slice(0, 100)}...`);
                    }
                }
            } catch (error) {
                // セレクターが見つからない場合は無視
            }
        }
        
        // ページが完全に読み込まれるのを待つ
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // 3秒待機
        
        // ページ全体のHTMLを一部取得してみる
        console.log('📋 ページのHTML構造を調査中...');
        const bodyContent = await page.$eval('body', el => el.innerHTML.slice(0, 1000));
        console.log('📋 Body内容（最初の1000文字）:');
        console.log(bodyContent);
        
        // すべての要素を調査
        console.log('🔍 全要素数を確認...');
        const elementCount = await page.$$eval('*', elements => elements.length);
        console.log(`📊 ページ内の要素数: ${elementCount}`);
        
        // リンクを調査（より詳細に）
        console.log('🔗 ページ内のリンクを調査中...');
        const allLinks = await page.$$eval('a', (elements) => 
            elements.map(el => ({
                text: el.textContent?.trim() || '',
                href: el.href || el.getAttribute('href') || '',
                className: el.className,
                id: el.id
            }))
        );
        
        console.log(`🔗 発見されたリンク総数: ${allLinks.length}`);
        
        const links = allLinks.filter(link => link.href).slice(0, 30);
        
        console.log('🔗 発見されたリンク:');
        links.forEach((link, index) => {
            console.log(`${index + 1}. "${link.text}" → ${link.href}`);
            if (link.className) {
                console.log(`   クラス: ${link.className}`);
            }
        });
        
        // Stock関連のキーワードを含むリンクを特定
        const stockLinks = links.filter(link => 
            link.text.toLowerCase().includes('stock') ||
            link.href.includes('stock') ||
            link.text.includes('銘柄') ||
            link.text.includes('株式') ||
            /\d{4}/.test(link.text) // 4桁の数字（証券コードの可能性）
        );
        
        if (stockLinks.length > 0) {
            console.log('📈 Stock関連のリンク:');
            stockLinks.forEach((link, index) => {
                console.log(`${index + 1}. "${link.text}" → ${link.href}`);
            });
        }
        
        // ナビゲーションメニューを調査
        console.log('🧭 ナビゲーションを調査中...');
        const navSelectors = ['nav', '.nav', '.navigation', '.menu', '.sidebar'];
        
        for (const selector of navSelectors) {
            try {
                const nav = await page.$(selector);
                if (nav) {
                    const navLinks = await nav.$$eval('a', (elements) =>
                        elements.map(el => ({
                            text: el.textContent?.trim() || '',
                            href: el.href
                        })).filter(link => link.text.length > 0)
                    );
                    
                    if (navLinks.length > 0) {
                        console.log(`🧭 ${selector} 内のリンク:`);
                        navLinks.forEach((link, index) => {
                            console.log(`  ${index + 1}. "${link.text}" → ${link.href}`);
                        });
                    }
                }
            } catch (error) {
                // ナビゲーションが見つからない場合は無視
            }
        }
        
        // ページのスクリーンショットを撮影（デバッグ用）
        if (process.env.DEBUG === 'true') {
            await page.screenshot({ path: './debug_page.png', fullPage: true });
            console.log('📸 スクリーンショットを保存しました: debug_page.png');
        }
        
        console.log('✅ ページ調査完了！');
        
    } catch (error) {
        console.error('❌ ページ調査中にエラーが発生:', error);
    } finally {
        await stockLogin.close();
    }
}

investigatePage();
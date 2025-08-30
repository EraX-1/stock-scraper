import { chromium, Browser, Page, BrowserContext } from 'playwright';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export class StockLogin {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private context: BrowserContext | null = null;
    private sessionDir: string = './session';

    /**
     * 🍪 セッションディレクトリを作成
     */
    private ensureSessionDir(): void {
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
            console.log('📁 セッションディレクトリを作成しました');
        }
    }

    /**
     * 💾 セッションを保存
     */
    private async saveSession(): Promise<void> {
        if (!this.context) return;
        
        this.ensureSessionDir();
        const sessionPath = path.join(this.sessionDir, 'session.json');
        
        // コンテキストの状態を保存
        await this.context.storageState({ path: sessionPath });
        console.log('💾 セッションを保存しました');
    }

    /**
     * 📥 セッションを読み込み
     */
    private async loadSession(): Promise<boolean> {
        const sessionPath = path.join(this.sessionDir, 'session.json');
        
        if (fs.existsSync(sessionPath)) {
            console.log('📥 既存セッションを発見しました');
            return true;
        }
        
        return false;
    }

    /**
     * 🚀 ブラウザを初期化
     */
    async initialize(): Promise<void> {
        console.log('🌐 ブラウザを起動中...');
        
        this.browser = await chromium.launch({
            headless: process.env.HEADLESS === 'true',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        // セッション読み込みを試行
        const hasSession = await this.loadSession();
        const sessionPath = path.join(this.sessionDir, 'session.json');
        
        if (hasSession) {
            console.log('🔄 セッションから復元中...');
            this.context = await this.browser.newContext({ storageState: sessionPath });
        } else {
            console.log('🆕 新規セッションを作成中...');
            this.context = await this.browser.newContext();
        }
        
        this.page = await this.context.newPage();
        console.log('✅ ブラウザ初期化完了！');
    }

    /**
     * 🔍 現在のログイン状態をチェック
     */
    async checkLoginStatus(): Promise<boolean> {
        if (!this.page) return false;
        
        try {
            const dashboardUrl = process.env.STOCK_URL!;
            console.log('🔍 ログイン状態を確認中...');
            
            await this.page.goto(dashboardUrl);
            await this.page.waitForLoadState('networkidle', { timeout: 5000 });
            
            const currentUrl = this.page.url();
            const isLoggedIn = currentUrl.includes('dashboard') && !currentUrl.includes('sign-in');
            
            if (isLoggedIn) {
                console.log('✅ セッションが有効です！ログインをスキップします');
                return true;
            } else {
                console.log('⚠️ セッションが無効です。ログインが必要です');
                return false;
            }
        } catch (error) {
            console.log('⚠️ ログイン状態確認に失敗。ログインを実行します');
            return false;
        }
    }

    /**
     * 🔑 ログイン処理を実行（セッション確認付き）
     */
    async login(): Promise<boolean> {
        if (!this.page) {
            throw new Error('❌ ブラウザが初期化されていません');
        }

        // セッションファイルの存在確認
        const sessionPath = path.join(this.sessionDir, 'session.json');
        if (fs.existsSync(sessionPath)) {
            console.log('🍪 保存されたセッションを発見！ログインをスキップします');
            
            // セッション有効性の簡単確認
            const isValid = await this.checkLoginStatus();
            if (isValid) {
                return true;
            } else {
                console.log('⚠️ セッションが無効でした。新規ログインを実行します');
            }
        } else {
            console.log('🆕 セッションが存在しません。新規ログインを実行します');
        }

        // 新規ログイン処理
        try {
            const loginUrl = process.env.STOCK_LOGIN_URL!;
            const email = process.env.STOCK_EMAIL;
            const password = process.env.STOCK_PASSWORD;

            // 認証情報のチェック
            if (!email || !password) {
                console.log('❌ Stock-app認証情報が不足しています:');
                console.log(`   STOCK_EMAIL: ${email ? '設定済み' : '未設定'}`);
                console.log(`   STOCK_PASSWORD: ${password ? '設定済み' : '未設定'}`);
                throw new Error('❌ ログインに必要な認証情報が不足しています');
            }

            console.log('🔗 ログインページにアクセス中...');
            await this.page.goto(loginUrl);

            console.log('📧 メールアドレスを入力中...');
            await this.page.fill('input[type="email"]', email);
            
            console.log('🔒 パスワードを入力中...');
            await this.page.fill('input[type="password"]', password);

            console.log('🖱️ ログインボタンをクリック中...');
            
            // モーダルダイアログがある場合は閉じる
            try {
                const modalSelector = 'div[role="dialog"].modal.show';
                const modal = await this.page.$(modalSelector);
                if (modal) {
                    console.log('⚠️ モーダルダイアログを検出、閉じています...');
                    // Escキーでモーダルを閉じる
                    await this.page.keyboard.press('Escape');
                    await this.page.waitForTimeout(1000);
                }
            } catch (e) {
                console.log('ℹ️ モーダルダイアログなし、続行します');
            }
            
            // ログインボタンをクリック
            await this.page.click('button[type="submit"]', { timeout: 5000 });

            console.log('⏳ リダイレクトを待機中...');
            await this.page.waitForURL(url => url.toString().includes('dashboard'), { timeout: 15000 });

            console.log('🎉 ログイン成功！');
            
            // セッションを保存
            await this.saveSession();
            
            return true;

        } catch (error) {
            console.error('❌ ログイン失敗:', error);
            return false;
        }
    }

    /**
     * 🧹 ブラウザを閉じる
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            console.log('🔚 ブラウザを終了しました');
        }
    }

    /**
     * 📄 現在のページを取得
     */
    getPage(): Page | null {
        return this.page;
    }

    /**
     * 🔄 ログイン状態を確認
     */
    async isLoggedIn(): Promise<boolean> {
        if (!this.page) return false;
        
        try {
            const currentUrl = this.page.url();
            const expectedUrl = process.env.STOCK_URL!;
            return currentUrl.includes(expectedUrl);
        } catch {
            return false;
        }
    }
}
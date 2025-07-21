import { Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

export class StockAuth {
  private cookiesPath = path.join(process.cwd(), 'cookies', 'stock-cookies.json');

  async login(page: Page, email: string, password: string): Promise<boolean> {
    try {
      console.log('ログイン処理を開始します...');
      
      await page.goto('https://www.stock-app.jp/sign-in', { 
        waitUntil: 'networkidle' 
      });

      // メールアドレス入力
      await page.fill('#signInEmail', email);
      
      // パスワード入力
      await page.fill('#signInPassword', password);
      
      // ログインボタンクリック
      await page.click('button.btn.midium.blue.panel__formBtn');
      
      // ダッシュボードへの遷移を待つ
      await page.waitForURL(/dashboard/, { timeout: 30000 });
      
      console.log('ログイン成功');
      
      // Cookieを保存
      await this.saveCookies(page);
      
      return true;
    } catch (error) {
      console.error('ログインエラー:', error);
      return false;
    }
  }

  async loadCookies(page: Page): Promise<boolean> {
    try {
      const cookiesData = await fs.readFile(this.cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      await page.context().addCookies(cookies);
      console.log('Cookieを読み込みました');
      return true;
    } catch (error) {
      console.log('Cookie読み込みスキップ（ファイルなし）');
      return false;
    }
  }

  async saveCookies(page: Page): Promise<void> {
    const cookies = await page.context().cookies();
    await fs.mkdir(path.dirname(this.cookiesPath), { recursive: true });
    await fs.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
    console.log('Cookieを保存しました');
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.goto('https://www.stock-app.jp', { waitUntil: 'networkidle' });
      const url = page.url();
      
      // ログインページにリダイレクトされていないかチェック
      if (url.includes('sign-in') || url.includes('signin') || url.includes('auth')) {
        return false;
      }
      
      // ダッシュボードにアクセスできるかチェック
      return url.includes('dashboard') || url.includes('teams');
    } catch (error) {
      return false;
    }
  }
}
import { chromium, Browser, Page } from 'playwright';
import { StockAuth } from '../auth/stockAuth';
import { DOMAnalyzer } from './domAnalyzer';
import { ScraperConfig, StockPost, DOMStructure } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class StockScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private auth: StockAuth;
  private analyzer: DOMAnalyzer;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.auth = new StockAuth();
    this.analyzer = new DOMAnalyzer();
  }

  async init(): Promise<void> {
    console.log('ブラウザを起動中...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      devtools: this.config.debug,
    });

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });

    this.page = await context.newPage();
    console.log('ブラウザ起動完了');
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('ブラウザが初期化されていません');

    // Cookieの読み込みを試行
    const cookieLoaded = await this.auth.loadCookies(this.page);

    if (cookieLoaded) {
      const loggedIn = await this.auth.isLoggedIn(this.page);
      if (loggedIn) {
        console.log('Cookie認証成功');
        return true;
      }
    }

    // 通常のログイン
    return await this.auth.login(this.page, this.config.email, this.config.password);
  }

  async analyzeSinglePage(url: string): Promise<DOMStructure> {
    if (!this.page) throw new Error('ブラウザが初期化されていません');

    return await this.analyzer.analyzeSinglePage(this.page, url);
  }

  async crawlPageList(baseUrl: string): Promise<string[]> {
    if (!this.page) throw new Error('ブラウザが初期化されていません');

    console.log('ページ一覧を取得中...');
    await this.page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Stock固有のリンクセレクタ
    const linkSelectors = ['a[href*="/stocks/"]', '.stock-list-item a', '.dashboard-item a'];

    const urls = new Set<string>();

    for (const selector of linkSelectors) {
      const links = await this.page.$$eval(selector, elements => elements.map(el => (el as HTMLAnchorElement).href));

      links.forEach(link => {
        if (link.includes('/stocks/') && !link.includes('#')) {
          urls.add(link);
        }
      });
    }

    const urlList = Array.from(urls);
    console.log(`${urlList.length}件のページを発見`);

    return urlList;
  }

  async scrapePages(urls: string[], domStructure?: DOMStructure): Promise<StockPost[]> {
    if (!this.page) throw new Error('ブラウザが初期化されていません');

    const results: StockPost[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[${i + 1}/${urls.length}] スクレイピング中: ${url}`);

      try {
        const data = await this.analyzer.extractData(this.page, url, domStructure);
        results.push(data);

        // レート制限対策
        await this.page.waitForTimeout(1000);
      } catch (error) {
        console.error(`エラー: ${url}`, error);
      }
    }

    return results;
  }

  async saveToJson(data: unknown, filename: string): Promise<void> {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });

    const filepath = path.join(dataDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));

    console.log(`データを保存しました: ${filepath}`);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('ブラウザを終了しました');
    }
  }
}

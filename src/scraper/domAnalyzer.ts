import { Page } from 'playwright';
import { DOMStructure, StockPost } from '../types';

export class DOMAnalyzer {
  // Stock固有のDOM構造定義
  private domStructure: DOMStructure = {
    titleSelector: '.dashboardBody__title, h1, h2',
    contentSelector: '.dashboardBody__content, .content, .body',
    authorSelector: '.author, .user-name, .created-by',
    timestampSelector: '.timestamp, .date, .created-at',
    tagsSelector: '.tag, .label'
  };

  async analyzeSinglePage(page: Page, url: string): Promise<DOMStructure> {
    console.log(`ページ構造を解析中: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // 各セレクタの存在確認と調整
    const updatedStructure = { ...this.domStructure };
    
    for (const [key, selector] of Object.entries(this.domStructure)) {
      const elements = await page.$$(selector);
      if (elements.length === 0) {
        console.log(`セレクタ "${selector}" が見つかりません`);
        
        // 代替セレクタを試す
        const alternatives = this.getAlternativeSelectors(key);
        for (const alt of alternatives) {
          const altElements = await page.$$(alt);
          if (altElements.length > 0) {
            updatedStructure[key as keyof DOMStructure] = alt;
            console.log(`代替セレクタ "${alt}" を使用します`);
            break;
          }
        }
      }
    }
    
    console.log('DOM構造解析完了:', updatedStructure);
    return updatedStructure;
  }

  async extractData(page: Page, url: string, structure?: DOMStructure): Promise<StockPost> {
    const dom = structure || this.domStructure;
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // URLからIDを抽出
    const urlParts = url.match(/teams\/([\w]+)\/dashboard\/([\d]+)\/stocks\/([\d]+)/);
    
    const data: StockPost = {
      url,
      title: await this.extractText(page, dom.titleSelector) || '無題',
      content: await this.extractText(page, dom.contentSelector) || '',
      author: await this.extractText(page, dom.authorSelector) || '不明',
      timestamp: await this.extractText(page, dom.timestampSelector) || new Date().toISOString(),
      teamId: urlParts?.[1],
      dashboardId: urlParts?.[2],
      stockId: urlParts?.[3]
    };
    
    // タグの抽出
    if (dom.tagsSelector) {
      data.tags = await this.extractTexts(page, dom.tagsSelector);
    }
    
    return data;
  }

  private async extractText(page: Page, selector: string): Promise<string | null> {
    try {
      return await page.textContent(selector);
    } catch {
      return null;
    }
  }

  private async extractTexts(page: Page, selector: string): Promise<string[]> {
    try {
      const elements = await page.$$(selector);
      const texts = await Promise.all(
        elements.map(el => el.textContent())
      );
      return texts.filter(text => text !== null) as string[];
    } catch {
      return [];
    }
  }

  private getAlternativeSelectors(key: string): string[] {
    const alternatives: Record<string, string[]> = {
      titleSelector: [
        '[data-testid="title"]',
        '.stock-title',
        '.post-title',
        'article h1'
      ],
      contentSelector: [
        '[data-testid="content"]',
        '.stock-content',
        '.post-body',
        'article .content'
      ],
      authorSelector: [
        '[data-testid="author"]',
        '.user-info',
        '.posted-by'
      ],
      timestampSelector: [
        '[data-testid="timestamp"]',
        '.post-date',
        'time'
      ],
      tagsSelector: [
        '[data-testid="tag"]',
        '.post-tags',
        '.labels'
      ]
    };
    
    return alternatives[key] || [];
  }
}
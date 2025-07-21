export interface StockPost {
  url: string;
  title: string;
  content: string;
  author: string;
  timestamp: string;
  tags?: string[];
  teamId?: string;
  dashboardId?: string;
  stockId?: string;
}

export interface DOMStructure {
  titleSelector: string;
  contentSelector: string;
  authorSelector: string;
  timestampSelector: string;
  tagsSelector?: string;
}

export interface ScraperConfig {
  email: string;
  password: string;
  headless: boolean;
  debug: boolean;
}
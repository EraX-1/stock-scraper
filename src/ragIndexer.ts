/**
 * RAG ChatBot API を使用してMHTMLファイルをインデックス化
 */

import { AzureBlobManager } from './storage/azureBlobManager.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface IndexRequest {
    content: string;
    metadata: {
        source: string;
        title: string;
        stockId?: string;
        url?: string;
        createdAt: string;
    };
}

interface IndexResponse {
    success: boolean;
    message?: string;
    indexedId?: string;
    error?: string;
}

interface RagIndexConfig {
    ragApiUrl?: string;
    batchSize?: number;
    delayMs?: number;
    retryAttempts?: number;
    timeoutMs?: number;
    useLocalFiles?: boolean;
    useBlobStorage?: boolean;
}

export class StockRagIndexer {
    private ragApiUrl: string;
    private blobManager: AzureBlobManager;
    private localMhtmlDir = './stock-mhtml';
    
    constructor(config: RagIndexConfig = {}) {
        this.ragApiUrl = config.ragApiUrl || 
            process.env.RAG_API_URL || 
            'https://yuyama-rag-chatbot-api-cmchguh0e8bjdqd6.japaneast-01.azurewebsites.net';
        
        this.blobManager = new AzureBlobManager('stock-mhtml');
    }
    
    /**
     * 🚀 Stock MHTMLファイルをRAG APIでインデックス化
     */
    async indexStockMhtmlFiles(config: RagIndexConfig = {}): Promise<{
        totalProcessed: number;
        successCount: number;
        errorCount: number;
        duration: number;
    }> {
        const startTime = Date.now();
        const {
            batchSize = 10,
            delayMs = 2000,
            retryAttempts = 3,
            timeoutMs = 30000,
            useLocalFiles = true,
            useBlobStorage = false
        } = config;
        
        console.log('🔍 Stock RAG インデックス化開始');
        console.log('='.repeat(60));
        console.log(`🎯 RAG API: ${this.ragApiUrl}/index`);
        console.log(`📦 バッチサイズ: ${batchSize}`);
        console.log(`⏱️ 待機時間: ${delayMs}ms`);
        
        let mhtmlFiles: string[] = [];
        
        try {
            // ファイル一覧を取得
            if (useLocalFiles) {
                mhtmlFiles = await this.getLocalMhtmlFiles();
                console.log(`📋 ローカルファイル数: ${mhtmlFiles.length}件`);
            }
            
            if (useBlobStorage) {
                const blobFiles = await this.getBlobMhtmlFiles();
                console.log(`☁️ Blobファイル数: ${blobFiles.length}件`);
                // TODO: Blobからファイル内容を取得する処理を実装
            }
            
            if (mhtmlFiles.length === 0) {
                console.log('⚠️ インデックス化するファイルがありません');
                return { totalProcessed: 0, successCount: 0, errorCount: 0, duration: 0 };
            }
            
            // バッチ処理でインデックス化
            let totalProcessed = 0;
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < mhtmlFiles.length; i += batchSize) {
                const batch = mhtmlFiles.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(mhtmlFiles.length / batchSize);
                
                console.log(`\n📦 バッチ ${batchNumber}/${totalBatches}: ${batch.length}ファイル処理中...`);
                
                // バッチ内の並列処理
                const batchPromises = batch.map(filePath => 
                    this.indexSingleFile(filePath, retryAttempts, timeoutMs)
                );
                
                const results = await Promise.allSettled(batchPromises);
                
                // 結果集計
                results.forEach((result, index) => {
                    const fileName = path.basename(batch[index]);
                    totalProcessed++;
                    
                    if (result.status === 'fulfilled' && result.value.success) {
                        successCount++;
                        console.log(`  ✅ ${fileName}: ${result.value.indexedId || '成功'}`);
                    } else {
                        errorCount++;
                        const error = result.status === 'fulfilled' 
                            ? result.value.error 
                            : result.reason;
                        console.log(`  ❌ ${fileName}: ${error}`);
                    }
                });
                
                // バッチ間の待機
                if (i + batchSize < mhtmlFiles.length) {
                    console.log(`⏳ ${delayMs}ms待機中...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // 最終結果表示
            console.log('\n🏁 RAG インデックス化完了！');
            console.log('='.repeat(60));
            console.log(`📊 総処理数: ${totalProcessed}件`);
            console.log(`✅ 成功: ${successCount}件`);
            console.log(`❌ エラー: ${errorCount}件`);
            console.log(`⏱️ 処理時間: ${Math.round(duration / 1000)}秒`);
            console.log(`📈 成功率: ${Math.round((successCount / totalProcessed) * 100)}%`);
            
            return { totalProcessed, successCount, errorCount, duration };
            
        } catch (error) {
            console.error('❌ インデックス化エラー:', error);
            throw error;
        }
    }
    
    /**
     * 📄 単一ファイルをRAG APIでインデックス化
     */
    private async indexSingleFile(
        filePath: string, 
        retryAttempts: number = 3, 
        timeoutMs: number = 30000
    ): Promise<IndexResponse> {
        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            try {
                // MHTMLファイルからテキストコンテンツを抽出
                const content = await this.extractTextFromMhtml(filePath);
                if (!content.trim()) {
                    return { success: false, error: 'ファイルが空またはテキスト抽出失敗' };
                }
                
                // メタデータを生成
                const metadata = this.generateMetadata(filePath);
                
                // RAG API リクエスト
                const indexRequest: IndexRequest = {
                    content: content,
                    metadata: metadata
                };
                
                const response = await this.callRagIndexApi(indexRequest, timeoutMs);
                
                if (response.success) {
                    return response;
                } else {
                    throw new Error(response.error || 'インデックス化失敗');
                }
                
            } catch (error) {
                if (attempt === retryAttempts) {
                    return {
                        success: false,
                        error: `${retryAttempts}回のリトライ後失敗: ${error instanceof Error ? error.message : error}`
                    };
                }
                
                console.log(`⚠️ ${path.basename(filePath)} (${attempt}回目失敗): ${error} - リトライ中...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        
        return { success: false, error: 'リトライ上限到達' };
    }
    
    /**
     * 🌐 RAG API /index エンドポイントを呼び出し
     */
    private async callRagIndexApi(request: IndexRequest, timeoutMs: number): Promise<IndexResponse> {
        const url = `${this.ragApiUrl}/index`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result as IndexResponse;
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    /**
     * 📝 MHTMLファイルからテキストコンテンツを抽出
     */
    private async extractTextFromMhtml(filePath: string): Promise<string> {
        try {
            const mhtmlContent = await fs.promises.readFile(filePath, 'utf-8');
            
            // MHTMLからHTMLコンテンツ部分を抽出
            const htmlContent = this.extractHtmlFromMhtml(mhtmlContent);
            
            // HTMLタグを除去してテキストのみ抽出
            const textContent = this.stripHtmlTags(htmlContent);
            
            return textContent;
        } catch (error) {
            throw new Error(`テキスト抽出失敗: ${error}`);
        }
    }
    
    /**
     * 🏷️ ファイルパスからメタデータを生成
     */
    private generateMetadata(filePath: string): IndexRequest['metadata'] {
        const fileName = path.basename(filePath, '.mhtml');
        const stockIdMatch = fileName.match(/^stock_(\d+)/);
        const stockId = stockIdMatch ? stockIdMatch[1] : '';
        
        return {
            source: 'stock-scraper',
            title: fileName,
            stockId: stockId,
            url: stockId ? `https://www.stock-app.jp/teams/c20282/dashboard/all/stocks/${stockId}/edit` : '',
            createdAt: new Date().toISOString()
        };
    }
    
    /**
     * 📂 ローカルMHTMLファイル一覧を取得
     */
    private async getLocalMhtmlFiles(): Promise<string[]> {
        const files: string[] = [];
        
        if (!fs.existsSync(this.localMhtmlDir)) {
            return files;
        }
        
        const items = await fs.promises.readdir(this.localMhtmlDir);
        
        for (const item of items) {
            const fullPath = path.join(this.localMhtmlDir, item);
            const stats = await fs.promises.stat(fullPath);
            
            if (stats.isFile() && item.endsWith('.mhtml')) {
                files.push(fullPath);
            }
        }
        
        return files;
    }
    
    /**
     * ☁️ Blob Storage MHTMLファイル一覧を取得
     */
    private async getBlobMhtmlFiles(): Promise<string[]> {
        try {
            const blobs = await this.blobManager.listBlobs('stock-mhtml/');
            return blobs.filter(blob => blob.endsWith('.mhtml'));
        } catch (error) {
            console.warn('Blob Storage ファイル一覧取得失敗:', error);
            return [];
        }
    }
    
    /**
     * 🔧 MHTMLからHTMLコンテンツを抽出
     */
    private extractHtmlFromMhtml(mhtmlContent: string): string {
        // MHTML形式から実際のHTMLコンテンツ部分を抽出
        const lines = mhtmlContent.split('\n');
        let htmlStartIndex = -1;
        
        // HTMLコンテンツの開始位置を探す
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Content-Type: text/html') || 
                lines[i].includes('<!DOCTYPE') || 
                lines[i].includes('<html')) {
                htmlStartIndex = i;
                break;
            }
        }
        
        if (htmlStartIndex === -1) {
            return mhtmlContent; // HTMLコンテンツが見つからない場合は全体を返す
        }
        
        return lines.slice(htmlStartIndex).join('\n');
    }
    
    /**
     * 🧹 HTMLタグを除去してテキストのみ抽出
     */
    private stripHtmlTags(html: string): string {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // スクリプト除去
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // スタイル除去
            .replace(/<[^>]*>/g, '') // HTMLタグ除去
            .replace(/&nbsp;/g, ' ') // HTML実体参照を置換
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ') // 連続する空白を単一に
            .trim();
    }
}

// メイン処理関数
async function main() {
    const args = process.argv.slice(2);
    
    // コマンドライン引数の解析
    const useBlob = args.includes('--blob');
    const useLocal = !args.includes('--no-local');
    const batchSize = parseInt(args.find(arg => arg.startsWith('--batch='))?.split('=')[1] || '10');
    
    const ragIndexer = new StockRagIndexer();
    
    try {
        console.log('⚙️  実行設定:');
        console.log(`   ├─ ローカルファイル: ${useLocal ? '有効' : '無効'}`);
        console.log(`   ├─ Blobファイル: ${useBlob ? '有効' : '無効'}`);
        console.log(`   └─ バッチサイズ: ${batchSize}`);
        console.log('');
        
        const result = await ragIndexer.indexStockMhtmlFiles({
            useLocalFiles: useLocal,
            useBlobStorage: useBlob,
            batchSize,
            delayMs: 2000,
            retryAttempts: 3,
            timeoutMs: 30000
        });
        
        console.log('\n🎉 RAG インデックス化が正常に完了しました！');
        
    } catch (error) {
        console.error('\n❌ RAG インデックス化中にエラーが発生しました:', error);
        process.exit(1);
    }
}

// このファイルが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
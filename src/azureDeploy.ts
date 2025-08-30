/**
 * Stock MHTML ファイルをAzure Blob Storageにデプロイ
 */

import { AzureBlobManager } from './storage/azureBlobManager.js';
import * as fs from 'fs';
import * as path from 'path';

interface DeployConfig {
    containerName?: string;
    concurrency?: number;
    dryRun?: boolean;
    overwrite?: boolean;
    timestampPrefix?: boolean;
}

export class StockAzureDeployManager {
    private blobManager: AzureBlobManager;
    private stockMhtmlDir = './stock-mhtml';
    
    constructor(config: DeployConfig = {}) {
        const {
            containerName = 'stock-mhtml',
            concurrency = 5
        } = config;
        
        this.blobManager = new AzureBlobManager(containerName);
    }
    
    /**
     * Stock MHTMLファイルをAzure Blob Storageにデプロイ
     */
    async deployStockMhtml(config: DeployConfig = {}): Promise<void> {
        const {
            dryRun = false,
            overwrite = true,
            timestampPrefix = false,
            concurrency = 5
        } = config;
        
        console.log('🚀 Stock MHTML Azure デプロイ開始');
        console.log('='.repeat(60));
        
        if (dryRun) {
            console.log('🔍 ドライランモード（実際のアップロードは行いません）');
        }
        
        try {
            // 1. ローカルディレクトリの確認
            if (!fs.existsSync(this.stockMhtmlDir)) {
                throw new Error(`❌ MHTMLディレクトリが見つかりません: ${this.stockMhtmlDir}`);
            }
            
            // 2. Azure接続テスト
            console.log('🔌 Azure Storage接続テスト中...');
            const connectionTest = await this.blobManager.testConnection();
            if (!connectionTest.success) {
                throw new Error(`❌ Azure Storage接続失敗: ${connectionTest.error}`);
            }
            
            // 3. コンテナー確認/作成
            if (!dryRun) {
                await this.blobManager.ensureContainer();
            }
            
            // 4. ローカルファイル一覧取得
            const localFiles = this.getLocalMhtmlFiles();
            console.log(`📋 ローカルMHTMLファイル数: ${localFiles.length}件`);
            
            if (localFiles.length === 0) {
                console.log('⚠️  アップロードするMHTMLファイルがありません');
                return;
            }
            
            // 5. ファイルサイズ統計
            const totalSize = this.calculateTotalSize(localFiles);
            console.log(`📏 総ファイルサイズ: ${this.formatFileSize(totalSize)}`);
            
            // 6. Blobプレフィックスを決定
            const blobPrefix = this.getBlobPrefix(timestampPrefix);
            console.log(`🎯 Azure Blob prefix: ${blobPrefix}`);
            
            if (dryRun) {
                console.log('\n📋 アップロード予定ファイル:');
                localFiles.forEach((file, index) => {
                    const relativePath = path.relative(this.stockMhtmlDir, file);
                    const blobName = `${blobPrefix}/${relativePath.replace(/\\/g, '/')}`;
                    const stats = fs.statSync(file);
                    console.log(`  ${(index + 1).toString().padStart(3, ' ')}. ${blobName} (${this.formatFileSize(stats.size)})`);
                });
                console.log('\n🔍 ドライラン完了（実際のアップロードは行われていません）');
                return;
            }
            
            // 7. 実際のアップロード
            console.log('\n📤 MHTMLファイルのアップロード開始...');
            const uploadResult = await this.blobManager.uploadDirectory(
                this.stockMhtmlDir,
                blobPrefix,
                {
                    concurrency,
                    overwrite,
                    preserveStructure: true
                }
            );
            
            // 8. 結果表示
            console.log('\n🎉 Stock MHTML デプロイ完了！');
            console.log('='.repeat(60));
            console.log(`✅ 成功: ${uploadResult.success}件`);
            console.log(`❌ 失敗: ${uploadResult.failed}件`);
            console.log(`📏 アップロード総サイズ: ${this.formatFileSize(uploadResult.totalSize)}`);
            
            if (uploadResult.failed > 0) {
                console.log('\n❌ 失敗したファイル:');
                uploadResult.results
                    .filter(r => !r.success)
                    .forEach(r => console.log(`  - ${r.blobName}: ${r.error}`));
            }
            
        } catch (error) {
            console.error('❌ デプロイエラー:', error);
            throw error;
        }
    }
    
    /**
     * デプロイされたStock MHTMLファイルの一覧を表示
     */
    async listDeployedFiles(prefix: string = ''): Promise<void> {
        console.log('📋 デプロイ済みStock MHTMLファイル一覧');
        console.log('='.repeat(60));
        
        try {
            const blobs = await this.blobManager.listBlobs(prefix);
            
            if (blobs.length === 0) {
                console.log('📭 デプロイされたファイルがありません');
                return;
            }
            
            console.log(`📊 見つかったファイル数: ${blobs.length}件`);
            
            // ファイル一覧をグループ化
            const grouped = this.groupBlobsByType(blobs);
            
            Object.entries(grouped).forEach(([type, files]) => {
                if (files.length > 0) {
                    console.log(`\n📁 ${type} (${files.length}件):`);
                    files.slice(0, 10).forEach((file, index) => {
                        console.log(`  ${(index + 1).toString().padStart(2, ' ')}. ${file}`);
                    });
                    if (files.length > 10) {
                        console.log(`  ... および他${files.length - 10}件`);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ ファイル一覧取得エラー:', error);
            throw error;
        }
    }
    
    /**
     * ローカルのMHTMLファイル一覧を取得
     */
    private getLocalMhtmlFiles(): string[] {
        const files: string[] = [];
        
        if (!fs.existsSync(this.stockMhtmlDir)) {
            return files;
        }
        
        const walkDir = (dir: string) => {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    walkDir(fullPath);
                } else if (item.endsWith('.mhtml')) {
                    files.push(fullPath);
                }
            }
        };
        
        walkDir(this.stockMhtmlDir);
        return files;
    }
    
    /**
     * ファイルサイズの合計を計算
     */
    private calculateTotalSize(files: string[]): number {
        return files.reduce((total, file) => {
            try {
                const stats = fs.statSync(file);
                return total + stats.size;
            } catch {
                return total;
            }
        }, 0);
    }
    
    /**
     * Blobプレフィックスを生成
     * qast-scraperと同様の構造で stock-mhtml/data/ ディレクトリに配置
     */
    private getBlobPrefix(timestampPrefix: boolean): string {
        if (timestampPrefix) {
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            return `stock-mhtml/data/${timestamp}`;
        }
        return 'stock-mhtml/data';
    }
    
    /**
     * Blobをタイプ別にグループ化
     */
    private groupBlobsByType(blobs: string[]): Record<string, string[]> {
        const groups: Record<string, string[]> = {
            'Stock MHTMLファイル': []
        };
        
        blobs.forEach(blob => {
            if (blob.endsWith('.mhtml')) {
                groups['Stock MHTMLファイル'].push(blob);
            }
        });
        
        return groups;
    }
    
    /**
     * ファイルサイズを人間が読みやすい形式に変換
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// メイン処理関数
async function main() {
    const args = process.argv.slice(2);
    
    // コマンドライン引数の解析
    const dryRun = args.includes('--dry-run');
    const listOnly = args.includes('--list');
    const timestampPrefix = args.includes('--timestamp');
    const overwrite = !args.includes('--no-overwrite');
    
    const deployManager = new StockAzureDeployManager({
        containerName: 'stock-mhtml',
        concurrency: 5
    });
    
    try {
        if (listOnly) {
            // ファイル一覧のみ表示
            await deployManager.listDeployedFiles();
        } else {
            // デプロイ実行
            await deployManager.deployStockMhtml({
                dryRun,
                overwrite,
                timestampPrefix,
                concurrency: 5
            });
        }
        
        console.log('\n🎉 処理が正常に完了しました！');
        
    } catch (error) {
        console.error('\n❌ 処理中にエラーが発生しました:', error);
        process.exit(1);
    }
}

// このファイルが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
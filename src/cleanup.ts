/**
 * クリーンアップユーティリティ
 * 一時ファイルやログファイルを削除
 */

import * as fs from 'fs';
import * as path from 'path';

export class Cleanup {
    private tempDirs = [
        './session',
        './stock-mhtml',
        './data',
        './logs'
    ];
    
    private tempFiles = [
        './stock-urls.txt'
    ];
    
    /**
     * 一時ファイルとディレクトリを削除
     */
    async cleanupAll(): Promise<void> {
        console.log('🧹 クリーンアップを開始します...');
        
        // 一時ファイルを削除
        for (const file of this.tempFiles) {
            await this.removeFile(file);
        }
        
        // 一時ディレクトリを削除
        for (const dir of this.tempDirs) {
            await this.removeDirectory(dir);
        }
        
        console.log('✅ クリーンアップが完了しました');
    }
    
    /**
     * セッションファイルのみを削除
     */
    async cleanupSessions(): Promise<void> {
        console.log('🍪 セッションファイルをクリーンアップします...');
        await this.removeDirectory('./session');
        console.log('✅ セッションクリーンアップが完了しました');
    }
    
    /**
     * MHTMLファイルのみを削除
     */
    async cleanupMhtml(): Promise<void> {
        console.log('📄 MHTMLファイルをクリーンアップします...');
        await this.removeDirectory('./stock-mhtml');
        console.log('✅ MHTMLクリーンアップが完了しました');
    }
    
    /**
     * ファイルを削除
     */
    private async removeFile(filePath: string): Promise<void> {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️  ファイルを削除: ${filePath}`);
            }
        } catch (error) {
            console.warn(`⚠️  ファイル削除失敗: ${filePath}`, error);
        }
    }
    
    /**
     * ディレクトリを削除
     */
    private async removeDirectory(dirPath: string): Promise<void> {
        try {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
                console.log(`🗂️  ディレクトリを削除: ${dirPath}`);
            }
        } catch (error) {
            console.warn(`⚠️  ディレクトリ削除失敗: ${dirPath}`, error);
        }
    }
    
    /**
     * 統計情報を表示
     */
    async showStats(): Promise<void> {
        console.log('📊 現在のファイル状況:');
        
        for (const file of this.tempFiles) {
            const exists = fs.existsSync(file);
            const size = exists ? fs.statSync(file).size : 0;
            console.log(`   ${exists ? '✅' : '❌'} ${file} (${size} bytes)`);
        }
        
        for (const dir of this.tempDirs) {
            const exists = fs.existsSync(dir);
            if (exists) {
                const files = this.getFileCount(dir);
                console.log(`   ✅ ${dir}/ (${files} files)`);
            } else {
                console.log(`   ❌ ${dir}/`);
            }
        }
    }
    
    /**
     * ディレクトリ内のファイル数を取得
     */
    private getFileCount(dirPath: string): number {
        try {
            const files = fs.readdirSync(dirPath, { recursive: true });
            return files.filter(file => {
                const fullPath = path.join(dirPath, file.toString());
                return fs.statSync(fullPath).isFile();
            }).length;
        } catch {
            return 0;
        }
    }
}

// CLI実行用
async function main() {
    const cleanup = new Cleanup();
    const args = process.argv.slice(2);
    
    if (args.includes('--stats')) {
        await cleanup.showStats();
    } else if (args.includes('--sessions')) {
        await cleanup.cleanupSessions();
    } else if (args.includes('--mhtml')) {
        await cleanup.cleanupMhtml();
    } else {
        await cleanup.cleanupAll();
    }
}

// このファイルが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
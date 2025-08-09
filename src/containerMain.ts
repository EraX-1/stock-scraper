import dotenv from 'dotenv';
import { StockLogin } from './login.js';

dotenv.config();

console.log('🚀 Stock Scraper Container Starting...');

async function main() {
    const stockLogin = new StockLogin();
    
    try {
        console.log('📊 Stock scraping process started');
        
        // 1. 🔑 ログイン処理
        console.log('🔐 ログイン処理を開始...');
        await stockLogin.initialize();
        
        const loginSuccess = await stockLogin.login();
        if (!loginSuccess) {
            throw new Error('❌ ログインに失敗しました');
        }
        
        // 2. 📈 スクレイピング処理  
        console.log('🕷️ スクレイピング処理を開始...');
        // TODO: 実際のスクレイピング処理を実装
        
        // 3. ☁️ Azure Storage アップロード
        console.log('☁️ Azure Storage アップロード処理を開始...');
        // TODO: Azure Storage アップロード処理を実装
        
        console.log('✅ Stock scraping process completed');
        
    } catch (error) {
        console.error('❌ Error in stock scraping:', error);
        process.exit(1);
    } finally {
        // 🧹 クリーンアップ
        await stockLogin.close();
    }
}

main();
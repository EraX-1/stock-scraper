import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

export interface UploadResult {
  success: boolean;
  blobName: string;
  url?: string;
  size?: number;
  error?: string;
}

export interface UploadProgress {
  fileName: string;
  uploaded: number;
  total: number;
  percentage: number;
}

export class AzureBlobManager {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;
  
  constructor(containerName: string = 'stock-mhtml') {
    this.containerName = containerName;
    
    // 環境変数から接続情報を取得
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const sasToken = process.env.AZURE_STORAGE_SAS_TOKEN;
    
    console.log('🔍 Azure Storage設定確認中...');
    
    if (connectionString) {
      console.log('📝 Connection String方式で接続中...');
      console.log(`📋 Connection String (最初の50文字): ${connectionString.substring(0, 50)}...`);
      
      // Connection String形式をチェック
      const isDevelopmentStorage = connectionString === 'UseDevelopmentStorage=true';
      const isValidFormat = connectionString.includes('DefaultEndpointsProtocol=') && 
                           connectionString.includes('AccountName=') &&
                           connectionString.includes('AccountKey=');
      
      if (!isDevelopmentStorage && !isValidFormat) {
        throw new Error(
          'Connection Stringのフォーマットが正しくありません。\n' +
          '開発用: UseDevelopmentStorage=true\n' +
          '本番用: DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=xxx;EndpointSuffix=core.windows.net'
        );
      }
      
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      } catch (error) {
        throw new Error(`Connection String解析エラー: ${error}\n設定値: ${connectionString}`);
      }
    } else if (accountName && accountKey) {
      console.log('🔑 Account Name + Key方式で接続中...');
      console.log(`📋 Account Name: ${accountName}`);
      console.log(`📋 Account Key (最初の10文字): ${accountKey.substring(0, 10)}...`);
      
      const credential = {
        accountName,
        accountKey
      };
      this.blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential as any
      );
    } else if (accountName && sasToken) {
      console.log('🎫 SAS Token方式で接続中...');
      console.log(`📋 Account Name: ${accountName}`);
      console.log(`📋 SAS Token (最初の20文字): ${sasToken.substring(0, 20)}...`);
      
      this.blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net?${sasToken}`
      );
    } else {
      console.log('❌ Azure Storage設定が見つかりません');
      console.log('📋 現在の環境変数:');
      console.log(`   AZURE_STORAGE_CONNECTION_STRING: ${connectionString ? 'あり' : 'なし'}`);
      console.log(`   AZURE_STORAGE_ACCOUNT_NAME: ${accountName || 'なし'}`);
      console.log(`   AZURE_STORAGE_ACCOUNT_KEY: ${accountKey ? 'あり' : 'なし'}`);
      console.log(`   AZURE_STORAGE_SAS_TOKEN: ${sasToken ? 'あり' : 'なし'}`);
      
      throw new Error(
        'Azure Storage接続情報が不足しています。以下のいずれかを.envファイルに設定してください:\n' +
        '1. AZURE_STORAGE_CONNECTION_STRING\n' +
        '2. AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY\n' +
        '3. AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_SAS_TOKEN'
      );
    }
  }
  
  /**
   * コンテナーが存在することを確認、なければ作成
   */
  async ensureContainer(): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // コンテナーの存在確認
      const exists = await containerClient.exists();
      
      if (!exists) {
        console.log(`📦 Azure Blobコンテナー '${this.containerName}' を作成中...`);
        // パブリックアクセスが無効なストレージアカウントではアクセスレベルを指定しない
        await containerClient.create();
        console.log(`✅ コンテナー '${this.containerName}' を作成しました`);
      } else {
        console.log(`✅ コンテナー '${this.containerName}' が確認できました`);
      }
    } catch (error) {
      throw new Error(`コンテナーの確認/作成に失敗: ${error}`);
    }
  }
  
  /**
   * ディレクトリを再帰的にAzure Blob Storageにアップロード
   */
  async uploadDirectory(
    localDirPath: string,
    blobPrefix: string = '',
    options: {
      concurrency?: number;
      overwrite?: boolean;
      preserveStructure?: boolean;
    } = {}
  ): Promise<{
    success: number;
    failed: number;
    skipped: number;
    totalSize: number;
    results: UploadResult[];
  }> {
    const { concurrency = 5, overwrite = true, preserveStructure = true } = options;
    
    console.log(`📁 ディレクトリアップロード開始: ${localDirPath}`);
    console.log(`🎯 Azure Blob prefix: ${blobPrefix || '(root)'}`);
    console.log(`⚡ 並列数: ${concurrency}`);
    
    // ディレクトリ内のすべてのファイルを取得
    const files = await this.getAllFiles(localDirPath);
    console.log(`📋 見つかったファイル数: ${files.length}件`);
    
    if (files.length === 0) {
      console.log('⚠️  アップロードするファイルがありません');
      return { success: 0, failed: 0, skipped: 0, totalSize: 0, results: [] };
    }
    
    // 並列アップロード処理
    const results: UploadResult[] = [];
    let totalSize = 0;
    
    // バッチ処理で並列数を制限
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(files.length / concurrency);
      
      console.log(`\n📦 バッチ ${batchNumber}/${totalBatches}: ${batch.length}ファイル`);
      
      const batchPromises = batch.map(async (filePath) => {
        // 相対パスを計算
        const relativePath = path.relative(localDirPath, filePath);
        
        // Blob名を生成
        let blobName: string;
        if (preserveStructure) {
          // ディレクトリ構造を保持
          blobName = blobPrefix ? 
            `${blobPrefix}/${relativePath.replace(/\\/g, '/')}` : 
            relativePath.replace(/\\/g, '/');
        } else {
          // ファイル名のみ
          blobName = blobPrefix ? 
            `${blobPrefix}/${path.basename(filePath)}` : 
            path.basename(filePath);
        }
        
        return this.uploadFile(filePath, blobName, overwrite);
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // バッチ結果を処理
      batchResults.forEach((result, index) => {
        const filePath = batch[index];
        const fileName = path.basename(filePath);
        
        if (result.status === 'fulfilled') {
          const uploadResult = result.value;
          results.push(uploadResult);
          
          if (uploadResult.success) {
            if (uploadResult.size) totalSize += uploadResult.size;
            console.log(`  ✅ ${fileName} (${this.formatFileSize(uploadResult.size || 0)})`);
          } else {
            console.log(`  ❌ ${fileName}: ${uploadResult.error}`);
          }
        } else {
          results.push({
            success: false,
            blobName: path.basename(filePath),
            error: result.reason?.toString() || 'Unknown error'
          });
          console.log(`  💥 ${fileName}: ${result.reason}`);
        }
      });
      
      // バッチ間の待機時間
      if (i + concurrency < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 結果集計
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = 0; // 現在の実装ではスキップなし
    
    console.log(`\n📊 アップロード完了:`);
    console.log(`   ✅ 成功: ${success}件`);
    console.log(`   ❌ 失敗: ${failed}件`);
    console.log(`   📏 総サイズ: ${this.formatFileSize(totalSize)}`);
    
    return { success, failed, skipped, totalSize, results };
  }
  
  /**
   * ディレクトリ内のすべてのファイルを再帰的に取得
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`ディレクトリ読み取りエラー (${dirPath}):`, error);
    }
    
    return files;
  }

  /**
   * 単一ファイルをAzure Blob Storageにアップロード
   */
  async uploadFile(
    filePath: string, 
    blobName?: string,
    overwrite: boolean = true
  ): Promise<UploadResult> {
    try {
      // ファイル存在確認
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Blob名を生成（指定がない場合はファイル名を使用）
      const finalBlobName = blobName || path.basename(filePath);
      
      // コンテナークライアントを取得
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(finalBlobName);
      
      // 既存ファイルの確認
      if (!overwrite && await blockBlobClient.exists()) {
        return {
          success: false,
          blobName: finalBlobName,
          error: 'ファイルが既に存在します（上書きが無効）'
        };
      }
      
      // ファイルをアップロード
      await blockBlobClient.uploadFile(filePath);
      
      return {
        success: true,
        blobName: finalBlobName,
        url: blockBlobClient.url,
        size: fileSize
      };
      
    } catch (error) {
      return {
        success: false,
        blobName: blobName || path.basename(filePath),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Blobの一覧を取得
   */
  async listBlobs(prefix?: string): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobs: string[] = [];
      
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        blobs.push(blob.name);
      }
      
      return blobs;
    } catch (error) {
      throw new Error(`Blob一覧取得エラー: ${error}`);
    }
  }
  
  /**
   * Blobを削除
   */
  async deleteBlob(blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.delete();
      console.log(`🗑️  削除完了: ${blobName}`);
      return true;
    } catch (error) {
      console.error(`❌ 削除エラー: ${error}`);
      return false;
    }
  }
  
  /**
   * Blobの存在確認
   */
  async blobExists(blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      return await blockBlobClient.exists();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 接続テスト
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // サービスプロパティを取得してテスト
      await this.blobServiceClient.getProperties();
      console.log('✅ Azure Blob Storage接続テスト成功');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Azure Blob Storage接続テスト失敗:', errorMessage);
      return { success: false, error: errorMessage };
    }
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

// テスト用の関数
export async function testAzureBlobUpload() {
  console.log('🧪 Azure Blob Storage テスト開始...');
  console.log('='.repeat(50));
  
  try {
    const blobManager = new AzureBlobManager('stock-test');
    
    // 1. 接続テスト
    console.log('1️⃣ 接続テスト中...');
    const connectionTest = await blobManager.testConnection();
    if (!connectionTest.success) {
      throw new Error(`接続失敗: ${connectionTest.error}`);
    }
    
    // 2. コンテナー確認
    console.log('\n2️⃣ コンテナー確認中...');
    await blobManager.ensureContainer();
    
    console.log('\n✅ 全テスト完了！Azure Blob Storageの設定は正常です。');
    
  } catch (error) {
    console.error('\n❌ テスト失敗:', error);
    console.error('\n💡 確認事項:');
    console.error('   - .envファイルのAzure Storage設定');
    console.error('   - ネットワーク接続');
    console.error('   - Azure Storage アカウントの権限');
  }
}

// CLIから直接実行された場合のテスト
if (import.meta.url === `file://${process.argv[1]}`) {
  testAzureBlobUpload().catch(console.error);
}
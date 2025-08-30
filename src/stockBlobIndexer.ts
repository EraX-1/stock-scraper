import { AzureBlobManager } from './storage/azureBlobManager.js';
import FormData from 'form-data';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

export interface IndexingResult {
  success: boolean;
  blobName: string;
  error?: string;
  statusCode?: number;
}

export class StockBlobIndexer {
  private blobManager: AzureBlobManager;
  private indexEndpoint: string;
  private consecutiveTimeouts: number = 0;
  private readonly MAX_CONSECUTIVE_TIMEOUTS = 10;
  
  constructor(
    containerName: string = 'stock-mhtml',
    indexEndpoint: string = 'https://yuyama-rag-chatbot-api-cus.azurewebsites.net/reindex-from-blob'
  ) {
    this.blobManager = new AzureBlobManager(containerName);
    this.indexEndpoint = indexEndpoint;
  }

  /**
   * Blobから単一MHTMLファイルをダウンロード
   */
  async downloadBlob(blobName: string): Promise<Buffer> {
    try {
      const containerClient = this.blobManager['blobServiceClient'].getContainerClient(this.blobManager['containerName']);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      const downloadResponse = await blockBlobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('ダウンロードストリームが取得できません');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Blobダウンロードエラー (${blobName}): ${error}`);
    }
  }

  /**
   * MHTMLファイルを/reindex-from-blobエンドポイントに送信（タイムアウト・リトライ付き）
   */
  async indexMhtmlFile(blobName: string, fileBuffer: Buffer, sourceUrl?: string, timeoutMs: number = 30000, maxRetries: number = 3): Promise<IndexingResult> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 インデックス送信開始: ${blobName} (試行 ${attempt}/${maxRetries})`);
        
        // Blob URLを生成
        const blobUrl = this.generateBlobUrl(blobName);
        
        // FormDataを作成
        const formData = new FormData();
        formData.append('file', fileBuffer, {
          filename: blobName,
          contentType: 'application/octet-stream'
        });
        formData.append('index_type', 'stock');
        formData.append('blob_url', blobUrl);
        
        if (sourceUrl) {
          formData.append('source_url', sourceUrl);
        }

        // デバッグ情報を表示（初回のみ）
        if (attempt === 1) {
          console.log(`🔍 送信データ詳細: ${blobName}`);
          console.log(`   ├─ エンドポイント: ${this.indexEndpoint}`);
          console.log(`   ├─ index_type: stock`);
          console.log(`   ├─ blob_url: ${blobUrl}`);
          console.log(`   ├─ source_url: ${sourceUrl || 'なし'}`);
          console.log(`   ├─ ファイルサイズ: ${Math.round(fileBuffer.length / 1024)}KB`);
          console.log(`   └─ タイムアウト: ${timeoutMs}ms`);
        }

        const startTime = Date.now();
        
        // タイムアウト機能付きFetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`⏰ タイムアウト発生: ${blobName} (${timeoutMs}ms) - 試行 ${attempt}/${maxRetries}`);
          controller.abort();
        }, timeoutMs);
        
        try {
          // APIに送信
          const response = await fetch(this.indexEndpoint, {
            method: 'POST',
            body: formData,
            headers: {
              ...formData.getHeaders()
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          console.log(`⏱️ API応答時間: ${duration}ms`);

          // レスポンスヘッダー表示（初回のみ）
          if (attempt === 1) {
            console.log(`📤 レスポンスヘッダー:`);
            response.headers.forEach((value, key) => {
              console.log(`   ${key}: ${value}`);
            });
          }

          if (response.ok) {
            let responseData;
            try {
              const responseText = await response.text();
              console.log(`📄 レスポンスボディ: ${responseText}`);
              
              // JSONパースを試行
              try {
                responseData = JSON.parse(responseText);
                console.log(`📊 パース済みレスポンス:`, JSON.stringify(responseData, null, 2));
              } catch {
                responseData = responseText;
              }
            } catch (error) {
              console.log(`⚠️ レスポンス読み取りエラー: ${error}`);
            }

            console.log(`✅ インデックス送信成功: ${blobName} (${response.status}) - ${duration}ms`);
            this.consecutiveTimeouts = 0; // 成功時はタイムアウトカウントをリセット
            return {
              success: true,
              blobName,
              statusCode: response.status
            };
          } else {
            let errorText;
            try {
              errorText = await response.text();
              console.log(`📄 エラーレスポンスボディ: ${errorText}`);
              
              // JSONエラーレスポンスをパースして詳細表示
              try {
                const errorData = JSON.parse(errorText);
                console.log(`📊 パース済みエラー:`, JSON.stringify(errorData, null, 2));
              } catch {
                // JSON以外のエラーレスポンス
              }
            } catch (error) {
              errorText = `レスポンス読み取り失敗: ${error}`;
              console.log(`⚠️ ${errorText}`);
            }

            console.log(`❌ インデックス送信失敗: ${blobName} (${response.status}) - ${duration}ms: ${errorText}`);
            
            // HTTPエラーの場合はリトライしない
            return {
              success: false,
              blobName,
              statusCode: response.status,
              error: `HTTP ${response.status}: ${errorText}`
            };
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            // タイムアウトの場合
            this.consecutiveTimeouts++;
            console.log(`⏰ タイムアウト発生 (連続${this.consecutiveTimeouts}回): ${blobName} - 試行 ${attempt}/${maxRetries}`);
            
            // 連続タイムアウト上限チェック
            if (this.consecutiveTimeouts >= this.MAX_CONSECUTIVE_TIMEOUTS) {
              console.error(`🚨 連続タイムアウト上限到達 (${this.MAX_CONSECUTIVE_TIMEOUTS}回) - 処理を強制終了します`);
              process.exit(1);
            }
            
            if (attempt < maxRetries) {
              console.log(`🔄 ${2000 * attempt}ms後にリトライします...`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue; // リトライ
            }
          } else {
            // その他のネットワークエラー
            console.error(`🌐 ネットワークエラー: ${blobName} - ${fetchError instanceof Error ? fetchError.message : fetchError}`);
            if (attempt < maxRetries) {
              console.log(`🔄 ${1000 * attempt}ms後にリトライします...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue; // リトライ
            }
          }
        }
      } catch (error) {
        console.error(`💥 インデックス送信エラー: ${blobName} (試行 ${attempt}/${maxRetries}):`);
        console.error(`   エラータイプ: ${error instanceof Error ? error.constructor.name : typeof error}`);
        console.error(`   エラーメッセージ: ${error instanceof Error ? error.message : error}`);
        
        if (attempt < maxRetries) {
          console.log(`🔄 ${1000 * attempt}ms後にリトライします...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue; // リトライ
        }
      }
    }
    
    // 全てのリトライが失敗した場合
    return {
      success: false,
      blobName,
      error: `${maxRetries}回のリトライ後も失敗`
    };
  }

  /**
   * 全MHTMLファイルをBlobから取得してインデックス送信
   */
  async indexAllMhtmlFiles(options: {
    blobPrefix?: string;
    concurrency?: number;
    dryRun?: boolean;
    delayMs?: number;
  } = {}): Promise<{
    total: number;
    success: number;
    failed: number;
    results: IndexingResult[];
  }> {
    const {
      blobPrefix = 'stock-mhtml',
      concurrency = 3,
      dryRun = false,
      delayMs = 500
    } = options;

    console.log('🔍 Azure Blob Stock MHTMLインデックス処理開始...');
    console.log('='.repeat(60));
    console.log(`📁 Blobプレフィックス: ${blobPrefix}`);
    console.log(`📡 インデックスエンドポイント: ${this.indexEndpoint}`);
    console.log(`⚡ 並列数: ${concurrency}`);
    console.log(`⏱️ API間隔: ${delayMs}ms`);
    console.log(`🔄 最大連続タイムアウト: ${this.MAX_CONSECUTIVE_TIMEOUTS}回`);
    if (dryRun) console.log('🔍 ドライランモード（実際の送信なし）');

    try {
      // 1. 接続テスト
      console.log('\n1️⃣ Azure Storage接続確認中...');
      if (!dryRun) {
        const connectionTest = await this.blobManager.testConnection();
        if (!connectionTest.success) {
          throw new Error(`Azure Storage接続失敗: ${connectionTest.error}`);
        }
      }

      // 2. MHTML Blobの一覧取得
      console.log('\n2️⃣ Stock MHTML Blob一覧取得中...');
      const allBlobs = await this.blobManager.listBlobs(blobPrefix);
      const mhtmlBlobs = allBlobs.filter(blob => blob.endsWith('.mhtml'));
      
      console.log(`📋 見つかったMHTMLファイル: ${mhtmlBlobs.length}件`);
      
      if (mhtmlBlobs.length === 0) {
        console.log('⚠️  インデックス対象のMHTMLファイルがありません');
        return { total: 0, success: 0, failed: 0, results: [] };
      }

      if (dryRun) {
        console.log('\n🔍 ドライラン - 見つかったファイル:');
        mhtmlBlobs.forEach((blob, index) => {
          console.log(`  ${index + 1}. ${blob}`);
        });
        console.log('\n🔍 ドライラン完了: 実際の送信は実行されませんでした');
        return { total: mhtmlBlobs.length, success: 0, failed: 0, results: [] };
      }

      // 3. 並列処理でインデックス送信
      console.log('\n3️⃣ インデックス送信開始...');
      const results: IndexingResult[] = [];
      
      for (let i = 0; i < mhtmlBlobs.length; i += concurrency) {
        const batch = mhtmlBlobs.slice(i, i + concurrency);
        const batchNumber = Math.floor(i / concurrency) + 1;
        const totalBatches = Math.ceil(mhtmlBlobs.length / concurrency);
        
        console.log(`\n📦 バッチ ${batchNumber}/${totalBatches}: ${batch.length}ファイル`);
        
        const batchPromises = batch.map(async (blobName, index) => {
          try {
            // API間隔のための待機時間（バッチ内での順次処理）
            if (index > 0) {
              console.log(`⏳ API間隔待機: ${delayMs}ms (${blobName})`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            
            // ファイルをダウンロード
            console.log(`📥 Blobダウンロード開始: ${blobName}`);
            const downloadStart = Date.now();
            const fileBuffer = await this.downloadBlob(blobName);
            const downloadDuration = Date.now() - downloadStart;
            console.log(`📥 Blobダウンロード完了: ${blobName} (${downloadDuration}ms, ${Math.round(fileBuffer.length / 1024)}KB)`);
            
            // sourceUrlを推測（Blobパスから）
            const sourceUrl = this.extractSourceUrl(blobName);
            
            // インデックス送信（タイムアウト・リトライ付き）
            return await this.indexMhtmlFile(blobName, fileBuffer, sourceUrl);
          } catch (error) {
            return {
              success: false,
              blobName,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          const blobName = batch[index];
          
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              blobName,
              error: result.reason?.toString() || 'Unknown error'
            });
          }
        });
        
        // バッチ間の待機時間
        if (i + concurrency < mhtmlBlobs.length) {
          const batchDelayMs = 500;
          console.log(`⏳ バッチ間待機: ${batchDelayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, batchDelayMs));
        }
      }

      // 4. 結果レポート
      const total = results.length;
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log('\n📊 Stock インデックス処理完了');
      console.log('='.repeat(60));
      console.log(`📈 総ファイル数: ${total}`);
      console.log(`✅ 成功: ${success}件`);
      console.log(`❌ 失敗: ${failed}件`);
      console.log(`⏰ 総タイムアウト回数: ${this.consecutiveTimeouts}回`);
      
      if (failed > 0) {
        console.log('\n🚨 失敗したファイル:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`  - ${result.blobName}: ${result.error}`);
        });
      }

      return { total, success, failed, results };

    } catch (error) {
      console.error('❌ Stock インデックス処理に失敗しました:', error);
      throw error;
    }
  }

  /**
   * BlobパスからソースURLを推測（Stock用）
   */
  private extractSourceUrl(blobName: string): string | undefined {
    // 例: stock-mhtml/stock_12345.mhtml -> stock ID: 12345
    // Stock アプリケーションの URL パターンに合わせて調整
    
    const match = blobName.match(/stock-mhtml\/stock_(\d+)\.mhtml$/);
    if (match) {
      const stockId = match[1];
      // Stock アプリケーションの実際のURLフォーマットに合わせて調整
      return `https://www.stock-app.jp/teams/c20282/dashboard/all/stocks/${stockId}/edit`;
    }
    
    return undefined;
  }

  /**
   * Blob名からAzure Blob StorageのURLを生成
   */
  private generateBlobUrl(blobName: string): string {
    // Azure Storage アカウント名を環境変数または設定から取得
    const storageAccount = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'yuyamablobstorage';
    const containerName = this.blobManager['containerName'];
    
    // Azure Blob Storage URL形式: https://{account}.blob.core.windows.net/{container}/{blob}
    return `https://${storageAccount}.blob.core.windows.net/${containerName}/${blobName}`;
  }
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexer = new StockBlobIndexer();
  
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const concurrency = args.includes('--concurrency') ? 
    parseInt(args[args.indexOf('--concurrency') + 1]) || 3 : 3;
  const delayMs = args.includes('--delay') ? 
    parseInt(args[args.indexOf('--delay') + 1]) || 500 : 500;
  
  console.log('⚙️  実行設定:');
  console.log(`   ├─ ドライラン: ${dryRun ? '有効' : '無効'}`);
  console.log(`   ├─ 並列数: ${concurrency}`);
  console.log(`   └─ API間隔: ${delayMs}ms`);
  console.log('');
  
  indexer.indexAllMhtmlFiles({
    dryRun,
    concurrency,
    delayMs
  }).then(() => {
    console.log('\n🎉 Stock Blob インデックス処理が完了しました！');
  }).catch(error => {
    console.error('\n❌ Stock Blob インデックス処理中にエラーが発生しました:', error);
    process.exit(1);
  });
}
// ============================================
// BullMQ Ingestion Worker
// ============================================

import { Queue, Worker, Job } from 'bullmq';
import { createClient } from 'redis';
import { config } from '../config/index.js';
import { query } from '../db/client.js';
import { downloadFromS3 } from '../services/storage.js';
import { crawlWebsite, extractPDF, extractDOCX, extractTXT, chunkText, transcribeAudio } from '../services/ingestion/pipeline.js';
import { getEmbeddingProvider } from '../services/ai/providerFactory.js';
import { logger } from '../utils/logger.js';

// Redis connection options for BullMQ
const redisUrl = new URL(config.redis.url);
const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
};

let ingestionQueue: Queue;

export function getIngestionQueue(): Queue {
  if (!ingestionQueue) {
    ingestionQueue = new Queue('ingestion', { connection: redisConnection });
  }
  return ingestionQueue;
}

interface IngestionJobData {
  sourceId: string;
  tenantId: string;
  type: string;
  url?: string;
  storagePath?: string;
  originalName?: string;
  config?: { crawl_depth?: number; page_limit?: number };
}

/**
 * Start the ingestion worker
 */
export function startIngestionWorker() {
  const worker = new Worker<IngestionJobData>(
    'ingestion',
    async (job: Job<IngestionJobData>) => {
      const { sourceId, tenantId, type, url, storagePath, config: sourceConfig } = job.data;

      logger.info(`Processing ingestion job: ${sourceId}`, { type, tenantId });

      // Update status to processing
      await query(
        `UPDATE sources SET status = 'processing' WHERE id = $1`,
        [sourceId]
      );

      try {
        let rawText = '';
        let pages: { text: string; meta: Record<string, unknown> }[] = [];

        // 1. Extract text based on source type
        switch (type) {
          case 'website': {
            const crawlResults = await crawlWebsite(url!, {
              crawlDepth: sourceConfig?.crawl_depth || 3,
              pageLimit: sourceConfig?.page_limit || 50,
            });

            pages = crawlResults.map(r => ({
              text: r.text,
              meta: { source_url: r.url, heading: r.title },
            }));

            await query(
              'UPDATE sources SET pages_crawled = $1 WHERE id = $2',
              [crawlResults.length, sourceId]
            );

            await job.updateProgress(30);
            break;
          }

          case 'pdf': {
            const buffer = await downloadFromS3(storagePath!);
            rawText = await extractPDF(buffer);
            pages = [{ text: rawText, meta: { filename: job.data.originalName } }];
            await job.updateProgress(30);
            break;
          }

          case 'docx': {
            const buffer = await downloadFromS3(storagePath!);
            rawText = await extractDOCX(buffer);
            pages = [{ text: rawText, meta: { filename: job.data.originalName } }];
            await job.updateProgress(30);
            break;
          }

          case 'txt': {
            const buffer = await downloadFromS3(storagePath!);
            rawText = extractTXT(buffer);
            pages = [{ text: rawText, meta: { filename: job.data.originalName } }];
            await job.updateProgress(30);
            break;
          }

          case 'audio':
          case 'video': {
            const buffer = await downloadFromS3(storagePath!);
            rawText = await transcribeAudio(buffer, job.data.originalName || `${type === 'video' ? 'video.mp4' : 'audio.mp3'}`);
            pages = [{ text: rawText, meta: { filename: job.data.originalName } }];
            await job.updateProgress(30);
            break;
          }

          default:
            throw new Error(`Unsupported source type: ${type}`);
        }

        // 2. Chunk the text
        const allChunks = pages.flatMap(page =>
          chunkText(page.text, { sourceMeta: page.meta })
        );

        if (allChunks.length === 0) {
          throw new Error('No text content extracted from source');
        }

        await job.updateProgress(50);

        // 3. Get tenant's embedding configuration
        const tenantResult = await query(
          'SELECT embedding_provider, embedding_model FROM tenants WHERE id = $1',
          [tenantId]
        );
        const tenant = tenantResult.rows[0];
        const embeddingProvider = getEmbeddingProvider(tenant.embedding_provider, tenant.embedding_model);

        // 4. Generate embeddings in batches
        const batchSize = 50;
        let totalChunksStored = 0;

        for (let i = 0; i < allChunks.length; i += batchSize) {
          const batch = allChunks.slice(i, i + batchSize);
          const texts = batch.map(c => c.content);
          const embeddings = await embeddingProvider.generateEmbeddings(texts);

          // 5. Store chunks with embeddings
          for (let j = 0; j < batch.length; j++) {
            const embeddingStr = `[${embeddings[j].join(',')}]`;
            await query(
              `INSERT INTO chunks (tenant_id, source_id, content, embedding, metadata)
               VALUES ($1, $2, $3, $4::vector, $5)`,
              [
                tenantId,
                sourceId,
                batch[j].content,
                embeddingStr,
                JSON.stringify(batch[j].metadata),
              ]
            );
            totalChunksStored++;
          }

          const progress = 50 + Math.round((i / allChunks.length) * 50);
          await job.updateProgress(progress);
        }

        // 6. Update source as done
        await query(
          `UPDATE sources SET status = 'done', chunks_created = $1, error_detail = NULL WHERE id = $2`,
          [totalChunksStored, sourceId]
        );

        logger.info(`Ingestion complete: ${sourceId}`, { chunks: totalChunksStored });
        return { chunks: totalChunksStored };

      } catch (error) {
        // Update source as failed
        await query(
          `UPDATE sources SET status = 'failed', error_detail = $1 WHERE id = $2`,
          [String(error), sourceId]
        );
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Ingestion job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Ingestion job failed: ${job?.id}`, { error: err.message });
  });

  return worker;
}

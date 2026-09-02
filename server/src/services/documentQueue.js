// Document Queue - BullMQ background job processor for document text extraction,
// chunking, and embedding generation.
//
// This decouples the HTTP upload request from the expensive ML pipeline:
//   1. Controller saves file to /tmp and calls enqueueDocument(documentId, tempPath)
//   2. Returns 202 Accepted to the client immediately
//   3. This worker picks up the job, runs processDocument, and updates DB status
//
// Production: REDIS_URL points to your Redis instance (e.g. Redis Cloud, AWS ElastiCache).
// Local dev: docker-compose starts a Redis container automatically.

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const documentService = require('./documentService');
const env = require('../config/env');

const connection = new IORedis({
  ...(env.redis.url ? { url: env.redis.url } : { host: 'localhost', port: 6379 }),
  maxRetriesPerRequest: null,
});

const documentQueue = new Queue('document-processing', { connection });

const worker = new Worker(
  'document-processing',
  async (job) => {
    const { documentId, tempPath } = job.data;
    console.log(`[DocumentQueue] Worker picked up job for document ${documentId}`);

    const { readFile, unlink } = require('fs/promises');

    let fileBuffer;
    let originalName;
    try {
      fileBuffer = await readFile(tempPath);
    } catch (readError) {
      console.error(`[DocumentQueue] Could not read temp file for ${documentId}:`, readError);
      throw readError;
    }

    // The tempPath includes the original filename in its name, but we
    // pass a minimal file-like object to processDocument.
    // Extract original name from the temp path stored by the controller.
    originalName = job.data.originalName || `document-${documentId}.pdf`;

    const file = {
      buffer: fileBuffer,
      originalname: originalName,
      mimetype: job.data.mimetype || 'application/pdf',
      size: fileBuffer.length,
    };

    try {
      await documentService.processDocument(documentId, file, fileBuffer);
      console.log(`[DocumentQueue] Successfully processed document ${documentId}`);
    } finally {
      await unlink(tempPath).catch(() => {});
    }

    return { documentId, success: true };
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 300000, // 5 minutes — longer than any single embed call
  }
);

worker.on('completed', (job) => {
  console.log(`[DocumentQueue] Job ${job.id} completed for document ${job.data.documentId}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[DocumentQueue] Job ${job?.id} failed for document ${job?.data?.documentId}:`,
    err.message
  );
});

worker.on('error', (err) => {
  console.error('[DocumentQueue] Worker error:', err);
});

worker.on('drained', () => {
  console.log('[DocumentQueue] Queue drained — all jobs processed');
});

/**
 * Enqueue a document for background processing.
 * @param {string} documentId - The Supabase document record UUID
 * @param {string} tempPath - Absolute path to the saved temp file
 * @param {object} opts - { originalName, mimetype }
 */
async function enqueueDocument(documentId, tempPath, opts = {}) {
  const job = await documentQueue.add(
    'process-document',
    { documentId, tempPath, ...opts },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  console.log(`[DocumentQueue] Enqueued document ${documentId}, job id: ${job.id}`);
  return job.id;
}

async function close() {
  await worker.close();
  await documentQueue.close();
  await connection.quit();
}

process.on('SIGTERM', close);
process.on('SIGINT', close);

module.exports = {
  enqueueDocument,
  worker,
  documentQueue,
  close,
};

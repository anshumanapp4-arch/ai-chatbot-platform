// ============================================
// Client: Source Management Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { createWebsiteSourceSchema, paginationSchema } from '@chatbot/shared';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../middleware/audit.js';
import { getIngestionQueue } from '../../workers/ingestionWorker.js';
import { uploadToS3 } from '../../services/storage.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

router.use(authenticate, tenantScope);

// GET /api/client/sources — List sources for tenant
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, per_page } = paginationSchema.parse(req.query);
    const offset = (page - 1) * per_page;

    const countResult = await query(
      'SELECT COUNT(*) FROM sources WHERE tenant_id = $1',
      [req.tenantId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT * FROM sources WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.tenantId, per_page, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/client/sources/website — Add website source
router.post('/website', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createWebsiteSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const { url, crawl_depth, page_limit } = parsed.data;

    const result = await query(
      `INSERT INTO sources (tenant_id, type, origin, config, status)
       VALUES ($1, 'website', $2, $3, 'queued') RETURNING *`,
      [req.tenantId, url, JSON.stringify({ crawl_depth, page_limit })]
    );

    const source = result.rows[0];

    // Enqueue ingestion job
    const ingestionQueue = getIngestionQueue();
    await ingestionQueue.add('ingest-website', {
      sourceId: source.id,
      tenantId: req.tenantId,
      type: 'website',
      url,
      config: { crawl_depth, page_limit },
    }, {
      jobId: `ingest-${source.id}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    await logAudit(req, {
      action: 'source.create',
      target_type: 'source',
      target_id: source.id,
      details: { type: 'website', url },
    });

    res.status(201).json({ success: true, data: source });
  } catch (error) {
    next(error);
  }
});

// POST /api/client/sources/upload — Upload file source
router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const allowedMimes: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'audio/mpeg': 'audio',
      'audio/wav': 'audio',
      'audio/mp3': 'audio',
      'video/mp4': 'video',
      'image/png': 'image',
      'image/jpeg': 'image',
    };

    const sourceType = allowedMimes[req.file.mimetype];
    if (!sourceType) {
      throw new ValidationError(`Unsupported file type: ${req.file.mimetype}`);
    }

    // Upload to S3/MinIO
    const key = `${req.tenantId}/${uuidv4()}-${req.file.originalname}`;
    await uploadToS3(key, req.file.buffer, req.file.mimetype);

    const result = await query(
      `INSERT INTO sources (tenant_id, type, origin, storage_path, status)
       VALUES ($1, $2, $3, $4, 'queued') RETURNING *`,
      [req.tenantId, sourceType, req.file.originalname, key]
    );

    const source = result.rows[0];

    // Enqueue ingestion job
    const ingestionQueue = getIngestionQueue();
    await ingestionQueue.add(`ingest-${sourceType}`, {
      sourceId: source.id,
      tenantId: req.tenantId,
      type: sourceType,
      storagePath: key,
      originalName: req.file.originalname,
    }, {
      jobId: `ingest-${source.id}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    await logAudit(req, {
      action: 'source.create',
      target_type: 'source',
      target_id: source.id,
      details: { type: sourceType, filename: req.file.originalname },
    });

    res.status(201).json({ success: true, data: source });
  } catch (error) {
    next(error);
  }
});

// POST /api/client/sources/:id/reingest — Re-ingest a source
router.post('/:id/reingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT * FROM sources WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Source', req.params.id as string);
    }

    const source = result.rows[0];

    // Delete existing chunks
    await query('DELETE FROM chunks WHERE source_id = $1', [source.id]);

    // Reset status
    await query(
      `UPDATE sources SET status = 'queued', error_detail = NULL, chunks_created = 0, pages_crawled = 0 WHERE id = $1`,
      [source.id]
    );

    // Re-enqueue
    const ingestionQueue = getIngestionQueue();
    await ingestionQueue.add(`ingest-${source.type}`, {
      sourceId: source.id,
      tenantId: req.tenantId,
      type: source.type,
      url: source.type === 'website' ? source.origin : undefined,
      storagePath: source.storage_path,
      config: source.config,
    }, {
      jobId: `reingest-${source.id}-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    res.json({ success: true, message: 'Re-ingestion queued' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/client/sources/:id — Delete source and chunks
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Chunks cascade on source delete
    const result = await query(
      'DELETE FROM sources WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Source', req.params.id as string);
    }

    await logAudit(req, {
      action: 'source.delete',
      target_type: 'source',
      target_id: req.params.id as string,
    });

    res.json({ success: true, message: 'Source deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

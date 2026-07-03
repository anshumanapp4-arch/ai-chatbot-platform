// ============================================
// Audit Log Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { query } from '../db/client.js';
import { logger } from '../utils/logger.js';

interface AuditEntry {
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an admin/client action to the audit_logs table
 */
export async function logAudit(req: Request, entry: AuditEntry) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, tenant_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user?.user_id || null,
        req.tenantId || null,
        entry.action,
        entry.target_type || null,
        entry.target_id || null,
        JSON.stringify(entry.details || {}),
        req.ip || null,
      ]
    );
  } catch (error) {
    // Audit logging should never fail the request
    logger.error('Failed to write audit log', { error: String(error), entry });
  }
}

/**
 * Middleware factory: auto-log the action for specific routes
 */
export function auditAction(action: string, targetType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log after the response is sent
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logAudit(req, {
          action,
          target_type: targetType,
          target_id: req.params.id as string,
          details: { method: req.method, path: req.path, statusCode: res.statusCode },
        });
      }
    });
    next();
  };
}

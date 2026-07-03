// ============================================
// Tenant Scope Middleware — sets RLS context
// ============================================

import { Request, Response, NextFunction } from 'express';
import { query } from '../db/client.js';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Sets PostgreSQL session variables for RLS enforcement.
 * Must be called AFTER authenticate middleware.
 * 
 * For super_admin: sets role to 'super_admin' so RLS allows all.
 * For client: sets current_tenant to their tenant_id.
 */
export async function tenantScope(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('No user context'));
    }

    const role = req.user.role;
    const tenantId = req.user.tenant_id;

    if (role === 'super_admin') {
      // Super admin can access all tenants
      // Check if impersonating a specific tenant
      const impersonateTenant = req.headers['x-impersonate-tenant'] as string;
      if (impersonateTenant) {
        req.tenantId = impersonateTenant;
        await query(`SET LOCAL app.current_tenant = '${impersonateTenant}'`);
        await query(`SET LOCAL app.current_role = 'super_admin'`);
      } else {
        await query(`SET LOCAL app.current_role = 'super_admin'`);
        await query(`SET LOCAL app.current_tenant = ''`);
      }
    } else if (tenantId) {
      // Client user — scope to their tenant
      req.tenantId = tenantId;
      await query(`SET LOCAL app.current_tenant = '${tenantId}'`);
      await query(`SET LOCAL app.current_role = '${role}'`);
    } else {
      return next(new ForbiddenError('No tenant association'));
    }

    next();
  } catch (error) {
    next(error);
  }
}

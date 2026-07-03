// ============================================
// Auth Routes — Login, Register, Refresh Token
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/client.js';
import { loginSchema, registerSchema } from '@chatbot/shared';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticate } from '../middleware/auth.js';
import { UnauthorizedError, ValidationError, ConflictError } from '../utils/errors.js';
import { authLimiter } from '../middleware/rateLimit.js';
import type { JWTPayload, UserWithPassword } from '@chatbot/shared';

const router = Router();

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const { email, password } = parsed.data;

    const result = await query<UserWithPassword>(
      'SELECT * FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: JWTPayload = {
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      throw new UnauthorizedError('Refresh token required');
    }

    const payload = verifyRefreshToken(refresh_token);

    // Verify user still exists and is active
    const result = await query(
      'SELECT id, email, role, tenant_id, status FROM users WHERE id = $1',
      [payload.user_id]
    );

    if (result.rows.length === 0 || result.rows[0].status !== 'active') {
      throw new UnauthorizedError('User not found or suspended');
    }

    const user = result.rows[0];
    const newPayload: JWTPayload = {
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
    };

    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT id, email, role, tenant_id, status, created_at FROM users WHERE id = $1',
      [req.user!.user_id]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    let tenant = null;
    if (result.rows[0].tenant_id) {
      const tenantResult = await query(
        'SELECT id, name, slug, status FROM tenants WHERE id = $1',
        [result.rows[0].tenant_id]
      );
      tenant = tenantResult.rows[0] || null;
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0],
        tenant,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

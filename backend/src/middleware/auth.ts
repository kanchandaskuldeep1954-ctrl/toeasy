import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tier: string;
    active_workspace_id?: string;
  };
}

/**
 * Best-effort auth: if a Bearer token is present and valid, populate req.user.
 * Never blocks the request. Useful for middleware that needs user context (e.g. caching)
 * but must not enforce auth at this layer.
 */
export function optionalAuthenticateToken(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      tier: decoded.tier,
      active_workspace_id: decoded.activeWorkspaceId || decoded.active_workspace_id
    };
  } catch (err) {
    // Ignore invalid tokens here; enforcement happens in authenticateToken where required.
  }

  next();
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      tier: decoded.tier,
      active_workspace_id: decoded.activeWorkspaceId || decoded.active_workspace_id
    };
    next();
  } catch (err) {
    console.error('[AuthMiddleware] Token verification failed:', err);
    return res.status(403).json({ error: 'Invalid or expired token', details: (err as Error).message });
  }
}

export function generateToken(userId: string, email: string, tier: string = 'basic'): string {
  return jwt.sign(
    { userId, email, tier },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

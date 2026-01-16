import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; tier: string };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = { id: decoded.userId, email: decoded.email, tier: decoded.tier };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
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

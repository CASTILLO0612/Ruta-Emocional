import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireJwtAccessSecret } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'patient' | 'psychologist';
  };
}

export function protect(req: AuthRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ message: 'No autorizado: falta Token JWT' });
    return;
  }

  try {
    const secret = requireJwtAccessSecret();
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: 'patient' | 'psychologist' };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'No autorizado: Token inválido o expirado' });
  }
}

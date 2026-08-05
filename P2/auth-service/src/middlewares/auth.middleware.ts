import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtService } from '../services/jwt.service';
import { COOKIE_NAME, getCookieOptions } from '../config/cookie.config';

const jwtService = new JwtService();

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ message: 'No autenticado. Falta el token de sesión.' });
    return;
  }

  try {
    const payload = jwtService.verify(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      handleExpiredToken(token, req, res, next);
      return;
    }
    res.status(401).json({ message: 'Token inválido.' });
  }
}

function handleExpiredToken(
  token: string,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const decoded = jwtService.decodeIgnoringExpiration(token);

  if (!decoded || !decoded.exp) {
    res.status(401).json({ message: 'Token inválido o expirado.' });
    return;
  }

  if (!jwtService.isWithinRenewalGracePeriod(decoded.exp)) {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({
      message: 'La sesión expiró hace demasiado tiempo. Por favor inicia sesión de nuevo.',
    });
    return;
  }

  const newToken = jwtService.sign({ userId: decoded.userId, role: decoded.role });
  res.cookie(COOKIE_NAME, newToken, getCookieOptions());
  res.setHeader('X-Token-Renewed', 'true');

  (req as any).user = { userId: decoded.userId, role: decoded.role };
  next();
}
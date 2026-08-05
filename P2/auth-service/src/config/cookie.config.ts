import { CookieOptions } from 'express';

export const COOKIE_NAME = 'access_token';

export function getCookieOptions(): CookieOptions {
  const jwtLifetime = Number(process.env.JWT_EXPIRES_IN_SECONDS || 900);
  const gracePeriod = Number(process.env.JWT_RENEW_GRACE_PERIOD_SECONDS || 300);

  // La cookie debe vivir MÁS que el JWT: tiene que cubrir el tiempo de
  // vida del token + todo el periodo de gracia. Si la cookie expirara
  // al mismo tiempo que el JWT, el navegador la borraría justo cuando
  // el token vence, y el servidor nunca tendría oportunidad de
  // recibirla para intentar renovarla.
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: (jwtLifetime + gracePeriod) * 1000,
  };
}
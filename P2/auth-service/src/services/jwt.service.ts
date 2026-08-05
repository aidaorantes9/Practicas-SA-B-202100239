import jwt, { JwtPayload } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 900;
const RENEW_GRACE_PERIOD = Number(process.env.JWT_RENEW_GRACE_PERIOD_SECONDS) || 300;

export interface TokenPayload {
  userId: number;
  role: 'admin' | 'cliente';
}

// Single Responsibility: este módulo SOLO firma/verifica JWT.
// No sabe nada de usuarios, cookies, ni HTTP.
export class JwtService {
  public sign(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
  }

  public verify(token: string): TokenPayload & JwtPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload & JwtPayload;
  }

  public decodeIgnoringExpiration(token: string): (TokenPayload & JwtPayload) | null {
    try {
      return jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as TokenPayload &
        JwtPayload;
    } catch {
      return null;
    }
  }

  public isWithinRenewalGracePeriod(exp: number): boolean {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const secondsSinceExpiration = nowInSeconds - exp;
    return secondsSinceExpiration > 0 && secondsSinceExpiration <= RENEW_GRACE_PERIOD;
  }
}
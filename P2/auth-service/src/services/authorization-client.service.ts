const AUTHZ_URL = process.env.AUTHZ_SERVICE_URL || 'http://localhost:4001';
const MAX_RETRIES = Number(process.env.AUTHZ_MAX_RETRIES) || 3;
const BACKOFF_MS = Number(process.env.AUTHZ_RETRY_BACKOFF_MS) || 500;
const TIMEOUT_MS = Number(process.env.AUTHZ_TIMEOUT_MS) || 2000;

export type Role = 'admin' | 'cliente';

export class AuthorizationClient {
  public async isAuthorized(role: Role, resource: string): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callAuthzService(role, resource);
      } catch (error) {
        const isLastAttempt = attempt === MAX_RETRIES;
        console.warn(
          `[authz-client] Intento ${attempt}/${MAX_RETRIES} falló: ${
            (error as Error).message
          }`
        );

        if (isLastAttempt) {
          console.error(
            '[authz-client] Se agotaron los reintentos. Acceso denegado por error de comunicación.'
          );
          return false;
        }

        const waitMs = BACKOFF_MS * attempt;
        await this.sleep(waitMs);
      }
    }
    return false;
  }

  private async callAuthzService(role: Role, resource: string): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${AUTHZ_URL}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, resource }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`authz-service respondió con status ${response.status}`);
      }

      const data = (await response.json()) as { authorized: boolean };
      return data.authorized === true;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
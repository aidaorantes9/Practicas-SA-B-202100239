import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.AES_SECRET_KEY || 'default_key_32_characters_long!';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(SECRET_KEY).digest();
}

export function encryptAES(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptAES(cipherText: string): string {
  const [ivHex, encryptedHex] = cipherText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function hashDeterministic(value: string): string {
  return crypto
    .createHmac('sha256', getKey())
    .update(value.toLowerCase().trim())
    .digest('hex');
}
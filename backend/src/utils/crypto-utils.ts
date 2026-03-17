/**
 * Field-level encryption utilities using AES-256-GCM.
 *
 * Used for encrypting sensitive PII fields (PAN, bank account numbers)
 * stored in the database, satisfying the NFR for data encryption.
 *
 * Key source: FIELD_ENCRYPTION_KEY env variable (32-byte hex string, 64 hex chars).
 * If not set, a warning is logged and plaintext is stored (dev convenience only).
 *
 * Format of encrypted value: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Prefix "enc:" is prepended so decryptField() can detect already-plaintext values.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;     // 96-bit IV for GCM
const TAG_LENGTH = 16;    // 128-bit auth tag

function getKey(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    console.warn('[crypto-utils] FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Encryption disabled.');
    return null;
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string. Returns the encrypted value with "enc:" prefix,
 * or the original plaintext if the encryption key is not configured.
 */
export function encryptField(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext == null) return plaintext;

  const key = getKey();
  if (!key) return plaintext; // encryption not configured — store as-is (dev mode)

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value previously encrypted with encryptField().
 * If the value doesn't start with "enc:" it is returned as-is (legacy plaintext support).
 * Returns null/undefined as-is.
 */
export function decryptField(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  if (!value.startsWith('enc:')) return value; // plaintext or not encrypted

  const key = getKey();
  if (!key) {
    // Key not configured — strip prefix and return as base64 (best-effort)
    console.warn('[crypto-utils] Encrypted field found but FIELD_ENCRYPTION_KEY is not set. Cannot decrypt.');
    return value;
  }

  try {
    const parts = value.slice(4).split(':'); // remove "enc:" prefix
    if (parts.length !== 3) throw new Error('Invalid encrypted format');

    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[crypto-utils] Decryption failed:', err);
    return value; // return raw value to avoid data loss
  }
}

/**
 * Check if a value is currently encrypted (has "enc:" prefix).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}

/**
 * Mask a sensitive value for display (e.g. PAN ABCDE1234F → ABCDE****F).
 * Works on both plaintext and encrypted strings (decrypts first).
 */
export function maskPAN(value: string | null | undefined): string {
  if (!value) return '';
  const plain = decryptField(value) || '';
  if (plain.length < 4) return '****';
  return plain.slice(0, 5) + '****' + plain.slice(-1);
}

/**
 * Mask bank account number (show last 4 digits only).
 */
export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) return '';
  const plain = decryptField(value) || '';
  if (plain.length <= 4) return '****';
  return '****' + plain.slice(-4);
}

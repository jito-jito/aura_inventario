import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Deriva una clave de 32 bytes desde ML_TOKEN_ENCRYPTION_KEY (puede ser cualquier
 * string) para no exigirle al operador que genere un hex de 32 bytes a mano.
 */
function deriveKey(): Buffer {
  const secret = process.env.ML_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ML_TOKEN_ENCRYPTION_KEY no está configurado');
  }
  return createHash('sha256').update(secret).digest();
}

/** Cifra un texto plano con AES-256-GCM. Formato de salida: iv.authTag.ciphertext (base64). */
export function encryptToken(plainText: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

export function decryptToken(payload: string): string {
  const key = deriveKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

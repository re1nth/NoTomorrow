import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function keyMaterial(): string {
  const configured = process.env.SOCIAL_MESSAGE_KEY ?? process.env.AUTH_SECRET;
  if (!configured) {
    throw new Error('SOCIAL_MESSAGE_KEY or AUTH_SECRET must be set for encrypted messaging');
  }
  return configured;
}

function key(): Buffer {
  return createHash('sha256').update(keyMaterial()).digest();
}

export function encryptMessage(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptMessage(payload: EncryptedPayload): string {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

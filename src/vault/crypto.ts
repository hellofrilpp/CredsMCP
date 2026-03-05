import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import type { KdfParams, EncryptedPayload } from "./types.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

// scrypt defaults: N=2^17 (~128MB), r=8, p=1
const DEFAULT_KDF_PARAMS = { N: 131072, r: 8, p: 1 };

export function generateSalt(): string {
  return randomBytes(32).toString("hex");
}

export function deriveKey(password: string, params: KdfParams): Buffer {
  const salt = Buffer.from(params.salt, "hex");
  return scryptSync(password, salt, KEY_LENGTH, {
    N: params.N,
    r: params.r,
    p: params.p,
  });
}

export function defaultKdfParams(): KdfParams {
  return { salt: generateSalt(), ...DEFAULT_KDF_PARAMS };
}

export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

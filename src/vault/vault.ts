import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { deriveKey, encrypt, decrypt, defaultKdfParams } from "./crypto.js";
import type { VaultFile, VaultData } from "./types.js";

const VAULT_DIR = join(homedir(), ".credsmcp");
const VAULT_PATH = join(VAULT_DIR, "vault.json");

function ensureDir(): void {
  if (!existsSync(VAULT_DIR)) {
    mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
  }
}

function emptyVaultData(): VaultData {
  return { profiles: {} };
}

export function vaultExists(): boolean {
  return existsSync(VAULT_PATH);
}

export function readVault(password: string): VaultData {
  if (!vaultExists()) {
    return emptyVaultData();
  }

  const raw = readFileSync(VAULT_PATH, "utf8");
  const vaultFile: VaultFile = JSON.parse(raw);

  if (vaultFile.version !== 1) {
    throw new Error(`Unsupported vault version: ${vaultFile.version}`);
  }

  const key = deriveKey(password, vaultFile.kdfParams);

  try {
    const plaintext = decrypt(vaultFile.payload, key);
    return JSON.parse(plaintext) as VaultData;
  } catch {
    throw new Error("Failed to decrypt vault. Wrong master password?");
  }
}

export function writeVault(password: string, data: VaultData): void {
  ensureDir();

  // Reuse existing KDF params (same salt) if vault exists, else generate new
  let kdfParams = defaultKdfParams();
  if (vaultExists()) {
    try {
      const raw = readFileSync(VAULT_PATH, "utf8");
      const existing: VaultFile = JSON.parse(raw);
      kdfParams = existing.kdfParams;
    } catch {
      // If we can't read existing, use fresh params
    }
  }

  const key = deriveKey(password, kdfParams);
  const payload = encrypt(JSON.stringify(data), key);

  const vaultFile: VaultFile = {
    version: 1,
    kdf: "scrypt",
    kdfParams,
    payload,
  };

  // Atomic write: write to temp file, then rename
  const tmpPath = VAULT_PATH + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(vaultFile, null, 2), { mode: 0o600 });
  renameSync(tmpPath, VAULT_PATH);
}

export function updateVault(
  password: string,
  updater: (data: VaultData) => VaultData
): VaultData {
  const data = readVault(password);
  const updated = updater(data);
  writeVault(password, updated);
  return updated;
}

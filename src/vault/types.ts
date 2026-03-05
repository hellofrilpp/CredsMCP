export interface KdfParams {
  salt: string; // hex
  N: number;
  r: number;
  p: number;
}

export interface EncryptedPayload {
  iv: string; // hex
  tag: string; // hex
  ciphertext: string; // hex
}

export interface VaultFile {
  version: 1;
  kdf: "scrypt";
  kdfParams: KdfParams;
  payload: EncryptedPayload;
}

export interface ProfileEntry {
  [key: string]: string | boolean | undefined;
  default?: boolean;
}

export interface VaultData {
  profiles: {
    [service: string]: {
      [profileName: string]: ProfileEntry;
    };
  };
}

const KEYCHAIN_SERVICE = "credsmcp";
const KEYCHAIN_ACCOUNT = "master-password";

let cachedPassword: string | null = null;

async function fromEnv(): Promise<string | null> {
  return process.env.CREDSMCP_PASSWORD ?? null;
}

async function fromKeychain(): Promise<string | null> {
  try {
    const { Entry } = await import("@napi-rs/keyring");
    const entry = new Entry(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    const password = entry.getPassword();
    return password;
  } catch {
    // Keychain not available or no entry — that's fine
    return null;
  }
}

async function saveToKeychain(password: string): Promise<void> {
  try {
    const { Entry } = await import("@napi-rs/keyring");
    const entry = new Entry(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    entry.setPassword(password);
  } catch {
    // Keychain not available — skip silently
  }
}

export async function getMasterPassword(): Promise<string> {
  // Return cached if available
  if (cachedPassword) return cachedPassword;

  // Priority 1: Environment variable
  const envPassword = await fromEnv();
  if (envPassword) {
    cachedPassword = envPassword;
    return envPassword;
  }

  // Priority 2: OS keychain
  const keychainPassword = await fromKeychain();
  if (keychainPassword) {
    cachedPassword = keychainPassword;
    return keychainPassword;
  }

  // No password found — throw clear error with instructions
  throw new Error(
    "No master password configured. Set CREDSMCP_PASSWORD environment variable, " +
    "or use set_credentials with a password parameter to initialize the vault."
  );
}

export async function setMasterPassword(password: string): Promise<void> {
  cachedPassword = password;
  await saveToKeychain(password);
}

export function clearCachedPassword(): void {
  cachedPassword = null;
}

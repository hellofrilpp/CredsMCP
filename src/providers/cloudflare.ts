import type { CloudProvider } from "./base.js";

export const cloudflare: CloudProvider = {
  name: "Cloudflare",
  slug: "cloudflare",
  description: "Cloudflare API — Pages, Workers, D1, R2, DNS",

  requiredFields: [
    { key: "api_key", label: "Global API Key", secret: true, description: "From dash.cloudflare.com/profile/api-tokens" },
    { key: "email", label: "Account Email", secret: false },
  ],
  optionalFields: [
    { key: "account_id", label: "Account ID", secret: false, description: "Required for some API calls" },
    { key: "api_token", label: "Scoped API Token", secret: true, description: "Alternative to Global API Key" },
  ],

  async verify(creds) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (creds.api_token) {
      headers["Authorization"] = `Bearer ${creds.api_token}`;
    } else {
      headers["X-Auth-Key"] = creds.api_key;
      headers["X-Auth-Email"] = creds.email;
    }

    try {
      const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        method: "GET",
        headers,
      });
      const data = await res.json() as { success: boolean; result?: { status: string }; errors?: { message: string }[] };

      if (data.success) {
        return { ok: true, message: "Cloudflare credentials valid", identity: creds.email };
      }
      return { ok: false, message: `Cloudflare auth failed: ${data.errors?.[0]?.message ?? "unknown error"}` };
    } catch (err) {
      return { ok: false, message: `Cloudflare connection failed: ${(err as Error).message}` };
    }
  },

  toEnvVars(creds) {
    const vars: Record<string, string> = {
      CLOUDFLARE_API_KEY: creds.api_key,
      CLOUDFLARE_EMAIL: creds.email,
    };
    if (creds.account_id) vars.CLOUDFLARE_ACCOUNT_ID = creds.account_id;
    if (creds.api_token) vars.CLOUDFLARE_API_TOKEN = creds.api_token;
    return vars;
  },
};

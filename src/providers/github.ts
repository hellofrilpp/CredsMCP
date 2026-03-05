import type { CloudProvider } from "./base.js";

export const github: CloudProvider = {
  name: "GitHub",
  slug: "github",
  description: "GitHub API — repos, actions, packages, gists",

  requiredFields: [
    { key: "token", label: "Personal Access Token", secret: true, description: "Classic PAT or fine-grained token from github.com/settings/tokens" },
  ],
  optionalFields: [
    { key: "username", label: "Username", secret: false },
  ],

  async verify(creds) {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "User-Agent": "CredsMCP/1.0",
          Accept: "application/vnd.github+json",
        },
      });
      const data = await res.json() as { login?: string; message?: string };

      if (res.ok && data.login) {
        return { ok: true, message: `GitHub authenticated as ${data.login}`, identity: data.login };
      }
      return { ok: false, message: `GitHub auth failed: ${data.message ?? "unknown error"}` };
    } catch (err) {
      return { ok: false, message: `GitHub connection failed: ${(err as Error).message}` };
    }
  },

  toEnvVars(creds) {
    const vars: Record<string, string> = {
      GITHUB_TOKEN: creds.token,
      GH_TOKEN: creds.token,
    };
    if (creds.username) vars.GITHUB_USER = creds.username;
    return vars;
  },
};

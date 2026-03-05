import type { CloudProvider } from "./base.js";

export const railway: CloudProvider = {
  name: "Railway",
  slug: "railway",
  description: "Railway.app — deployments, databases, services",

  requiredFields: [
    { key: "token", label: "API Token", secret: true, description: "From railway.app/account/tokens" },
  ],
  optionalFields: [
    { key: "project_id", label: "Default Project ID", secret: false },
  ],

  async verify(creds) {
    try {
      const res = await fetch("https://backboard.railway.app/graphql/v2", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "{ me { email name } }" }),
      });
      const data = await res.json() as { data?: { me?: { email: string; name: string } }; errors?: { message: string }[] };

      if (data.data?.me) {
        const identity = data.data.me.email || data.data.me.name;
        return { ok: true, message: `Railway authenticated as ${identity}`, identity };
      }
      return { ok: false, message: `Railway auth failed: ${data.errors?.[0]?.message ?? "unknown error"}` };
    } catch (err) {
      return { ok: false, message: `Railway connection failed: ${(err as Error).message}` };
    }
  },

  toEnvVars(creds) {
    const vars: Record<string, string> = {
      RAILWAY_TOKEN: creds.token,
    };
    if (creds.project_id) vars.RAILWAY_PROJECT_ID = creds.project_id;
    return vars;
  },
};

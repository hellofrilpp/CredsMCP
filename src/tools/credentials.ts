import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMasterPassword, setMasterPassword } from "../auth/masterPassword.js";
import { readVault, writeVault, updateVault, vaultExists } from "../vault/vault.js";
import { getAllProviders, getProvider } from "../providers/registry.js";
import type { ProfileEntry, VaultData } from "../vault/types.js";
import type { FieldDefinition } from "../providers/base.js";

function redactSecrets(
  creds: ProfileEntry,
  fields: FieldDefinition[],
  reveal: boolean
): Record<string, string> {
  const result: Record<string, string> = {};
  const secretKeys = new Set(fields.filter((f) => f.secret).map((f) => f.key));

  for (const [k, v] of Object.entries(creds)) {
    if (k === "default") continue;
    if (typeof v !== "string") continue;
    if (secretKeys.has(k) && !reveal) {
      result[k] = v.slice(0, 4) + "..." + v.slice(-4);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function registerTools(server: McpServer): void {
  // 1. list_services
  server.tool(
    "list_services",
    "List all supported cloud providers with their required and optional fields",
    {},
    async () => {
      const providers = getAllProviders();
      const services = providers.map((p) => ({
        name: p.name,
        slug: p.slug,
        description: p.description,
        requiredFields: p.requiredFields.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
        })),
        optionalFields: p.optionalFields.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
        })),
      }));
      return { content: [{ type: "text", text: JSON.stringify(services, null, 2) }] };
    }
  );

  // 2. list_profiles
  server.tool(
    "list_profiles",
    "List configured credential profiles, optionally filtered by service",
    { service: z.string().optional().describe("Filter by service slug (e.g. 'cloudflare')") },
    async ({ service }) => {
      const password = await getMasterPassword();
      const data = readVault(password);

      const result: Record<string, { profiles: string[]; default?: string }> = {};

      for (const [svc, profiles] of Object.entries(data.profiles)) {
        if (service && svc !== service) continue;

        const profileNames = Object.keys(profiles);
        const defaultProfile = Object.entries(profiles).find(([_, p]) => p.default)?.[0];

        result[svc] = {
          profiles: profileNames,
          ...(defaultProfile ? { default: defaultProfile } : {}),
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 3. get_credentials
  server.tool(
    "get_credentials",
    "Get credentials for a service and profile. Returns the default profile if no profile specified.",
    {
      service: z.string().describe("Service slug (e.g. 'cloudflare', 'github')"),
      profile: z.string().optional().describe("Profile name. Uses default if not specified."),
      reveal: z.boolean().optional().default(false).describe("Show full secret values (default: redacted)"),
    },
    async ({ service, profile, reveal }) => {
      const provider = getProvider(service);
      if (!provider) {
        return { content: [{ type: "text", text: `Unknown service: ${service}. Use list_services to see available providers.` }], isError: true };
      }

      const password = await getMasterPassword();
      const data = readVault(password);
      const serviceProfiles = data.profiles[service];

      if (!serviceProfiles || Object.keys(serviceProfiles).length === 0) {
        return { content: [{ type: "text", text: `No profiles configured for ${service}. Use set_credentials to add one.` }], isError: true };
      }

      let targetProfile: string;
      if (profile) {
        targetProfile = profile;
      } else {
        // Find default
        const defaultEntry = Object.entries(serviceProfiles).find(([_, p]) => p.default);
        if (defaultEntry) {
          targetProfile = defaultEntry[0];
        } else {
          // Use first profile
          targetProfile = Object.keys(serviceProfiles)[0];
        }
      }

      const creds = serviceProfiles[targetProfile];
      if (!creds) {
        return { content: [{ type: "text", text: `Profile '${targetProfile}' not found for ${service}. Available: ${Object.keys(serviceProfiles).join(", ")}` }], isError: true };
      }

      const allFields = [...provider.requiredFields, ...provider.optionalFields];
      const redacted = redactSecrets(creds, allFields, reveal ?? false);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            service: provider.name,
            profile: targetProfile,
            isDefault: creds.default === true,
            credentials: redacted,
          }, null, 2),
        }],
      };
    }
  );

  // 4. set_credentials
  server.tool(
    "set_credentials",
    "Add or update credentials for a service and profile",
    {
      service: z.string().describe("Service slug (e.g. 'cloudflare')"),
      profile: z.string().describe("Profile name (e.g. 'gaigentic', 'personal')"),
      credentials: z.record(z.string()).describe("Key-value pairs of credential fields"),
      set_default: z.boolean().optional().default(false).describe("Set as default profile for this service"),
      master_password: z.string().optional().describe("Master password (required for first-time setup if not in env/keychain)"),
    },
    async ({ service, profile, credentials, set_default, master_password }) => {
      const provider = getProvider(service);
      if (!provider) {
        return { content: [{ type: "text", text: `Unknown service: ${service}. Use list_services to see available providers.` }], isError: true };
      }

      // Validate required fields
      const missing = provider.requiredFields
        .filter((f) => !credentials[f.key])
        .map((f) => f.key);
      if (missing.length > 0) {
        return { content: [{ type: "text", text: `Missing required fields: ${missing.join(", ")}` }], isError: true };
      }

      // Resolve password
      let password: string;
      if (master_password) {
        await setMasterPassword(master_password);
        password = master_password;
      } else {
        password = await getMasterPassword();
      }

      updateVault(password, (data) => {
        if (!data.profiles[service]) {
          data.profiles[service] = {};
        }

        // Build profile entry
        const entry: ProfileEntry = { ...credentials };

        // Handle default flag
        if (set_default) {
          // Clear existing defaults for this service
          for (const p of Object.values(data.profiles[service])) {
            delete p.default;
          }
          entry.default = true;
        } else if (Object.keys(data.profiles[service]).length === 0) {
          // First profile auto-becomes default
          entry.default = true;
        }

        data.profiles[service][profile] = entry;
        return data;
      });

      return {
        content: [{
          type: "text",
          text: `Credentials saved: ${provider.name} / ${profile}${set_default ? " (default)" : ""}`,
        }],
      };
    }
  );

  // 5. remove_credentials
  server.tool(
    "remove_credentials",
    "Remove a credential profile",
    {
      service: z.string().describe("Service slug"),
      profile: z.string().describe("Profile name to remove"),
    },
    async ({ service, profile }) => {
      const password = await getMasterPassword();

      let found = false;
      updateVault(password, (data) => {
        if (data.profiles[service]?.[profile]) {
          delete data.profiles[service][profile];
          found = true;

          // If we deleted the default and others remain, make the first one default
          const remaining = Object.keys(data.profiles[service]);
          if (remaining.length > 0 && !Object.values(data.profiles[service]).some((p) => p.default)) {
            data.profiles[service][remaining[0]].default = true;
          }

          // Clean up empty service
          if (remaining.length === 0) {
            delete data.profiles[service];
          }
        }
        return data;
      });

      if (!found) {
        return { content: [{ type: "text", text: `Profile '${profile}' not found for ${service}.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Removed: ${service} / ${profile}` }] };
    }
  );

  // 6. switch_default
  server.tool(
    "switch_default",
    "Set which profile is the default for a service",
    {
      service: z.string().describe("Service slug"),
      profile: z.string().describe("Profile name to make default"),
    },
    async ({ service, profile }) => {
      const password = await getMasterPassword();

      let found = false;
      updateVault(password, (data) => {
        if (data.profiles[service]?.[profile]) {
          // Clear all defaults for this service
          for (const p of Object.values(data.profiles[service])) {
            delete p.default;
          }
          data.profiles[service][profile].default = true;
          found = true;
        }
        return data;
      });

      if (!found) {
        return { content: [{ type: "text", text: `Profile '${profile}' not found for ${service}.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Default switched: ${service} → ${profile}` }] };
    }
  );

  // 7. verify_credentials
  server.tool(
    "verify_credentials",
    "Test if stored credentials are valid by calling the provider API",
    {
      service: z.string().describe("Service slug"),
      profile: z.string().optional().describe("Profile name. Uses default if not specified."),
    },
    async ({ service, profile }) => {
      const provider = getProvider(service);
      if (!provider) {
        return { content: [{ type: "text", text: `Unknown service: ${service}` }], isError: true };
      }

      const password = await getMasterPassword();
      const data = readVault(password);
      const serviceProfiles = data.profiles[service];

      if (!serviceProfiles) {
        return { content: [{ type: "text", text: `No profiles for ${service}` }], isError: true };
      }

      let targetProfile: string;
      if (profile) {
        targetProfile = profile;
      } else {
        const defaultEntry = Object.entries(serviceProfiles).find(([_, p]) => p.default);
        targetProfile = defaultEntry?.[0] ?? Object.keys(serviceProfiles)[0];
      }

      const creds = serviceProfiles[targetProfile];
      if (!creds) {
        return { content: [{ type: "text", text: `Profile '${targetProfile}' not found` }], isError: true };
      }

      // Extract string-only fields for verification
      const credStrings: Record<string, string> = {};
      for (const [k, v] of Object.entries(creds)) {
        if (typeof v === "string") credStrings[k] = v;
      }

      const result = await provider.verify(credStrings);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            service: provider.name,
            profile: targetProfile,
            ...result,
          }, null, 2),
        }],
      };
    }
  );

  // 8. export_env
  server.tool(
    "export_env",
    "Return credentials as KEY=VALUE environment variable pairs for shell use",
    {
      service: z.string().describe("Service slug"),
      profile: z.string().optional().describe("Profile name. Uses default if not specified."),
    },
    async ({ service, profile }) => {
      const provider = getProvider(service);
      if (!provider) {
        return { content: [{ type: "text", text: `Unknown service: ${service}` }], isError: true };
      }

      const password = await getMasterPassword();
      const data = readVault(password);
      const serviceProfiles = data.profiles[service];

      if (!serviceProfiles) {
        return { content: [{ type: "text", text: `No profiles for ${service}` }], isError: true };
      }

      let targetProfile: string;
      if (profile) {
        targetProfile = profile;
      } else {
        const defaultEntry = Object.entries(serviceProfiles).find(([_, p]) => p.default);
        targetProfile = defaultEntry?.[0] ?? Object.keys(serviceProfiles)[0];
      }

      const creds = serviceProfiles[targetProfile];
      if (!creds) {
        return { content: [{ type: "text", text: `Profile '${targetProfile}' not found` }], isError: true };
      }

      const credStrings: Record<string, string> = {};
      for (const [k, v] of Object.entries(creds)) {
        if (typeof v === "string") credStrings[k] = v;
      }

      const envVars = provider.toEnvVars(credStrings);
      const lines = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

      return { content: [{ type: "text", text: lines }] };
    }
  );
}

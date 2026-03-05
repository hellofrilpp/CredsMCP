import type { CloudProvider } from "./base.js";
import { cloudflare } from "./cloudflare.js";
import { github } from "./github.js";
import { railway } from "./railway.js";

const providers: CloudProvider[] = [cloudflare, github, railway];

const providerMap = new Map<string, CloudProvider>();
for (const p of providers) {
  providerMap.set(p.slug, p);
}

export function getProvider(slug: string): CloudProvider | undefined {
  return providerMap.get(slug);
}

export function getAllProviders(): CloudProvider[] {
  return [...providers];
}

export function getProviderSlugs(): string[] {
  return providers.map((p) => p.slug);
}

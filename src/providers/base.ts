export interface FieldDefinition {
  key: string;
  label: string;
  secret: boolean;
  description?: string;
}

export interface VerifyResult {
  ok: boolean;
  message: string;
  identity?: string;
}

export interface CloudProvider {
  name: string;
  slug: string;
  description: string;
  requiredFields: FieldDefinition[];
  optionalFields: FieldDefinition[];
  verify(creds: Record<string, string>): Promise<VerifyResult>;
  toEnvVars(creds: Record<string, string>): Record<string, string>;
}

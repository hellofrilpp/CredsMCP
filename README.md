# CredsMCP

Encrypted credential manager for AI coding tools.

> One vault. Every AI tool. All your API keys — encrypted, organized, and instantly available.

## What is CredsMCP?

CredsMCP is an [MCP server](https://modelcontextprotocol.io/) that securely stores and serves your cloud API credentials. Instead of copy-pasting API keys every session, your AI tools call `get_credentials("cloudflare", "gaigentic")` and get exactly what they need.

- **AES-256-GCM** encrypted vault at `~/.credsmcp/vault.json`
- **Multiple profiles** per service (work, personal, client projects)
- **3 providers** built-in: Cloudflare, GitHub, Railway
- **Extensible** — add any provider in one file
- **Cross-platform** — macOS, Windows, Linux

## Quick Start

```bash
# Add to Claude Code
claude mcp add --transport stdio credsmcp -- npx credsmcp

# Add to Cursor / Windsurf / Claude Desktop — see full docs
```

Set your master password:
```bash
export CREDSMCP_PASSWORD="your-secure-password"
```

Then ask your AI tool to store credentials:
> "Store my Cloudflare API key for the gaigentic account"

## Integration

### Claude Code CLI
```bash
claude mcp add --transport stdio --env CREDSMCP_PASSWORD=your-password credsmcp -- npx credsmcp
```

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
```json
{
  "mcpServers": {
    "credsmcp": {
      "command": "npx",
      "args": ["credsmcp"],
      "env": { "CREDSMCP_PASSWORD": "your-password" }
    }
  }
}
```

### Cursor IDE
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "credsmcp": {
      "command": "npx",
      "args": ["credsmcp"],
      "env": { "CREDSMCP_PASSWORD": "your-password" }
    }
  }
}
```

### Windsurf IDE
Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "credsmcp": {
      "command": "npx",
      "args": ["credsmcp"],
      "env": { "CREDSMCP_PASSWORD": "your-password" }
    }
  }
}
```

### VS Code + Continue.dev
Create `.continue/mcpServers/credsmcp.yaml`:
```yaml
name: credsmcp
command: npx
args:
  - credsmcp
env:
  CREDSMCP_PASSWORD: your-password
```

## Tools

| Tool | Description |
|------|-------------|
| `list_services` | List supported providers and their fields |
| `list_profiles` | List configured profiles by service |
| `get_credentials` | Get credentials (redacted by default) |
| `set_credentials` | Store credentials for a service + profile |
| `remove_credentials` | Delete a profile |
| `switch_default` | Change the default profile for a service |
| `verify_credentials` | Test credentials via provider API |
| `export_env` | Return credentials as KEY=VALUE env vars |

## Security

- **Encryption**: AES-256-GCM with authenticated encryption
- **Key derivation**: scrypt (N=2^17, r=8, p=1) — memory-hard, GPU/ASIC resistant
- **Storage**: `~/.credsmcp/vault.json` with `0600` permissions
- **Atomic writes**: temp file + rename prevents corruption
- **Secret redaction**: API keys shown as `xxxx...xxxx` by default

## Documentation

Full docs and integration guides: **https://gaigenticai.github.io/CredsMCP**

## License

MIT

# AI Less MCP Server

Minimal MCP server for the training monorepo. It runs on Bun over stdio and does not need a web framework.

## Commands

```bash
pnpm install
bun run --cwd apps/mcp typecheck
bun run --cwd apps/mcp inspect
```

For MCP clients, run the server directly with `bun src/index.ts`. Avoid wrapping the server with `bun run start`, because package-script output can pollute MCP stdout.

## Cursor config

Add this server to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ai-less-mcp": {
      "command": "bun",
      "args": [
        "/Users/dmitriy.vrnn/HomeProjects/ai-less/apps/mcp/src/index.ts"
      ]
    }
  }
}
```

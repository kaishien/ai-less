# AI Less MCP Server

Minimal MCP server for the training monorepo. It runs on Bun over stdio and does not need a web framework.

## Tools

- `word_count` - counts words, characters, and lines in provided text.
- `to_snake_case` - converts a label or identifier to `snake_case`.
- `current_moscow_time` - returns current Moscow time as an ISO string.
- `obsidian_list_notes` - lists markdown notes in the configured Obsidian vault.
- `obsidian_read_note` - reads a markdown note from the vault by relative path.
- `obsidian_write_note` - creates, overwrites, or appends to a markdown note in the vault.
- `obsidian_search_notes` - searches vault markdown notes by case-insensitive text query.
- `repo_collect_todos_to_obsidian` - scans code for `TODO`, `FIXME`, `HACK`, and `NOTE` comments, detects nearby functions/classes, and writes a markdown report into Obsidian.

The Obsidian tools use this vault by default:

```text
/Users/dmitriy.vrnn/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian-dev/dev
```

Override it with `OBSIDIAN_VAULT_PATH` if you need another vault:

```bash
OBSIDIAN_VAULT_PATH="/path/to/vault" bun src/index.ts
```

Note paths are always relative to the vault, and `../` path traversal is rejected.

On macOS, the MCP client process may need privacy permissions for iCloud Drive/Documents access. If a vault tool returns `Operation not permitted`, grant filesystem access to the app or terminal that launches the MCP server.

## TODO report

Ask an MCP client to call `repo_collect_todos_to_obsidian` with optional arguments:

```json
{
  "repoPath": "/Users/dmitriy.vrnn/HomeProjects/ai-less",
  "outputNotePath": "Code/TODO Report",
  "fileLimit": 5000,
  "itemLimit": 500
}
```

The tool overwrites the output note and groups findings by file. Each item includes the comment kind, line number, nearest detected function/class, and a short code snippet.

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

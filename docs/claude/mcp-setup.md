# MCP Server Setup Guide

## Required API Keys

Add to your `.env` file:

```bash
# MCP Server API Keys
TWENTYFIRST_API_KEY=your_21st_dev_key_here   # magic server
TAVILY_API_KEY=your_tavily_key_here          # tavily server
MORPH_API_KEY=your_morph_key_here            # Optional
```

**Get API Keys**:
- 21st.dev Magic: https://21st.dev
- Tavily: https://tavily.com
- Morph LLM: https://morph.so

## MCP Server Details

### codex-cli
- **Purpose**: Code snippets and developer utilities
- **No API Key Required**
- **Command**: `npx -y codex-mcp-server`

### context7
- **Purpose**: Semantic code search and context retrieval
- **No API Key Required**
- **Command**: `npx -y @upstash/context7-mcp@latest`

### magic (21st.dev)
- **Purpose**: UI component library and generation
- **API Key Required**: `TWENTYFIRST_API_KEY`
- **Command**: `npx -y @21st-dev/magic`

### tavily
- **Purpose**: Web search for documentation and research
- **API Key Required**: `TAVILY_API_KEY`
- **Command**: `npx -y @tavily/mcp`

### playwright
- **Purpose**: Browser automation and testing
- **No API Key Required**
- **Command**: `npx -y @anthropic-ai/mcp-server-playwright`

### serena (Optional)
- **Purpose**: IDE assistant with context-aware suggestions
- **Requirement**: Python with `uvx` installed
- **Command**: `uvx serena-mcp-server`

### filesystem (Disabled by Default)
- **Purpose**: Direct filesystem access beyond workspace
- **Path**: `/Users/younghwankang/Work`
- **Enable only when needed for security**

## Enabling/Disabling Servers

Edit `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "server-name": {
      "disabled": true  // Change to false to enable
    }
  }
}
```

## Verification

```bash
# Check MCP server status
claude-code mcp list
```

## Troubleshooting

### Server Not Starting
1. Check Node.js version (18+)
2. Verify API keys in `.env`
3. Check Claude Code logs

### Authentication Errors
1. Verify API key is correct
2. Remove extra spaces/quotes
3. Restart Claude Code

## Security Notes

- Never commit API keys to version control
- Use `${VARIABLE_NAME}` syntax in mcp.json
- Disable filesystem server unless needed

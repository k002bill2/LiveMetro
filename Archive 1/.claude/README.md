# Claude Code MCP Configuration

This directory contains Model Context Protocol (MCP) server configurations for Claude Code.

## What is MCP?

Model Context Protocol (MCP) allows Claude Code to connect to external tools and services, extending its capabilities beyond the built-in tools.

## Configured MCP Servers

### 1. **codex-cli** ✅ Enabled
- **Purpose**: Code snippet and developer tool access
- **No API Key Required**
- **Usage**: Provides access to code examples and development utilities

### 2. **context7** ✅ Enabled
- **Purpose**: Upstash Context7 for semantic code search and context retrieval
- **No API Key Required**
- **Usage**: Enhanced codebase understanding and semantic search

### 3. **magic** ✅ Enabled
- **Purpose**: 21st.dev Magic UI component library
- **API Key Required**: `TWENTYFIRST_API_KEY`
- **Usage**: Access to pre-built React components and UI patterns
- **Get API Key**: https://21st.dev

### 4. **tavily** ✅ Enabled
- **Purpose**: Web search and research capabilities
- **API Key Required**: `TAVILY_API_KEY`
- **Usage**: Real-time web search for documentation, APIs, and current information
- **Get API Key**: https://tavily.com

### 5. **morphllm-fast-apply** ⏸️ Disabled
- **Purpose**: Morph LLM fast code application and generation
- **API Key Required**: `MORPH_API_KEY`
- **Usage**: Rapid code generation and transformation
- **Get API Key**: https://morph.so
- **Status**: Currently disabled - enable in `mcp.json` when needed

### 6. **playwright** ✅ Enabled
- **Purpose**: Browser automation and testing
- **No API Key Required**
- **Usage**: Web scraping, automated testing, and browser interaction

### 7. **serena** ✅ Enabled
- **Purpose**: IDE assistant with context-aware suggestions
- **No API Key Required**
- **Requirement**: Python with `uvx` installed
- **Usage**: Enhanced IDE integration and contextual assistance

### 8. **filesystem** ⏸️ Disabled
- **Purpose**: Direct filesystem access beyond workspace
- **No API Key Required**
- **Path**: `/Users/younghwankang/Work`
- **Status**: Disabled for security - enable only when needed

## Setup Instructions

### 1. Install Required API Keys

Add the following to your `.env` file in the project root:

```bash
# MCP Server API Keys
TWENTYFIRST_API_KEY=your_21st_dev_key_here
TAVILY_API_KEY=your_tavily_key_here
MORPH_API_KEY=your_morph_key_here  # Optional
```

### 2. Restart Claude Code

After adding API keys, restart Claude Code for changes to take effect:

```bash
# If using CLI
claude-code restart

# Or simply close and reopen your IDE
```

### 3. Verify MCP Servers

You can verify that MCP servers are running by checking Claude Code's status:

```bash
claude-code mcp list
```

## Enabling/Disabling Servers

To enable or disable a server, edit [mcp.json](mcp.json):

```json
{
  "mcpServers": {
    "server-name": {
      "disabled": true  // Change to false to enable
    }
  }
}
```

## Security Notes

- **API Keys**: Never commit API keys to version control. They are loaded from `.env`
- **Filesystem Server**: Disabled by default for security. Only enable when you need access outside the workspace
- **Environment Variables**: Use `${VARIABLE_NAME}` syntax in `mcp.json` to reference `.env` variables

## Troubleshooting

### Server Not Starting

1. Check that required dependencies are installed:
   ```bash
   # For npx-based servers (most)
   node --version  # Should be 18+

   # For serena
   python3 --version
   pip install uv
   ```

2. Verify API keys are set in `.env`

3. Check Claude Code logs for error messages

### API Key Issues

If you see authentication errors:
- Verify the API key is correct in `.env`
- Ensure there are no extra spaces or quotes
- Restart Claude Code after changing `.env`

## Useful MCP Servers for LiveMetro

Given this is a React Native/Expo project, the most useful servers are:

1. **magic**: For UI component generation (React components)
2. **tavily**: For researching React Native/Expo documentation
3. **playwright**: For testing web versions of the app
4. **context7**: For better codebase understanding
5. **codex-cli**: For code snippet reference

## Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Claude Code MCP Guide](https://docs.anthropic.com/claude/docs/mcp)
- [Available MCP Servers](https://github.com/modelcontextprotocol/servers)

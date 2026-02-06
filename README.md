# Prompt Enhancement MCP Server

An MCP (Model Context Protocol) server that enhances user prompts using AI. It takes a rough prompt and returns a more detailed, clear, and effective version. Works with any MCP-compatible client like Claude Desktop or Claude Code.

## Quick Start

1. Install and set your API key:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Add to your MCP client config (e.g. Claude Desktop):
   ```json
   {
     "mcpServers": {
       "prompt-enhancer": {
         "command": "npx",
         "args": ["-y", "prompt-enhancement-mcp-server"],
         "env": {
           "ANTHROPIC_API_KEY": "your-key-here"
         }
       }
     }
   }
   ```

3. Use the `enhance_prompt` tool to improve any prompt.

## Installation

```bash
# Run directly with npx (recommended)
npx -y prompt-enhancement-mcp-server

# Or install globally
npm install -g prompt-enhancement-mcp-server

# Or install locally
npm install prompt-enhancement-mcp-server
```

## Supported Providers

| Provider | Env Variable | Default Model |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5-20250929` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| OpenRouter | `OPENROUTER_API_KEY` | `anthropic/claude-sonnet-4-5-20250929` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| OpenAI-compatible | `OPENAI_COMPATIBLE_API_KEY` | `gpt-3.5-turbo` |

Set at least one API key as an environment variable.

## Configuration

### Environment Variables

```bash
# API keys (set at least one)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
GEMINI_API_KEY=...

# Optional settings
PROMPT_ENHANCER_DEFAULT_PROVIDER=anthropic   # Which provider to use by default
PROMPT_ENHANCER_CONFIG=/path/to/config.json  # Custom config file path
PROMPT_ENHANCER_LOG_LEVEL=info               # debug, info, warn, error
```

### Optional Config File

Create `~/.config/prompt-enhancer/config.json` for model defaults, custom templates, or OpenAI-compatible endpoints:

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "model": "claude-sonnet-4-5-20250929",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "openai": {
      "model": "gpt-4o"
    },
    "openrouter": {
      "model": "anthropic/claude-sonnet-4-5-20250929",
      "baseUrl": "https://openrouter.ai/api/v1"
    },
    "gemini": {
      "model": "gemini-2.0-flash"
    }
  },
  "templates": {
    "default": "Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):\n\n${userInput}"
  },
  "options": {
    "maxContextMessages": 10,
    "contextTruncateLength": 500
  }
}
```

API keys are **never** stored in the config file -- always use environment variables.

## Tool: `enhance_prompt`

The server exposes a single MCP tool:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | The prompt text to enhance |
| `provider` | string | No | Provider to use (`anthropic`, `openai`, `openrouter`, `gemini`, `openai-compatible`) |
| `model` | string | No | Model override (e.g. `gpt-4-turbo`) |
| `context` | array | No | Conversation history (`[{role, content}]`) for context |
| `template` | string | No | Custom template. Use `${userInput}` as placeholder |

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "prompt-enhancer": {
      "command": "npx",
      "args": ["-y", "prompt-enhancement-mcp-server"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Claude Code Integration

Add to `~/.claude/claude_code_config.json` or your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "prompt-enhancer": {
      "command": "npx",
      "args": ["-y", "prompt-enhancement-mcp-server"],
      "env": {
        "OPENAI_API_KEY": "your-key-here",
        "PROMPT_ENHANCER_DEFAULT_PROVIDER": "openai"
      }
    }
  }
}
```

## Custom Templates

Override the default enhancement template via the config file or the `template` tool parameter:

```json
{
  "templates": {
    "default": "Rewrite this prompt to be more specific and actionable:\n\n${userInput}"
  }
}
```

Or pass inline when calling the tool:

```json
{
  "text": "write a web app",
  "template": "Add technical details and edge cases to this prompt:\n\n${userInput}"
}
```

## OpenAI-Compatible Endpoints

Connect to Ollama, LM Studio, vLLM, or any OpenAI-compatible API:

```json
{
  "providers": {
    "openai-compatible": {
      "baseUrl": "http://localhost:11434/v1",
      "model": "llama3"
    }
  }
}
```

Then use it:
```json
{
  "text": "write a function",
  "provider": "openai-compatible"
}
```

## Troubleshooting

**"Unsupported provider" error**
Check that the provider name is one of: `anthropic`, `openai`, `openrouter`, `gemini`, `openai-compatible`.

**"API key is required" / authentication errors**
Make sure the corresponding environment variable is set. API keys are loaded from env vars, not the config file.

**Timeouts or rate limit errors**
The server retries transient errors up to 3 times with exponential backoff. If you're consistently hitting rate limits, try a different provider or model.

**No output / server won't start**
Check `PROMPT_ENHANCER_LOG_LEVEL=debug` for detailed logging. Logs go to stderr (MCP protocol reserves stdout for communication).

## Development

```bash
git clone <repo-url>
cd prompt-enhancement-mcp-server
npm install
npm run build
npm test
```

## License

Apache-2.0

# Configuration Reference

## Configuration Sources

The server reads configuration from three sources, merged in this priority order:

| Priority | Source | What it controls |
|---|---|---|
| **1 (highest)** | Tool arguments | `provider`, `model`, `template` per-request |
| **2** | Environment variables | API keys, default provider, log level, config path |
| **3** | Config file | Provider defaults, models, templates, context options |
| **4 (lowest)** | Built-in defaults | Fallback values for everything |

## Environment Variables

### API Keys

Set at least one. These are the **only** way to provide API keys (never put keys in the config file).

| Variable | Provider | Example |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic | `sk-ant-api03-...` |
| `OPENAI_API_KEY` | OpenAI | `sk-...` |
| `OPENROUTER_API_KEY` | OpenRouter | `sk-or-v1-...` |
| `GEMINI_API_KEY` | Gemini | `AIza...` |
| `OPENAI_COMPATIBLE_API_KEY` | OpenAI-compatible endpoints | varies |

### Server Settings

| Variable | Default | Description |
|---|---|---|
| `PROMPT_ENHANCER_DEFAULT_PROVIDER` | `anthropic` | Which provider to use when none specified in the tool call. Overrides config file's `defaultProvider`. |
| `PROMPT_ENHANCER_CONFIG` | `~/.config/prompt-enhancer/config.json` | Path to the JSON config file. |
| `PROMPT_ENHANCER_LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error`. |

## Config File

The config file is **optional**. The server works with just environment variables.

**Default location:** `~/.config/prompt-enhancer/config.json`

**Override location:** Set `PROMPT_ENHANCER_CONFIG=/path/to/config.json`

### Full Schema

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "<provider-name>": {
      "model": "string",
      "temperature": 0.7,
      "maxTokens": 4096,
      "baseUrl": "string"
    }
  },
  "templates": {
    "default": "string with ${userInput} placeholder"
  },
  "options": {
    "maxContextMessages": 10,
    "contextTruncateLength": 500
  }
}
```

### Field Reference

#### `defaultProvider`

- **Type:** `string`
- **Default:** `"anthropic"`
- **Description:** Which provider to use when the tool call doesn't specify one.
- **Overridden by:** `PROMPT_ENHANCER_DEFAULT_PROVIDER` env var, or `provider` tool argument.

#### `providers`

A map of provider configurations. Keys are provider names.

| Field | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | per-provider | Model ID to use. Overridden by tool `model` argument. |
| `temperature` | `number` | `0.7` | Sampling temperature (0.0 - 2.0). |
| `maxTokens` | `number` | `4096` | Maximum tokens in the response. |
| `baseUrl` | `string` | per-provider | API base URL. Required for `openai-compatible`. |

**Provider-specific defaults:**

| Provider | Default Model | Default Base URL |
|---|---|---|
| `anthropic` | `claude-sonnet-4-5-20250929` | Anthropic default |
| `openai` | `gpt-4o` | `https://api.openai.com/v1` |
| `openrouter` | `anthropic/claude-sonnet-4-5-20250929` | `https://openrouter.ai/api/v1` |
| `gemini` | `gemini-2.0-flash` | Google default |
| `openai-compatible` | `gpt-3.5-turbo` | **must be configured** |

#### `templates`

| Field | Type | Default | Description |
|---|---|---|---|
| `default` | `string` | Built-in ENHANCE template | The prompt template. Must include `${userInput}` as placeholder. |

**Built-in default template:**
```
Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):

${userInput}
```

#### `options`

| Field | Type | Default | Description |
|---|---|---|---|
| `maxContextMessages` | `number` | `10` | Maximum number of context messages to include (takes the most recent). |
| `contextTruncateLength` | `number` | `500` | Maximum characters per context message before truncation. |

## Example Configurations

### Minimal (env vars only)

No config file needed:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

The server will use Anthropic with `claude-sonnet-4-5-20250929` and all defaults.

### OpenAI as default

```bash
export OPENAI_API_KEY=sk-...
export PROMPT_ENHANCER_DEFAULT_PROVIDER=openai
```

### Local Ollama

```bash
# No API key needed for local Ollama
export PROMPT_ENHANCER_DEFAULT_PROVIDER=openai-compatible
```

Config file (`~/.config/prompt-enhancer/config.json`):
```json
{
  "defaultProvider": "openai-compatible",
  "providers": {
    "openai-compatible": {
      "baseUrl": "http://localhost:11434/v1",
      "model": "llama3"
    }
  }
}
```

### Multiple providers with custom template

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

Config file:
```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "model": "claude-sonnet-4-5-20250929",
      "temperature": 0.5,
      "maxTokens": 2048
    },
    "openai": {
      "model": "gpt-4-turbo",
      "temperature": 0.8
    }
  },
  "templates": {
    "default": "You are a prompt engineering expert. Rewrite this prompt to be more specific, detailed, and effective. Return only the improved prompt, nothing else.\n\n${userInput}"
  },
  "options": {
    "maxContextMessages": 5,
    "contextTruncateLength": 300
  }
}
```

## Configuration Loading Behavior

1. Built-in defaults are applied first
2. If `PROMPT_ENHANCER_DEFAULT_PROVIDER` is set, it overrides `defaultProvider`
3. The config file path is resolved from `PROMPT_ENHANCER_CONFIG` or the default path
4. If the config file exists and is valid JSON:
   - Its fields are merged with defaults (shallow merge per top-level key)
   - `providers`, `templates`, `options` from the file extend (not replace) defaults
5. If the config file doesn't exist: defaults are used silently (debug log only)
6. If the config file has invalid JSON: a warning is logged, defaults are used
7. `PROMPT_ENHANCER_DEFAULT_PROVIDER` is re-applied after file loading (env always wins)

## Security Notes

- **API keys are never stored in the config file.** They come exclusively from environment variables.
- The config file should not be committed to version control if it contains sensitive base URLs or internal model names. Add it to `.gitignore`.
- When using MCP client configs (Claude Desktop, Claude Code), API keys are passed via the `env` field in the server configuration, which keeps them out of the server's own config file.

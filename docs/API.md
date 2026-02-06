# API Reference

## MCP Tool: `enhance_prompt`

The server exposes a single MCP tool that enhances user prompts using AI.

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "The prompt text to enhance"
    },
    "provider": {
      "type": "string",
      "description": "AI provider to use (optional, uses default if not specified)",
      "enum": ["anthropic", "openai", "openrouter", "gemini", "openai-compatible"]
    },
    "model": {
      "type": "string",
      "description": "Model to use, overriding provider default (optional)"
    },
    "context": {
      "type": "array",
      "description": "Optional conversation history for context",
      "items": {
        "type": "object",
        "properties": {
          "role": {
            "type": "string",
            "enum": ["user", "assistant"]
          },
          "content": {
            "type": "string"
          }
        },
        "required": ["role", "content"]
      }
    },
    "template": {
      "type": "string",
      "description": "Custom enhancement template. Use ${userInput} as placeholder. (optional)"
    }
  },
  "required": ["text"]
}
```

### Parameters

#### `text` (required)

The prompt to enhance. This is the raw user input that will be improved.

**Example:** `"write a python function"`

#### `provider` (optional)

Which AI provider to use. If omitted, uses the default from config/env.

**Valid values:** `"anthropic"`, `"openai"`, `"openrouter"`, `"gemini"`, `"openai-compatible"`

**Example:** `"openai"`

#### `model` (optional)

Override the provider's default model. The model ID must be valid for the chosen provider.

**Examples:**
- Anthropic: `"claude-opus-4-20250514"`
- OpenAI: `"gpt-4-turbo"`
- OpenRouter: `"meta-llama/llama-3-70b-instruct"`
- Gemini: `"gemini-1.5-pro"`

#### `context` (optional)

Conversation history to provide context for the enhancement. The server takes the last N messages (default 10), truncates each to 500 chars, and appends them to the prompt.

**Example:**
```json
[
  { "role": "user", "content": "I'm building a REST API for a todo app" },
  { "role": "assistant", "content": "I can help with that. What framework?" },
  { "role": "user", "content": "Express with TypeScript" }
]
```

#### `template` (optional)

Custom template for the enhancement prompt. Must include `${userInput}` as a placeholder where the user's text will be inserted.

**Example:** `"Rewrite this as a detailed technical specification:\n\n${userInput}"`

### Response

#### Success

```json
{
  "content": [
    {
      "type": "text",
      "text": "The enhanced prompt text from the AI provider"
    }
  ],
  "_meta": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

#### Error

```json
{
  "content": [
    {
      "type": "text",
      "text": "Enhancement failed: The selected API provider returned an error..."
    }
  ],
  "isError": true
}
```

### Error Codes

MCP protocol errors (thrown as `McpError`):

| Code | Condition |
|---|---|
| `MethodNotFound` (-32601) | Tool name is not `enhance_prompt` |
| `InvalidParams` (-32602) | `text` parameter is missing or not a string |

Service errors (returned with `isError: true`):

| Message pattern | Cause |
|---|---|
| `Unsupported provider: {name}` | Invalid provider name in `provider` parameter |
| `Gemini API key is required` | No `GEMINI_API_KEY` env var set when using Gemini |
| `{Provider} completion error: ...` | API call failed after all retries |

## TypeScript Interfaces

All types are defined in `src/types.ts`.

### `PromptEnhancementProvider`

The interface that all AI provider implementations must satisfy.

```typescript
interface PromptEnhancementProvider {
  readonly name: string;
  readonly model: string;
  completePrompt(prompt: string): Promise<string>;
}
```

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Provider identifier (e.g. `"anthropic"`, `"openai"`) |
| `model` | `string` | Model being used (e.g. `"gpt-4o"`) |
| `completePrompt` | `(prompt: string) => Promise<string>` | Send a prompt and get text back |

### `ProviderConfig`

Configuration passed to provider constructors.

```typescript
interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string?` | from env | API key for authentication |
| `baseUrl` | `string?` | per-provider | API endpoint URL |
| `model` | `string?` | per-provider | Model identifier |
| `temperature` | `number?` | `0.7` | Sampling temperature |
| `maxTokens` | `number?` | `4096` | Maximum response tokens |

### `Config`

Top-level application configuration.

```typescript
interface Config {
  defaultProvider: string;
  providers?: Record<string, ProviderConfig>;
  templates?: Record<string, string>;
  options?: {
    maxContextMessages?: number;
    contextTruncateLength?: number;
  };
}
```

### `EnhanceOptions`

Input to the enhancement service (maps 1:1 with tool arguments).

```typescript
interface EnhanceOptions {
  text: string;
  provider?: string;
  model?: string;
  context?: ContextMessage[];
  template?: string;
}
```

### `EnhanceResult`

Output from the enhancement service.

```typescript
interface EnhanceResult {
  success: boolean;
  enhancedText: string;
  provider: string;
  model: string;
}
```

### `ContextMessage`

A single message in the conversation history.

```typescript
interface ContextMessage {
  role: "user" | "assistant";
  content: string;
}
```

## Exported Functions

### `createProvider(name, config, modelOverride?)`

Factory function that instantiates the correct provider class.

**File:** `src/providers/index.ts`

```typescript
function createProvider(
  name: string,
  config: Config,
  modelOverride?: string
): PromptEnhancementProvider
```

**Parameters:**
- `name` -- Provider identifier (must match a known provider)
- `config` -- Full application config
- `modelOverride` -- Optional model ID that takes precedence over config

**Throws:** `Error` if provider name is not recognized.

### `loadConfig()`

Loads and merges configuration from defaults, config file, and env vars.

**File:** `src/config.ts`

```typescript
function loadConfig(): Config
```

**Never throws.** Returns valid config even if the config file is missing or malformed.

### `getApiKeyFromEnv(providerName)`

Maps a provider name to its environment variable and returns the value.

**File:** `src/config.ts`

```typescript
function getApiKeyFromEnv(providerName: string): string | undefined
```

### `getDefaultModel(providerName)`

Returns the built-in default model for a provider.

**File:** `src/config.ts`

```typescript
function getDefaultModel(providerName: string): string
```

### `withRetry(fn, maxRetries?, baseDelay?)`

Executes an async function with retry and exponential backoff.

**File:** `src/providers/base-provider.ts`

```typescript
function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries?: number,   // default: 3
  baseDelay?: number     // default: 1000ms
): Promise<T>
```

**Retry behavior:**
- Retries on any error except HTTP 401, 403, 400
- Delay formula: `baseDelay * 2^attempt` (1s, 2s, 4s, ...)
- Throws the last error after all retries exhausted

### `startServer()`

Creates and starts the MCP server.

**File:** `src/server.ts`

```typescript
function startServer(): Promise<void>
```

Loads config, creates the enhancement service, registers MCP handlers, and connects the stdio transport. Resolves when the server is connected.

## Provider Classes

### `AnthropicProvider`

**File:** `src/providers/anthropic.ts`

```typescript
class AnthropicProvider implements PromptEnhancementProvider {
  constructor(config: ProviderConfig)
}
```

### `OpenAiCompatibleProvider`

**File:** `src/providers/openai-compatible.ts`

```typescript
class OpenAiCompatibleProvider implements PromptEnhancementProvider {
  constructor(name: string, config: ProviderConfig)
}
```

The `name` parameter allows this class to be reused for `"openai"`, `"openrouter"`, and `"openai-compatible"`.

### `GeminiProvider`

**File:** `src/providers/gemini.ts`

```typescript
class GeminiProvider implements PromptEnhancementProvider {
  constructor(config: ProviderConfig)
}
```

Throws `Error("Gemini API key is required")` if `config.apiKey` is falsy.

### `EnhancementService`

**File:** `src/services/enhancement-service.ts`

```typescript
class EnhancementService {
  constructor(config: Config)
  enhance(options: EnhanceOptions): Promise<EnhanceResult>
}
```

The service is stateless -- the `Config` is read-only after construction. Each `enhance()` call creates a new provider instance via the factory.

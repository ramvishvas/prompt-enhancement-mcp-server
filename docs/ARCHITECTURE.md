# Architecture

## System Overview

The Prompt Enhancement MCP Server is a standalone service that receives prompts from MCP clients, enhances them using AI provider APIs, and returns the improved prompts. It follows a layered architecture with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────┐
│                     MCP Client                          │
│          (Claude Desktop, Claude Code, etc.)            │
└──────────────────────┬──────────────────────────────────┘
                       │ stdio (JSON-RPC over stdin/stdout)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   MCP Server Layer                       │
│                    (server.ts)                           │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  ListTools       │  │  CallTool                    │  │
│  │  Handler         │  │  Handler                     │  │
│  │  (tool schema)   │  │  (validation + dispatch)     │  │
│  └─────────────────┘  └──────────────┬───────────────┘  │
└──────────────────────────────────────┼──────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│             (enhancement-service.ts)                     │
│                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │  Context      │  │  Template     │  │  Provider    │  │
│  │  Preparation  │  │  Application  │  │  Delegation  │  │
│  └──────────────┘  └───────────────┘  └──────┬───────┘  │
└──────────────────────────────────────────────┼──────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────┐
│                  Provider Layer                           │
│               (providers/index.ts)                        │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │              createProvider() Factory             │    │
│  └──────┬────────┬────────┬────────┬───────┬────────┘    │
│         │        │        │        │       │             │
│         ▼        ▼        ▼        ▼       ▼             │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │Anthropic │ │OpenAI│ │Open  │ │Gemini│ │OpenAI    │  │
│  │Provider  │ │      │ │Router│ │      │ │Compatible│  │
│  └────┬─────┘ └──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘  │
│       │          │        │        │           │         │
│       │     ┌────┴────────┴────────┴───────────┘         │
│       │     │  All use withRetry() from base-provider.ts │
│       │     └────────────────────────────────────────────│
└───────┼──────────┼────────┼────────┼──────────────────────┘
        │          │        │        │
        ▼          ▼        ▼        ▼
   Claude API  OpenAI   OpenRouter  Gemini     Any OpenAI-
               API      API         API        compatible API
```

## Layer Responsibilities

### 1. Entry Point (`index.ts`)

The executable entry point. Has a `#!/usr/bin/env node` shebang for CLI usage. Calls `startServer()` and handles fatal startup errors with `process.exit(1)`.

### 2. MCP Server Layer (`server.ts`)

Handles MCP protocol concerns:

- Creates `Server` instance from `@modelcontextprotocol/sdk`
- Registers tool definitions via `ListToolsRequestSchema`
- Handles tool calls via `CallToolRequestSchema`
- Input validation (tool name, required `text` parameter)
- Error wrapping (McpError for protocol errors, `isError: true` for service errors)
- Connects stdio transport (stdin/stdout for JSON-RPC, stderr for logs)

The server layer **never** touches AI providers directly. It delegates everything to `EnhancementService`.

### 3. Service Layer (`enhancement-service.ts`)

Core business logic:

- Prepares input text with optional conversation context
- Resolves and applies enhancement templates
- Selects provider via factory function
- Returns structured `EnhanceResult`

The service layer is **provider-agnostic**. It works with the `PromptEnhancementProvider` interface and doesn't import any SDK directly.

### 4. Provider Layer (`providers/`)

Handles external API communication:

- `base-provider.ts` - Shared `withRetry()` function with exponential backoff
- `openai-compatible.ts` - Base class for OpenAI-format APIs (OpenAI, OpenRouter, Ollama, etc.)
- `anthropic.ts` - Anthropic Claude SDK integration
- `gemini.ts` - Google GenAI SDK integration
- `index.ts` - Factory function that resolves config and instantiates the right provider

### 5. Configuration Layer (`config.ts`)

Handles all configuration resolution:

- Loads environment variables
- Reads optional JSON config file
- Provides defaults for all settings
- Maps provider names to env var names and default models

### 6. Utilities (`utils/`)

Cross-cutting concerns:

- `logger.ts` - Level-filtered stderr logging

## Complete Request Flow

```
1. MCP Client sends CallTool request via stdin
   {
     "method": "tools/call",
     "params": {
       "name": "enhance_prompt",
       "arguments": {
         "text": "write a web app",
         "provider": "openai",
         "model": "gpt-4-turbo",
         "context": [{ "role": "user", "content": "..." }],
         "template": "Make this better: ${userInput}"
       }
     }
   }

2. server.ts: CallToolRequestSchema handler
   ├── Validates tool name == "enhance_prompt"
   ├── Validates args.text exists and is string
   └── Calls enhancementService.enhance(args)

3. enhancement-service.ts: enhance()
   ├── prepareInput("write a web app", context)
   │   ├── Slices context to last 10 messages
   │   ├── Truncates each to 500 chars
   │   ├── Formats: "user: ...\nassistant: ..."
   │   └── Returns: "write a web app\n\nUse the following...\nuser: ..."
   │
   ├── Apply template
   │   ├── Selects "Make this better: ${userInput}" (from args)
   │   └── Replaces ${userInput} with prepared input
   │
   ├── createProvider("openai", config, "gpt-4-turbo")
   │   ├── Reads config.providers.openai
   │   ├── Gets OPENAI_API_KEY from env
   │   ├── Resolves model: "gpt-4-turbo" (override)
   │   └── Returns new OpenAiCompatibleProvider("openai", resolvedConfig)
   │
   └── provider.completePrompt(finalPrompt)
       └── withRetry(() => client.chat.completions.create(...))
           ├── Attempt 1: success → return text
           ├── Attempt 1: fail (500) → wait 1s
           ├── Attempt 2: success → return text
           ├── Attempt 2: fail (500) → wait 2s
           ├── Attempt 3: success → return text
           ├── Attempt 3: fail → wait 4s
           └── Attempt 4: fail → throw error
           NOTE: 401/403/400 → throw immediately, no retry

4. server.ts: Returns MCP response via stdout
   {
     "content": [{ "type": "text", "text": "Enhanced prompt..." }],
     "_meta": { "provider": "openai", "model": "gpt-4-turbo" }
   }
```

## Configuration Resolution

Configuration is resolved with a clear priority chain:

```
Priority (highest to lowest):
┌─────────────────────────────┐
│  1. Tool arguments          │  provider, model, template
│     (per-request)           │
├─────────────────────────────┤
│  2. Environment variables   │  API keys, default provider,
│     (process-level)         │  log level, config path
├─────────────────────────────┤
│  3. Config file             │  ~/.config/prompt-enhancer/
│     (user-level)            │  config.json
├─────────────────────────────┤
│  4. Built-in defaults       │  Hardcoded in config.ts
│     (code-level)            │
└─────────────────────────────┘
```

Specific resolution for each parameter:

| Parameter | Tool arg | Env var | Config file | Default |
|---|---|---|---|---|
| Provider | `provider` | `PROMPT_ENHANCER_DEFAULT_PROVIDER` | `defaultProvider` | `"anthropic"` |
| Model | `model` | - | `providers.{name}.model` | per-provider defaults |
| API Key | - | `{PROVIDER}_API_KEY` | - | none (required) |
| Template | `template` | - | `templates.default` | built-in ENHANCE template |
| Temperature | - | - | `providers.{name}.temperature` | `0.7` |
| Max Tokens | - | - | `providers.{name}.maxTokens` | `4096` |

## Error Handling Strategy

Errors are handled differently at each layer:

```
┌─────────────────────────────────────────┐
│  Config Layer                           │
│  • Never throws                         │
│  • Logs warnings, falls back to defaults│
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Provider Layer                         │
│  • Retries transient errors (3x)        │
│  • Fails fast on 401/403/400            │
│  • Throws after all retries exhausted   │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Service Layer                          │
│  • No try/catch (lets errors propagate) │
│  • Logs enhancement attempts            │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Server Layer                           │
│  • Validation errors → McpError (throw) │
│  • Service errors → { isError: true }   │
│  • Never crashes the process            │
└─────────────────────────────────────────┘
```

## Key Design Decisions

### Why one tool, not multiple?

The `enhance_prompt` tool is the only value proposition. Adding `validate_config` or MCP resources would increase complexity without benefiting most users. These are deferred to v1.1+.

### Why env vars for API keys, not config file?

Security. Config files can be accidentally committed to version control. Environment variables are the standard for secrets in MCP server configurations (Claude Desktop passes them via the `env` field).

### Why `OpenAiCompatibleProvider` as a base class?

Many LLM providers expose OpenAI-compatible APIs (OpenRouter, Ollama, LM Studio, vLLM, Together AI, Groq). A single base class with configurable `baseUrl` covers all of them, making it trivial to add new providers.

### Why `withRetry` as a standalone function, not a base class method?

Anthropic and Gemini providers use different SDKs with different error shapes. A standalone function keeps retry logic reusable without forcing inheritance. Each provider wraps its own `completePrompt` call.

### Why stderr for logging?

MCP protocol uses stdout for JSON-RPC communication. Any non-JSON output on stdout would break the protocol. All logging must go to stderr.

## File Dependency Graph

```
index.ts
  └── server.ts
        ├── config.ts
        │     └── utils/logger.ts
        ├── services/enhancement-service.ts
        │     ├── types.ts
        │     ├── providers/index.ts
        │     │     ├── providers/anthropic.ts
        │     │     │     ├── types.ts
        │     │     │     └── providers/base-provider.ts
        │     │     │           └── utils/logger.ts
        │     │     ├── providers/openai-compatible.ts
        │     │     │     ├── types.ts
        │     │     │     └── providers/base-provider.ts
        │     │     ├── providers/gemini.ts
        │     │     │     ├── types.ts
        │     │     │     └── providers/base-provider.ts
        │     │     └── config.ts
        │     └── utils/logger.ts
        ├── types.ts
        └── utils/logger.ts
```

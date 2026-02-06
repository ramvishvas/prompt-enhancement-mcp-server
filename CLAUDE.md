# CLAUDE.md -- AI/Developer Context for Prompt Enhancement MCP Server

## What This Project Is

An MCP (Model Context Protocol) server that enhances user prompts using AI. Clients like Claude Desktop or Claude Code send a rough prompt via the `enhance_prompt` tool, and the server returns an improved, more detailed version using one of 4 AI providers (Anthropic, OpenAI, OpenRouter, Gemini) or any OpenAI-compatible endpoint.

## Quick Orientation

```
src/index.ts          → Entry point. Calls startServer().
src/server.ts         → MCP server. Registers enhance_prompt tool. Validates input. Delegates to EnhancementService.
src/config.ts         → Loads config from env vars + optional JSON file. Never throws.
src/types.ts          → All interfaces: Config, ProviderConfig, EnhanceOptions, EnhanceResult, ContextMessage, PromptEnhancementProvider.
src/services/enhancement-service.ts → Core logic. Prepares input (context formatting), applies template, calls provider.
src/providers/index.ts              → createProvider() factory. Resolves config, picks the right class.
src/providers/base-provider.ts      → withRetry() -- exponential backoff (1s, 2s, 4s). Skips retry on 401/403/400.
src/providers/anthropic.ts          → AnthropicProvider. Uses @anthropic-ai/sdk.
src/providers/openai-compatible.ts  → OpenAiCompatibleProvider. Base class for OpenAI, OpenRouter, any OpenAI-format API.
src/providers/gemini.ts             → GeminiProvider. Uses @google/generative-ai. Requires API key.
src/utils/logger.ts                 → Logs to stderr. Level controlled by PROMPT_ENHANCER_LOG_LEVEL env var.
```

## Key Concepts

### Data Flow

```
MCP Client → stdin → server.ts (validate) → EnhancementService.enhance() → createProvider() → provider.completePrompt() → AI API → response → stdout → MCP Client
```

### Configuration Priority

Tool args > env vars > config file (~/.config/prompt-enhancer/config.json) > built-in defaults.

API keys ONLY come from env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_COMPATIBLE_API_KEY).

### Template System

Default template: `"Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):\n\n${userInput}"`

Template resolution: tool `template` arg > config `templates.default` > hardcoded DEFAULT_ENHANCE_TEMPLATE.

`${userInput}` is replaced via simple string `.replace()`.

### Context Processing

If `context` array is provided, messages are: sliced to last `maxContextMessages` (default 10), truncated to `contextTruncateLength` chars (default 500), formatted as `"role: content"`, and appended to the text with a header line.

### Provider System

All providers implement `PromptEnhancementProvider` interface (name, model, completePrompt). Factory function `createProvider(name, config, modelOverride?)` in `src/providers/index.ts` handles instantiation. OpenAI, OpenRouter, and openai-compatible all use the same `OpenAiCompatibleProvider` class with different names and base URLs.

### Retry

`withRetry(fn, maxRetries=3, baseDelay=1000)` in `src/providers/base-provider.ts`. Exponential backoff: 1s, 2s, 4s. Does NOT retry on 401, 403, 400 (auth/validation errors). All providers wrap their API call with this.

## How to Add a New Provider

1. Create `src/providers/{name}.ts` implementing `PromptEnhancementProvider`
2. Use `withRetry()` around the API call
3. Add case to switch in `src/providers/index.ts` `createProvider()`
4. Add `"{name}": "ENV_VAR_NAME"` to `ENV_KEY_MAP` in `src/config.ts`
5. Add `"{name}": "default-model"` to `DEFAULT_MODELS` in `src/config.ts`
6. Add to enum in tool schema in `src/server.ts`
7. Export from `src/providers/index.ts`
8. Write tests in `tests/providers/{name}.test.ts`
9. If it's OpenAI-compatible, you can skip step 1 -- just add a factory case using `OpenAiCompatibleProvider` with the correct `baseUrl`

## How to Add a New MCP Tool

1. Add tool definition to `ListToolsRequestSchema` handler in `src/server.ts`
2. Add case to `CallToolRequestSchema` handler
3. Create service method if needed
4. Write tests

## How to Modify Templates

- Change default: edit `DEFAULT_ENHANCE_TEMPLATE` in `src/services/enhancement-service.ts`
- Change resolution logic: edit the template selection in `EnhancementService.enhance()`
- The placeholder is `${userInput}` -- single replacement, no regex

## Build & Test

```bash
npm install       # Install deps
npm run build     # TypeScript → dist/
npm test          # 57 tests, all mocked (no real API calls)
npm run dev       # Watch mode
```

## Dependencies

- `@modelcontextprotocol/sdk` -- MCP protocol (server, transport, schemas)
- `@anthropic-ai/sdk` -- Anthropic Claude API
- `openai` -- OpenAI API (also used for OpenRouter and openai-compatible)
- `@google/generative-ai` -- Google Gemini API
- `vitest` -- Test runner (dev only)

## Important Constraints

- stdout is reserved for MCP JSON-RPC. All logging goes to stderr via `logger.*()`.
- API keys never go in config files -- env vars only.
- The server is stateless per-request. A new provider instance is created for each `enhance()` call.
- No streaming support. All completions are non-streaming.
- No caching. Every call hits the provider API.

## Test Patterns

- Provider SDKs are mocked at module level with `vi.mock()`
- Use `vi.clearAllMocks()` in `beforeEach` to prevent state leaking
- Test retry behavior: mock first call to reject, second to resolve
- Test non-retryable errors: set `(error as any).status = 401`
- Config tests mock `node:fs` to simulate file presence/absence

## Known Limitations (v1.0)

- No streaming responses
- No rate limit awareness (relies on retry)
- No template validation (missing `${userInput}` silently produces bad prompts)
- No provider pre-flight validation (bad API key discovered at call time)
- Single tool only (enhance_prompt)
- No MCP resources or prompts
- No caching

## Planned for v1.1+

- `validate_config` tool
- MCP Resources (config, providers, templates)
- More providers (Bedrock, Vertex, Mistral, Groq, DeepSeek)
- Provider fallback chains
- Streaming support

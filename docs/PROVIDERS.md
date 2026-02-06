# Provider System

## Overview

The provider system is the abstraction layer between the enhancement service and external AI APIs. Every provider implements the `PromptEnhancementProvider` interface and is instantiated through the `createProvider()` factory function.

## Provider Interface

Every provider must implement this interface (defined in `src/types.ts`):

```typescript
interface PromptEnhancementProvider {
  readonly name: string;    // Provider identifier (e.g. "anthropic", "openai")
  readonly model: string;   // Model being used (e.g. "gpt-4o")
  completePrompt(prompt: string): Promise<string>;  // Send prompt, get enhanced text
}
```

## Provider Hierarchy

```
PromptEnhancementProvider (interface)
├── AnthropicProvider          (standalone, uses @anthropic-ai/sdk)
├── GeminiProvider             (standalone, uses @google/generative-ai)
└── OpenAiCompatibleProvider   (base class, uses openai SDK)
    ├── "openai"               (instance with default OpenAI base URL)
    ├── "openrouter"           (instance with OpenRouter base URL)
    └── "openai-compatible"    (instance with user-provided base URL)
```

## Built-in Providers

### Anthropic

| Property | Value |
|---|---|
| **File** | `src/providers/anthropic.ts` |
| **Class** | `AnthropicProvider` |
| **SDK** | `@anthropic-ai/sdk` |
| **Env var** | `ANTHROPIC_API_KEY` |
| **Default model** | `claude-sonnet-4-5-20250929` |
| **Default temp** | `0.7` |
| **Default max tokens** | `4096` |

**API call:**
```typescript
client.messages.create({
  model: this.model,
  max_tokens: this.maxTokens,
  temperature: this.temperature,
  messages: [{ role: "user", content: prompt }],
})
```

**Response extraction:** Finds first content block with `type === "text"`, returns its `.text` property. Returns `""` if no text block found.

---

### OpenAI

| Property | Value |
|---|---|
| **File** | `src/providers/openai-compatible.ts` |
| **Class** | `OpenAiCompatibleProvider` (name: `"openai"`) |
| **SDK** | `openai` |
| **Env var** | `OPENAI_API_KEY` |
| **Default model** | `gpt-4o` |
| **Default temp** | `0.7` |
| **Default max tokens** | `4096` |

**API call:**
```typescript
client.chat.completions.create({
  model: this.model,
  max_tokens: this.maxTokens,
  temperature: this.temperature,
  messages: [{ role: "user", content: prompt }],
})
```

**Response extraction:** `response.choices[0]?.message?.content ?? ""`

---

### OpenRouter

| Property | Value |
|---|---|
| **File** | `src/providers/openai-compatible.ts` |
| **Class** | `OpenAiCompatibleProvider` (name: `"openrouter"`) |
| **SDK** | `openai` (OpenRouter is OpenAI-compatible) |
| **Env var** | `OPENROUTER_API_KEY` |
| **Default model** | `anthropic/claude-sonnet-4-5-20250929` |
| **Default base URL** | `https://openrouter.ai/api/v1` |
| **Default temp** | `0.7` |
| **Default max tokens** | `4096` |

Same API call and response extraction as OpenAI. The only difference is the `baseUrl` pointing to OpenRouter's API.

---

### Gemini

| Property | Value |
|---|---|
| **File** | `src/providers/gemini.ts` |
| **Class** | `GeminiProvider` |
| **SDK** | `@google/generative-ai` |
| **Env var** | `GEMINI_API_KEY` |
| **Default model** | `gemini-2.0-flash` |
| **Default temp** | `0.7` |
| **Default max tokens** | `4096` |
| **API key** | **Required** (throws if missing) |

**API call:**
```typescript
const model = client.getGenerativeModel({
  model: this.model,
  generationConfig: {
    temperature: this.temperature,
    maxOutputTokens: this.maxTokens,  // Note: different param name
  },
});
const result = await model.generateContent(prompt);
```

**Response extraction:** `result.response.text()`

---

### OpenAI-Compatible (Generic)

| Property | Value |
|---|---|
| **File** | `src/providers/openai-compatible.ts` |
| **Class** | `OpenAiCompatibleProvider` (name: `"openai-compatible"`) |
| **SDK** | `openai` |
| **Env var** | `OPENAI_COMPATIBLE_API_KEY` |
| **Default model** | `gpt-3.5-turbo` |
| **Base URL** | User-configured (e.g. `http://localhost:11434/v1`) |

Use this for Ollama, LM Studio, vLLM, Together AI, Groq, or any endpoint that accepts the OpenAI chat completions format.

## Retry Mechanism

All providers use the shared `withRetry()` function from `src/providers/base-provider.ts`:

```
Attempt 0: Call API
  ├── Success → return result
  └── Failure
      ├── Status 401/403/400 → throw immediately (non-retryable)
      └── Other error → wait 1000ms (baseDelay * 2^0)

Attempt 1: Call API
  ├── Success → return result
  └── Failure → wait 2000ms (baseDelay * 2^1)

Attempt 2: Call API
  ├── Success → return result
  └── Failure → wait 4000ms (baseDelay * 2^2)

Attempt 3: Call API
  ├── Success → return result
  └── Failure → throw last error (retries exhausted)
```

**Parameters:**
- `maxRetries`: 3 (total of 4 attempts)
- `baseDelay`: 1000ms
- Backoff formula: `baseDelay * 2^attempt`
- Max total wait: 1s + 2s + 4s = 7s

**Non-retryable HTTP status codes:**
- `401` - Unauthorized (bad API key)
- `403` - Forbidden (insufficient permissions)
- `400` - Bad Request (invalid parameters)

## Provider Factory

The `createProvider()` function in `src/providers/index.ts` handles provider instantiation:

```typescript
function createProvider(
  name: string,      // Provider identifier
  config: Config,    // Full application config
  modelOverride?: string  // Optional model from tool args
): PromptEnhancementProvider
```

**Resolution steps:**

1. Read provider-specific config: `config.providers[name] ?? {}`
2. Get API key from environment: `getApiKeyFromEnv(name)`
3. Build resolved config:
   - `apiKey`: env var > config file
   - `model`: tool arg (modelOverride) > config file > default
   - Other fields: config file > constructor defaults
4. Instantiate the correct class via switch statement

## How to Add a New Provider

### Step 1: Create the provider file

Create `src/providers/{name}.ts`:

```typescript
import { PromptEnhancementProvider, ProviderConfig } from "../types.js";
import { withRetry } from "./base-provider.js";
// import your SDK

export class MyProvider implements PromptEnhancementProvider {
  readonly name = "my-provider";
  readonly model: string;
  private client: MySDKClient;
  private temperature: number;
  private maxTokens: number;

  constructor(config: ProviderConfig) {
    this.model = config.model || "default-model-id";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.client = new MySDKClient({ apiKey: config.apiKey });
  }

  async completePrompt(prompt: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        // ... SDK-specific params
      });
      return response.text; // extract text from SDK response
    });
  }
}
```

**If your provider uses the OpenAI chat completions format**, you don't need a new class at all. Just add a case to the factory that uses `OpenAiCompatibleProvider` with the correct base URL.

### Step 2: Register in the factory

Edit `src/providers/index.ts`:

```typescript
import { MyProvider } from "./my-provider.js";

// In createProvider() switch statement:
case "my-provider":
  return new MyProvider(resolvedConfig);

// At bottom of file:
export { MyProvider } from "./my-provider.js";
```

### Step 3: Add configuration mappings

Edit `src/config.ts`:

```typescript
// Add env var mapping
const ENV_KEY_MAP: Record<string, string> = {
  // ... existing
  "my-provider": "MY_PROVIDER_API_KEY",
};

// Add default model
const DEFAULT_MODELS: Record<string, string> = {
  // ... existing
  "my-provider": "default-model-id",
};
```

### Step 4: Update the tool schema enum

Edit `src/server.ts`, in the ListTools handler:

```typescript
provider: {
  type: "string",
  enum: [
    "anthropic",
    "openai",
    "openrouter",
    "gemini",
    "openai-compatible",
    "my-provider",  // ADD THIS
  ],
},
```

### Step 5: Add the SDK dependency

```bash
npm install my-provider-sdk
```

### Step 6: Write tests

Create `tests/providers/my-provider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MyProvider } from "../../src/providers/my-provider.js";

// Mock your SDK
vi.mock("my-provider-sdk", () => {
  const mockGenerate = vi.fn();
  return {
    MySDKClient: vi.fn().mockImplementation(() => ({
      generate: mockGenerate,
    })),
    __mockGenerate: mockGenerate,
  };
});

const mockGenerate = (await import("my-provider-sdk") as any).__mockGenerate;

describe("MyProvider", () => {
  let provider: MyProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MyProvider({
      apiKey: "test-key",
      model: "default-model-id",
    });
  });

  it("has correct name and model", () => {
    expect(provider.name).toBe("my-provider");
    expect(provider.model).toBe("default-model-id");
  });

  it("calls API and returns text", async () => {
    mockGenerate.mockResolvedValue({ text: "Enhanced result" });
    const result = await provider.completePrompt("test prompt");
    expect(result).toBe("Enhanced result");
  });

  it("retries on transient errors", async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue({ text: "Success" });
    const result = await provider.completePrompt("test");
    expect(result).toBe("Success");
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401", async () => {
    const error = new Error("Unauthorized");
    (error as any).status = 401;
    mockGenerate.mockRejectedValue(error);
    await expect(provider.completePrompt("test")).rejects.toThrow("Unauthorized");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
```

### Step 7: Update documentation

- Add a row to the provider table in `README.md`
- Add a section in this file (`PROVIDERS.md`)
- Update `config.example.json` with the new provider
- Update `.env.example` with the new env var

### Step 8: Build and test

```bash
npm run build
npm test
```

## Adding an OpenAI-Compatible Provider (Shortcut)

If your provider uses the OpenAI chat completions API format, you don't need a new class. Just add a factory case:

```typescript
// In src/providers/index.ts createProvider():
case "together":
  return new OpenAiCompatibleProvider("together", {
    ...resolvedConfig,
    baseUrl: resolvedConfig.baseUrl || "https://api.together.xyz/v1",
  });
```

And add the config mappings in `src/config.ts`:

```typescript
"together": "TOGETHER_API_KEY",     // in ENV_KEY_MAP
"together": "meta-llama/Llama-3-70b-chat-hf",  // in DEFAULT_MODELS
```

This approach requires no new SDK dependency -- the existing `openai` package handles it.

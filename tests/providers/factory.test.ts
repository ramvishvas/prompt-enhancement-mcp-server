import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProvider } from "../../src/providers/index.js";
import { Config } from "../../src/types.js";

// Mock all provider constructors
vi.mock("../../src/providers/anthropic.js", () => ({
  AnthropicProvider: vi.fn().mockImplementation((config) => ({
    name: "anthropic",
    model: config.model,
    completePrompt: vi.fn(),
  })),
}));

vi.mock("../../src/providers/openai-compatible.js", () => ({
  OpenAiCompatibleProvider: vi.fn().mockImplementation((name, config) => ({
    name,
    model: config.model,
    completePrompt: vi.fn(),
  })),
}));

vi.mock("../../src/providers/gemini.js", () => ({
  GeminiProvider: vi.fn().mockImplementation((config) => ({
    name: "gemini",
    model: config.model,
    completePrompt: vi.fn(),
  })),
}));

describe("createProvider factory", () => {
  const originalEnv = process.env;
  let config: Config;

  beforeEach(() => {
    process.env = { ...originalEnv };
    config = {
      defaultProvider: "anthropic",
      providers: {},
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("creates an Anthropic provider", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const provider = createProvider("anthropic", config);
    expect(provider.name).toBe("anthropic");
  });

  it("creates an OpenAI provider", () => {
    process.env.OPENAI_API_KEY = "test-key";
    const provider = createProvider("openai", config);
    expect(provider.name).toBe("openai");
  });

  it("creates an OpenRouter provider with default baseUrl", () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const provider = createProvider("openrouter", config);
    expect(provider.name).toBe("openrouter");
  });

  it("creates a Gemini provider", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const provider = createProvider("gemini", config);
    expect(provider.name).toBe("gemini");
  });

  it("creates an openai-compatible provider", () => {
    config.providers = {
      "openai-compatible": {
        baseUrl: "http://localhost:11434/v1",
        model: "llama3",
      },
    };
    const provider = createProvider("openai-compatible", config);
    expect(provider.name).toBe("openai-compatible");
  });

  it("throws for unsupported provider", () => {
    expect(() => createProvider("unsupported", config)).toThrow(
      "Unsupported provider: unsupported"
    );
  });

  it("applies model override", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const provider = createProvider("anthropic", config, "claude-3-opus");
    expect(provider.model).toBe("claude-3-opus");
  });

  it("uses config model when no override", () => {
    process.env.OPENAI_API_KEY = "test-key";
    config.providers = { openai: { model: "gpt-4-turbo" } };
    const provider = createProvider("openai", config);
    expect(provider.model).toBe("gpt-4-turbo");
  });

  it("uses default model when no config or override", () => {
    process.env.OPENAI_API_KEY = "test-key";
    const provider = createProvider("openai", config);
    expect(provider.model).toBe("gpt-4o");
  });
});

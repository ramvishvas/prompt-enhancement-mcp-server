import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, getApiKeyFromEnv, getDefaultModel } from "../src/config.js";
import * as fs from "node:fs";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns default config when no config file or env vars", () => {
    const config = loadConfig();
    expect(config.defaultProvider).toBe("anthropic");
    expect(config.options?.maxContextMessages).toBe(10);
    expect(config.options?.contextTruncateLength).toBe(500);
  });

  it("overrides defaultProvider from env var", () => {
    process.env.PROMPT_ENHANCER_DEFAULT_PROVIDER = "openai";
    const config = loadConfig();
    expect(config.defaultProvider).toBe("openai");
  });

  it("loads config from JSON file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        defaultProvider: "gemini",
        providers: {
          gemini: { model: "gemini-pro" },
        },
        templates: {
          default: "Custom template: ${userInput}",
        },
      })
    );

    const config = loadConfig();
    expect(config.defaultProvider).toBe("gemini");
    expect(config.providers?.gemini?.model).toBe("gemini-pro");
    expect(config.templates?.default).toBe("Custom template: ${userInput}");
  });

  it("env var overrides config file defaultProvider", () => {
    process.env.PROMPT_ENHANCER_DEFAULT_PROVIDER = "openrouter";
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ defaultProvider: "gemini" })
    );

    const config = loadConfig();
    expect(config.defaultProvider).toBe("openrouter");
  });

  it("handles invalid JSON gracefully", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("not json");

    const config = loadConfig();
    expect(config.defaultProvider).toBe("anthropic"); // falls back to default
  });
});

describe("getApiKeyFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ANTHROPIC_API_KEY for anthropic", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(getApiKeyFromEnv("anthropic")).toBe("test-key");
  });

  it("returns OPENAI_API_KEY for openai", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(getApiKeyFromEnv("openai")).toBe("test-key");
  });

  it("returns OPENROUTER_API_KEY for openrouter", () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    expect(getApiKeyFromEnv("openrouter")).toBe("test-key");
  });

  it("returns GEMINI_API_KEY for gemini", () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(getApiKeyFromEnv("gemini")).toBe("test-key");
  });

  it("returns undefined for unknown provider", () => {
    expect(getApiKeyFromEnv("unknown")).toBeUndefined();
  });

  it("returns undefined when env var not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(getApiKeyFromEnv("anthropic")).toBeUndefined();
  });
});

describe("getDefaultModel", () => {
  it("returns correct defaults for known providers", () => {
    expect(getDefaultModel("anthropic")).toBe("claude-sonnet-4-5-20250929");
    expect(getDefaultModel("openai")).toBe("gpt-4o");
    expect(getDefaultModel("openrouter")).toBe("anthropic/claude-sonnet-4-5-20250929");
    expect(getDefaultModel("gemini")).toBe("gemini-2.0-flash");
  });

  it("returns fallback for unknown provider", () => {
    expect(getDefaultModel("unknown")).toBe("gpt-3.5-turbo");
  });
});

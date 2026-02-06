import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiCompatibleProvider } from "../../src/providers/openai-compatible.js";

// Mock the OpenAI SDK
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

const mockCreate = (await import("openai") as any).__mockCreate;

describe("OpenAiCompatibleProvider", () => {
  let provider: OpenAiCompatibleProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAiCompatibleProvider("openai", {
      apiKey: "test-key",
      model: "gpt-4o",
      temperature: 0.5,
      maxTokens: 2048,
    });
  });

  it("has correct name and model", () => {
    expect(provider.name).toBe("openai");
    expect(provider.model).toBe("gpt-4o");
  });

  it("uses default model when not specified", () => {
    const p = new OpenAiCompatibleProvider("openai", { apiKey: "test" });
    expect(p.model).toBe("gpt-4o");
  });

  it("calls OpenAI API and returns content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Enhanced result" } }],
    });

    const result = await provider.completePrompt("test prompt");
    expect(result).toBe("Enhanced result");
    expect(mockCreate).toHaveBeenCalledWith({
      model: "gpt-4o",
      max_tokens: 2048,
      temperature: 0.5,
      messages: [{ role: "user", content: "test prompt" }],
    });
  });

  it("returns empty string when no content", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });
    const result = await provider.completePrompt("test");
    expect(result).toBe("");
  });

  it("works as OpenRouter with custom baseUrl", () => {
    const p = new OpenAiCompatibleProvider("openrouter", {
      apiKey: "test",
      model: "anthropic/claude-3.5-sonnet",
      baseUrl: "https://openrouter.ai/api/v1",
    });
    expect(p.name).toBe("openrouter");
    expect(p.model).toBe("anthropic/claude-3.5-sonnet");
  });

  it("works as openai-compatible with custom baseUrl", () => {
    const p = new OpenAiCompatibleProvider("openai-compatible", {
      model: "llama3",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(p.name).toBe("openai-compatible");
    expect(p.model).toBe("llama3");
  });

  it("retries on transient errors", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("Service Unavailable"))
      .mockResolvedValue({
        choices: [{ message: { content: "Success" } }],
      });

    const result = await provider.completePrompt("test");
    expect(result).toBe("Success");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400 errors", async () => {
    const error = new Error("Bad Request");
    (error as any).status = 400;
    mockCreate.mockRejectedValue(error);

    await expect(provider.completePrompt("test")).rejects.toThrow(
      "Bad Request"
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

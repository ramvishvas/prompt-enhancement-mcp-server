import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic.js";

const mockCreate = vi.fn();

// Mock the Anthropic SDK - use class syntax for vitest v4 compatibility
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider({
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0.5,
      maxTokens: 2048,
    });
  });

  it("has correct name and model", () => {
    expect(provider.name).toBe("anthropic");
    expect(provider.model).toBe("claude-sonnet-4-5-20250929");
  });

  it("uses default model when not specified", () => {
    const p = new AnthropicProvider({ apiKey: "test" });
    expect(p.model).toBe("claude-sonnet-4-5-20250929");
  });

  it("calls Anthropic API and returns text", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Enhanced result" }],
    });

    const result = await provider.completePrompt("test prompt");
    expect(result).toBe("Enhanced result");
    expect(mockCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      temperature: 0.5,
      messages: [{ role: "user", content: "test prompt" }],
    });
  });

  it("returns empty string when no text content", async () => {
    mockCreate.mockResolvedValue({ content: [] });
    const result = await provider.completePrompt("test");
    expect(result).toBe("");
  });

  it("retries on transient errors", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue({
        content: [{ type: "text", text: "Success after retry" }],
      });

    const result = await provider.completePrompt("test");
    expect(result).toBe("Success after retry");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401 errors", async () => {
    const error = new Error("Unauthorized");
    (error as any).status = 401;
    mockCreate.mockRejectedValue(error);

    await expect(provider.completePrompt("test")).rejects.toThrow(
      "Unauthorized"
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

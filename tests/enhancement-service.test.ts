import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnhancementService } from "../src/services/enhancement-service.js";
import { Config } from "../src/types.js";

// Mock the providers module
vi.mock("../src/providers/index.js", () => ({
  createProvider: vi.fn(),
}));

import { createProvider } from "../src/providers/index.js";

const mockProvider = {
  name: "test-provider",
  model: "test-model",
  completePrompt: vi.fn(),
};

describe("EnhancementService", () => {
  let service: EnhancementService;
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      defaultProvider: "anthropic",
      providers: {},
      templates: {},
      options: {
        maxContextMessages: 10,
        contextTruncateLength: 500,
      },
    };

    service = new EnhancementService(config);
    vi.mocked(createProvider).mockReturnValue(mockProvider);
    mockProvider.completePrompt.mockResolvedValue("Enhanced prompt result");
  });

  it("enhances a prompt with default provider", async () => {
    const result = await service.enhance({ text: "write a function" });

    expect(result.success).toBe(true);
    expect(result.enhancedText).toBe("Enhanced prompt result");
    expect(result.provider).toBe("test-provider");
    expect(result.model).toBe("test-model");
    expect(createProvider).toHaveBeenCalledWith("anthropic", config, undefined);
  });

  it("uses specified provider", async () => {
    await service.enhance({ text: "test", provider: "openai" });
    expect(createProvider).toHaveBeenCalledWith("openai", config, undefined);
  });

  it("passes model override", async () => {
    await service.enhance({ text: "test", model: "gpt-4-turbo" });
    expect(createProvider).toHaveBeenCalledWith(
      "anthropic",
      config,
      "gpt-4-turbo"
    );
  });

  it("applies default template with ${userInput}", async () => {
    await service.enhance({ text: "build an API" });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    expect(callArgs).toContain("build an API");
    expect(callArgs).toContain("enhanced version");
  });

  it("applies custom template", async () => {
    await service.enhance({
      text: "build an API",
      template: "Make this better: ${userInput}",
    });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    expect(callArgs).toBe("Make this better: build an API");
  });

  it("uses config template over default", async () => {
    config.templates = { default: "Improve: ${userInput}" };
    service = new EnhancementService(config);

    await service.enhance({ text: "test" });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    expect(callArgs).toBe("Improve: test");
  });

  it("throws when inline template is missing ${userInput} placeholder", async () => {
    await expect(
      service.enhance({
        text: "test",
        template: "No placeholder here",
      })
    ).rejects.toThrow("Template must contain the ${userInput} placeholder");
  });

  it("throws when config template is missing ${userInput} placeholder", async () => {
    config.templates = { default: "Bad template without placeholder" };
    service = new EnhancementService(config);

    await expect(service.enhance({ text: "test" })).rejects.toThrow(
      "Template must contain the ${userInput} placeholder"
    );
  });

  it("includes context in prompt", async () => {
    await service.enhance({
      text: "continue this",
      context: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    expect(callArgs).toContain("continue this");
    expect(callArgs).toContain("user: Hello");
    expect(callArgs).toContain("assistant: Hi there!");
    expect(callArgs).toContain("conversation context");
  });

  it("truncates long context messages", async () => {
    config.options = { maxContextMessages: 10, contextTruncateLength: 20 };
    service = new EnhancementService(config);

    await service.enhance({
      text: "test",
      context: [
        {
          role: "user",
          content: "This is a very long message that should be truncated",
        },
      ],
    });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    expect(callArgs).toContain("This is a very long ...");
  });

  it("limits context to maxContextMessages", async () => {
    config.options = { maxContextMessages: 2, contextTruncateLength: 500 };
    service = new EnhancementService(config);

    await service.enhance({
      text: "test",
      context: [
        { role: "user", content: "msg1" },
        { role: "assistant", content: "msg2" },
        { role: "user", content: "msg3" },
        { role: "assistant", content: "msg4" },
      ],
    });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    // Should only include last 2 messages
    expect(callArgs).not.toContain("msg1");
    expect(callArgs).not.toContain("msg2");
    expect(callArgs).toContain("msg3");
    expect(callArgs).toContain("msg4");
  });

  it("ignores empty context array", async () => {
    await service.enhance({ text: "test", context: [] });

    const callArgs = mockProvider.completePrompt.mock.calls[0][0] as string;
    expect(callArgs).not.toContain("conversation context");
  });
});

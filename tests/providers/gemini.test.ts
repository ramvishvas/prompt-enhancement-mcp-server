import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiProvider } from "../../src/providers/gemini.js";

const mockGenerateContent = vi.fn();

// Mock the new @google/genai SDK - use class syntax for vitest v4 compatibility
vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
  },
}));

describe("GeminiProvider", () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      temperature: 0.5,
      maxTokens: 2048,
    });
  });

  it("has correct name and model", () => {
    expect(provider.name).toBe("gemini");
    expect(provider.model).toBe("gemini-2.0-flash");
  });

  it("uses default model when not specified", () => {
    const p = new GeminiProvider({ apiKey: "test" });
    expect(p.model).toBe("gemini-2.0-flash");
  });

  it("throws when no API key provided", () => {
    expect(() => new GeminiProvider({})).toThrow("Gemini API key is required");
  });

  it("calls Gemini API and returns text", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "Enhanced result",
    });

    const result = await provider.completePrompt("test prompt");
    expect(result).toBe("Enhanced result");
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "gemini-2.0-flash",
      contents: "test prompt",
      config: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    });
  });

  it("retries on transient errors", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue({
        text: "Success after retry",
      });

    const result = await provider.completePrompt("test");
    expect(result).toBe("Success after retry");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});

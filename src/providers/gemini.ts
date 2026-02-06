import { GoogleGenAI } from "@google/genai";
import { PromptEnhancementProvider, ProviderConfig } from "../types.js";
import { withRetry } from "./base-provider.js";

export class GeminiProvider implements PromptEnhancementProvider {
  readonly name = "gemini";
  readonly model: string;
  private client: GoogleGenAI;
  private temperature: number;
  private maxTokens: number;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new Error("Gemini API key is required");
    }
    this.model = config.model || "gemini-2.0-flash";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async completePrompt(prompt: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        },
      });
      return response.text ?? "";
    });
  }
}

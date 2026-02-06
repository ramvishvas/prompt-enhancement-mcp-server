import { GoogleGenerativeAI } from "@google/generative-ai";
import { PromptEnhancementProvider, ProviderConfig } from "../types.js";
import { withRetry } from "./base-provider.js";

export class GeminiProvider implements PromptEnhancementProvider {
  readonly name = "gemini";
  readonly model: string;
  private client: GoogleGenerativeAI;
  private temperature: number;
  private maxTokens: number;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new Error("Gemini API key is required");
    }
    this.model = config.model || "gemini-2.0-flash";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async completePrompt(prompt: string): Promise<string> {
    return withRetry(async () => {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });
  }
}

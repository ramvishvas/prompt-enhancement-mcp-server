import OpenAI from "openai";
import { PromptEnhancementProvider, ProviderConfig } from "../types.js";
import { withRetry } from "./base-provider.js";

/**
 * Base provider for any OpenAI-compatible API.
 * OpenAI, OpenRouter, and custom endpoints (Ollama, LM Studio, vLLM, etc.)
 * all use this implementation directly or via the factory.
 */
export class OpenAiCompatibleProvider implements PromptEnhancementProvider {
  readonly name: string;
  readonly model: string;
  protected client: OpenAI;
  private temperature: number;
  private maxTokens: number;

  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.model = config.model || "gpt-4o";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.client = new OpenAI({
      apiKey: config.apiKey || "",
      baseURL: config.baseUrl,
    });
  }

  async completePrompt(prompt: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content ?? "";
    });
  }
}

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

    // Validate baseUrl if provided
    if (config.baseUrl) {
      try {
        const url = new URL(config.baseUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error(
            `Invalid baseUrl protocol "${url.protocol}" for provider "${name}". Only http: and https: are allowed.`
          );
        }
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(
            `Invalid baseUrl for provider "${name}": not a valid URL`
          );
        }
        throw error;
      }
    }

    // Require API key for named providers (openai-compatible may run without one, e.g. Ollama)
    if (!config.apiKey && (name === "openai" || name === "openrouter")) {
      throw new Error(
        `API key is required for provider "${name}". Set the ${name === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"} environment variable.`
      );
    }

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

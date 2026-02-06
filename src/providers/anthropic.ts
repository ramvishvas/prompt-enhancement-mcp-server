import Anthropic from "@anthropic-ai/sdk";
import { PromptEnhancementProvider, ProviderConfig } from "../types.js";
import { withRetry } from "./base-provider.js";

export class AnthropicProvider implements PromptEnhancementProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;
  private temperature: number;
  private maxTokens: number;

  constructor(config: ProviderConfig) {
    this.model = config.model || "claude-sonnet-4-5-20250929";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async completePrompt(prompt: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [{ role: "user", content: prompt }],
      });
      const textContent = response.content.find((c) => c.type === "text");
      return textContent?.type === "text" ? textContent.text : "";
    });
  }
}

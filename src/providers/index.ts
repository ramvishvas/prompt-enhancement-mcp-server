import { Config, PromptEnhancementProvider, ProviderConfig } from "../types.js";
import { getApiKeyFromEnv, getDefaultModel } from "../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAiCompatibleProvider } from "./openai-compatible.js";
import { GeminiProvider } from "./gemini.js";

/**
 * Factory function to create a provider instance.
 * Resolves config from the Config object, env vars, and optional overrides.
 */
export function createProvider(
  name: string,
  config: Config,
  modelOverride?: string
): PromptEnhancementProvider {
  const providerConfig = config.providers?.[name] ?? {};
  const apiKey = getApiKeyFromEnv(name);

  const resolvedConfig: ProviderConfig = {
    ...providerConfig,
    apiKey: apiKey || providerConfig.apiKey,
    model: modelOverride || providerConfig.model || getDefaultModel(name),
  };

  switch (name) {
    case "anthropic":
      return new AnthropicProvider(resolvedConfig);

    case "openai":
      return new OpenAiCompatibleProvider("openai", resolvedConfig);

    case "openrouter":
      return new OpenAiCompatibleProvider("openrouter", {
        ...resolvedConfig,
        baseUrl: resolvedConfig.baseUrl || "https://openrouter.ai/api/v1",
      });

    case "gemini":
      return new GeminiProvider(resolvedConfig);

    case "openai-compatible":
      return new OpenAiCompatibleProvider("openai-compatible", resolvedConfig);

    default:
      throw new Error(`Unsupported provider: ${name}. Supported: anthropic, openai, openrouter, gemini, openai-compatible`);
  }
}

export { AnthropicProvider } from "./anthropic.js";
export { OpenAiCompatibleProvider } from "./openai-compatible.js";
export { GeminiProvider } from "./gemini.js";

import { Config, EnhanceOptions, EnhanceResult, ContextMessage } from "../types.js";
import { createProvider } from "../providers/index.js";
import { logger } from "../utils/logger.js";

const DEFAULT_ENHANCE_TEMPLATE = `Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):

\${userInput}`;

export class EnhancementService {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async enhance(options: EnhanceOptions): Promise<EnhanceResult> {
    // 1. Prepare input with optional context
    const input = this.prepareInput(options.text, options.context);

    // 2. Get and apply template
    const templateStr =
      options.template ||
      this.config.templates?.default ||
      DEFAULT_ENHANCE_TEMPLATE;

    if (!templateStr.includes("${userInput}")) {
      throw new Error(
        "Template must contain the ${userInput} placeholder"
      );
    }

    const prompt = templateStr.replace("${userInput}", input);

    // 3. Get provider, respecting model override
    const providerName = options.provider || this.config.defaultProvider;
    logger.info(
      `Enhancing prompt with provider: ${providerName}${options.model ? ` (model: ${options.model})` : ""}`
    );

    const provider = createProvider(providerName, this.config, options.model);

    // 4. Call provider (retry is built into the provider)
    const enhanced = await provider.completePrompt(prompt);

    logger.info(
      `Enhancement complete: ${enhanced.length} chars from ${provider.name}/${provider.model}`
    );

    return {
      success: true,
      enhancedText: enhanced,
      provider: provider.name,
      model: provider.model,
    };
  }

  private prepareInput(
    text: string,
    context?: ContextMessage[]
  ): string {
    if (!context || context.length === 0) {
      return text;
    }

    const maxMessages = this.config.options?.maxContextMessages ?? 10;
    const truncateLength = this.config.options?.contextTruncateLength ?? 500;

    const contextStr = context
      .slice(-maxMessages)
      .map((msg) => {
        const content =
          msg.content.length > truncateLength
            ? msg.content.slice(0, truncateLength) + "..."
            : msg.content;
        return `${msg.role}: ${content}`;
      })
      .join("\n");

    return `${text}\n\nUse the following previous conversation context as needed:\n${contextStr}`;
  }
}

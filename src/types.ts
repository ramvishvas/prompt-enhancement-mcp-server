export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Config {
  defaultProvider: string;
  providers?: Record<string, ProviderConfig>;
  templates?: Record<string, string>;
  options?: {
    maxContextMessages?: number;
    contextTruncateLength?: number;
  };
}

export interface ContextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EnhanceOptions {
  text: string;
  provider?: string;
  model?: string;
  context?: ContextMessage[];
  template?: string;
}

export interface EnhanceResult {
  success: boolean;
  enhancedText: string;
  provider: string;
  model: string;
}

export interface PromptEnhancementProvider {
  readonly name: string;
  readonly model: string;
  completePrompt(prompt: string): Promise<string>;
}

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { Config } from "./types.js";
import { logger } from "./utils/logger.js";

const DEFAULT_CONFIG_PATH = resolve(
  homedir(),
  ".config",
  "prompt-enhancer",
  "config.json"
);

const DEFAULT_CONFIG: Config = {
  defaultProvider: "anthropic",
  providers: {},
  templates: {},
  options: {
    maxContextMessages: 10,
    contextTruncateLength: 500,
  },
};

export function loadConfig(): Config {
  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Override default provider from env
  const envProvider = process.env.PROMPT_ENHANCER_DEFAULT_PROVIDER;
  if (envProvider) {
    config.defaultProvider = envProvider;
  }

  // Try to load config file
  const configPath =
    process.env.PROMPT_ENHANCER_CONFIG || DEFAULT_CONFIG_PATH;

  if (existsSync(configPath)) {
    try {
      const fileContent = readFileSync(configPath, "utf-8");
      const fileConfig = JSON.parse(fileContent) as Partial<Config>;

      config = {
        defaultProvider: fileConfig.defaultProvider || config.defaultProvider,
        providers: { ...config.providers, ...fileConfig.providers },
        templates: { ...config.templates, ...fileConfig.templates },
        options: { ...config.options, ...fileConfig.options },
      };

      // Env var still takes precedence over config file
      if (envProvider) {
        config.defaultProvider = envProvider;
      }

      logger.info(`Loaded config from ${configPath}`);
    } catch (error) {
      logger.warn(
        `Failed to parse config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    logger.debug(`No config file found at ${configPath}, using defaults`);
  }

  return config;
}

const ENV_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  gemini: "GEMINI_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
};

export function getApiKeyFromEnv(providerName: string): string | undefined {
  const envVar = ENV_KEY_MAP[providerName];
  return envVar ? process.env[envVar] : undefined;
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-5-20250929",
  openai: "gpt-4o",
  openrouter: "anthropic/claude-sonnet-4-5-20250929",
  gemini: "gemini-2.0-flash",
  "openai-compatible": "gpt-3.5-turbo",
};

export function getDefaultModel(providerName: string): string {
  return DEFAULT_MODELS[providerName] || "gpt-3.5-turbo";
}

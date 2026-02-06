type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.PROMPT_ENHANCER_LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (shouldLog("debug")) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  },
  info(message: string, ...args: unknown[]) {
    if (shouldLog("info")) {
      console.error(`[INFO] ${message}`, ...args);
    }
  },
  warn(message: string, ...args: unknown[]) {
    if (shouldLog("warn")) {
      console.error(`[WARN] ${message}`, ...args);
    }
  },
  error(message: string, ...args: unknown[]) {
    if (shouldLog("error")) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
};

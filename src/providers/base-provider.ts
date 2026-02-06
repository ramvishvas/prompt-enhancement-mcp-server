import { logger } from "../utils/logger.js";

/**
 * Retry helper with exponential backoff.
 * Shared across all provider implementations.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Don't retry on auth errors or invalid requests
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 400) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.debug(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

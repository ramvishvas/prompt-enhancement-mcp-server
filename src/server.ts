import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { EnhancementService } from "./services/enhancement-service.js";
import { loadConfig } from "./config.js";
import { EnhanceOptions } from "./types.js";
import { logger } from "./utils/logger.js";

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const enhancementService = new EnhancementService(config);

  const server = new Server(
    {
      name: "prompt-enhancement-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "enhance_prompt",
        description:
          "Enhances a user prompt using AI to make it more detailed, clear, and effective",
        inputSchema: {
          type: "object" as const,
          properties: {
            text: {
              type: "string",
              description: "The prompt text to enhance",
            },
            provider: {
              type: "string",
              description:
                "AI provider to use (optional, uses default if not specified)",
              enum: [
                "anthropic",
                "openai",
                "openrouter",
                "gemini",
                "openai-compatible",
              ],
            },
            model: {
              type: "string",
              description:
                "Model to use, overriding provider default (optional)",
            },
            context: {
              type: "array",
              description: "Optional conversation history for context",
              items: {
                type: "object",
                properties: {
                  role: {
                    type: "string",
                    enum: ["user", "assistant"],
                  },
                  content: { type: "string" },
                },
                required: ["role", "content"],
              },
            },
            template: {
              type: "string",
              description:
                "Custom enhancement template. Use ${userInput} as placeholder. (optional)",
            },
          },
          required: ["text"],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "enhance_prompt") {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    }

    const args = request.params.arguments as unknown as EnhanceOptions;

    if (!args.text || typeof args.text !== "string") {
      throw new McpError(
        ErrorCode.InvalidParams,
        "The 'text' parameter is required and must be a string"
      );
    }

    try {
      const result = await enhancementService.enhance(args);

      return {
        content: [
          {
            type: "text",
            text: result.enhancedText,
          },
        ],
        _meta: {
          provider: result.provider,
          model: result.model,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error(`Enhancement failed: ${message}`);

      return {
        content: [
          {
            type: "text",
            text: `Enhancement failed: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Prompt Enhancement MCP Server started");
}

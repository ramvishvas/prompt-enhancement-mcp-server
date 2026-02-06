import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the config module
vi.mock("../src/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({
    defaultProvider: "anthropic",
    providers: {},
    templates: {},
    options: { maxContextMessages: 10, contextTruncateLength: 500 },
  }),
  getApiKeyFromEnv: vi.fn().mockReturnValue("test-key"),
  getDefaultModel: vi.fn().mockReturnValue("test-model"),
}));

// Mock the providers module
vi.mock("../src/providers/index.js", () => ({
  createProvider: vi.fn().mockReturnValue({
    name: "anthropic",
    model: "test-model",
    completePrompt: vi.fn().mockResolvedValue("Enhanced prompt text"),
  }),
}));

// Mock the MCP SDK server - use class syntax for vitest v4 compatibility
const mockConnect = vi.fn();
const mockSetRequestHandler = vi.fn();

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: class MockServer {
    connect = mockConnect;
    setRequestHandler = mockSetRequestHandler;
    constructor() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class MockStdioServerTransport {
    constructor() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  CallToolRequestSchema: "CallToolRequestSchema",
  ListToolsRequestSchema: "ListToolsRequestSchema",
  ErrorCode: { MethodNotFound: -32601, InvalidParams: -32602 },
  McpError: class McpError extends Error {
    code: number;
    constructor(code: number, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { startServer } from "../src/server.js";

describe("MCP Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts and connects to transport", async () => {
    await startServer();
    expect(mockConnect).toHaveBeenCalled();
  });

  it("registers ListTools and CallTool handlers", async () => {
    await startServer();
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      "ListToolsRequestSchema",
      expect.any(Function)
    );
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      "CallToolRequestSchema",
      expect.any(Function)
    );
  });

  it("ListTools returns enhance_prompt tool", async () => {
    await startServer();

    const listToolsHandler = mockSetRequestHandler.mock.calls.find(
      ([schema]: [string]) => schema === "ListToolsRequestSchema"
    )?.[1];

    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("enhance_prompt");
    expect(result.tools[0].inputSchema.required).toEqual(["text"]);
  });

  it("CallTool handles enhance_prompt", async () => {
    await startServer();

    const callToolHandler = mockSetRequestHandler.mock.calls.find(
      ([schema]: [string]) => schema === "CallToolRequestSchema"
    )?.[1];

    const result = await callToolHandler({
      params: {
        name: "enhance_prompt",
        arguments: { text: "write a function" },
      },
    });

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("Enhanced prompt text");
  });

  it("CallTool returns error for unknown tool", async () => {
    await startServer();

    const callToolHandler = mockSetRequestHandler.mock.calls.find(
      ([schema]: [string]) => schema === "CallToolRequestSchema"
    )?.[1];

    await expect(
      callToolHandler({
        params: { name: "unknown_tool", arguments: {} },
      })
    ).rejects.toThrow("Unknown tool: unknown_tool");
  });

  it("CallTool returns error for missing text", async () => {
    await startServer();

    const callToolHandler = mockSetRequestHandler.mock.calls.find(
      ([schema]: [string]) => schema === "CallToolRequestSchema"
    )?.[1];

    await expect(
      callToolHandler({
        params: { name: "enhance_prompt", arguments: {} },
      })
    ).rejects.toThrow("'text' parameter is required");
  });
});

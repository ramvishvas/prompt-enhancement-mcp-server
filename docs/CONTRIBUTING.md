# Contributing

## Development Setup

### Prerequisites

- Node.js 18+
- npm

### Getting Started

```bash
git clone <repo-url>
cd prompt-enhancement-mcp-server
npm install
npm run build
```

### Development Workflow

```bash
# Watch mode (recompiles on changes)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Run the server locally
export ANTHROPIC_API_KEY=sk-ant-...
node dist/index.js
```

### Project Scripts

| Script | Command | Description |
|---|---|---|
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run the compiled server |
| `dev` | `tsc --watch` | Watch mode compilation |
| `test` | `vitest run` | Run test suite once |
| `test:watch` | `vitest` | Run tests in watch mode |

## Project Structure

```
src/
├── index.ts                    # Entry point (#!/usr/bin/env node)
├── server.ts                   # MCP server setup & tool handler
├── config.ts                   # Configuration loading
├── types.ts                    # All TypeScript interfaces
├── services/
│   └── enhancement-service.ts  # Core business logic + template system
├── providers/
│   ├── base-provider.ts        # withRetry() shared utility
│   ├── openai-compatible.ts    # Base class for OpenAI-format APIs
│   ├── anthropic.ts            # Anthropic Claude provider
│   ├── gemini.ts               # Google Gemini provider
│   └── index.ts                # createProvider() factory + re-exports
└── utils/
    └── logger.ts               # stderr logging utility

tests/
├── config.test.ts              # Config loading tests
├── enhancement-service.test.ts # Enhancement service tests
├── server.test.ts              # MCP server handler tests
└── providers/
    ├── anthropic.test.ts       # Anthropic provider tests
    ├── openai.test.ts          # OpenAI/compatible provider tests
    ├── gemini.test.ts          # Gemini provider tests
    └── factory.test.ts         # Provider factory tests
```

## Testing

### Test Framework

- **Runner:** vitest
- **Mocking:** vitest built-in `vi.mock()` and `vi.fn()`
- **No real API calls** -- all provider SDKs are mocked

### Running Tests

```bash
# All tests
npm test

# Specific file
npx vitest run tests/config.test.ts

# Watch mode (re-runs on changes)
npm run test:watch

# With coverage
npx vitest run --coverage
```

### Writing Tests

#### Mocking a Provider SDK

Each provider test mocks its SDK at the module level:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK BEFORE importing the provider
vi.mock("my-sdk", () => {
  const mockMethod = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      someMethod: mockMethod,
    })),
    __mockMethod: mockMethod,  // Export for test access
  };
});

// Import the mock accessor
const mockMethod = (await import("my-sdk") as any).__mockMethod;

describe("MyProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();  // IMPORTANT: reset between tests
  });

  it("calls the API", async () => {
    mockMethod.mockResolvedValue({ text: "result" });
    const provider = new MyProvider({ apiKey: "test" });
    const result = await provider.completePrompt("test");
    expect(result).toBe("result");
  });
});
```

#### Testing the Enhancement Service

The enhancement service tests mock the `createProvider` factory:

```typescript
vi.mock("../src/providers/index.js", () => ({
  createProvider: vi.fn(),
}));

import { createProvider } from "../src/providers/index.js";

const mockProvider = {
  name: "test",
  model: "test-model",
  completePrompt: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createProvider).mockReturnValue(mockProvider);
  mockProvider.completePrompt.mockResolvedValue("Enhanced text");
});
```

#### Testing Configuration

Config tests mock the `node:fs` module:

```typescript
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Simulate config file exists
vi.mocked(fs.existsSync).mockReturnValue(true);
vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ ... }));

// Simulate no config file
vi.mocked(fs.existsSync).mockReturnValue(false);
```

### Test Conventions

- Use `vi.clearAllMocks()` in `beforeEach` to prevent state leaking between tests
- Mock SDK modules at the top of the file, before any imports from the code under test
- Test both success and error paths
- Test retry behavior for providers (transient errors succeed on retry, auth errors fail immediately)
- Use `(error as any).status = 401` to test HTTP status-based error handling

## Common Tasks

### Adding a New Provider

See [PROVIDERS.md](./PROVIDERS.md) for the complete step-by-step guide. Summary:

1. Create `src/providers/{name}.ts` implementing `PromptEnhancementProvider`
2. Add case to `createProvider()` in `src/providers/index.ts`
3. Add env var mapping and default model in `src/config.ts`
4. Add to tool schema enum in `src/server.ts`
5. Write tests in `tests/providers/{name}.test.ts`
6. Update documentation

### Adding a New MCP Tool

1. Add tool definition to `ListToolsRequestSchema` handler in `src/server.ts`
2. Add handler case to `CallToolRequestSchema` handler
3. Create service method if needed
4. Update `docs/API.md`
5. Write tests in `tests/server.test.ts`

### Modifying the Template System

The template system is in `src/services/enhancement-service.ts`:

- `DEFAULT_ENHANCE_TEMPLATE` constant: the built-in template
- Template resolution: tool arg > config file > default
- `${userInput}` replacement: simple string `.replace()`

To add named template support (e.g. `template: "technical"`):
1. Modify the template resolution in `enhance()` to look up named templates from config
2. Fall back to treating the string as a literal template if not found
3. Update the tool schema description

### Modifying the Retry Logic

The retry function is in `src/providers/base-provider.ts`:

- `withRetry<T>(fn, maxRetries, baseDelay)` is a generic async function
- Adjust `maxRetries` or `baseDelay` defaults for all providers
- Add new non-retryable status codes to the guard clause
- Add jitter by modifying the delay calculation

### Adding MCP Resources

To add resources (deferred from v1.0):

1. Add `resources: {}` to server capabilities
2. Import `ListResourcesRequestSchema` and `ReadResourceRequestSchema`
3. Register handlers for listing and reading resources
4. Return config, provider info, or template data as JSON
5. Write tests

## Code Style

- TypeScript strict mode is enabled
- Use `.js` extensions in imports (Node16 module resolution)
- Use `const` by default, `let` when mutation is needed
- Prefer `??` (nullish coalescing) over `||` for defaults that could be `0` or `""`
- Log to stderr only (never stdout -- it's reserved for MCP protocol)
- All async functions that call external APIs should use `withRetry()`

## Commit Guidelines

- Keep commits focused on a single change
- Include tests with new features or bug fixes
- Run `npm run build && npm test` before committing
- Update relevant documentation

## Release Process (future)

1. Update version in `package.json`
2. Run full test suite
3. Build: `npm run build`
4. Publish: `npm publish`
5. Tag: `git tag v{version}`

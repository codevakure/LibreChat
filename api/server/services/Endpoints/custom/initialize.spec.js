const initializeClient = require('./initialize');

jest.mock('@wrangler/api', () => ({
  ...jest.requireActual('@wrangler/api'),
  resolveHeaders: jest.fn(),
  getOpenAIConfig: jest.fn(),
  createHandleLLMNewToken: jest.fn(),
  getCustomEndpointConfig: jest.fn().mockReturnValue({
    apiKey: 'test-key',
    baseURL: 'https://test.com',
    headers: { 'x-user': '{{WRANGLER_USER_ID}}', 'x-email': '{{WRANGLER_USER_EMAIL}}' },
    models: { default: ['test-model'] },
  }),
}));

jest.mock('~/server/services/UserService', () => ({
  getUserKeyValues: jest.fn(),
  checkUserKeyExpiry: jest.fn(),
}));

// Config is now passed via req.config, not getAppConfig

jest.mock('~/server/services/ModelService', () => ({
  fetchModels: jest.fn(),
}));

jest.mock('~/app/clients/OpenAIClient', () => {
  return jest.fn().mockImplementation(() => ({
    options: {},
  }));
});

jest.mock('~/cache/getLogStores', () =>
  jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
);

describe('custom/initializeClient', () => {
  const mockRequest = {
    body: { endpoint: 'test-endpoint' },
    user: { id: 'user-123', email: 'test@example.com', role: 'user' },
    app: { locals: {} },
    config: {
      endpoints: {
        all: {
          streamRate: 25,
        },
      },
    },
  };
  const mockResponse = {};

  beforeEach(() => {
    jest.clearAllMocks();
    const { getCustomEndpointConfig, resolveHeaders, getOpenAIConfig } = require('@wrangler/api');
    getCustomEndpointConfig.mockReturnValue({
      apiKey: 'test-key',
      baseURL: 'https://test.com',
      headers: { 'x-user': '{{WRANGLER_USER_ID}}', 'x-email': '{{WRANGLER_USER_EMAIL}}' },
      models: { default: ['test-model'] },
    });
    resolveHeaders.mockReturnValue({ 'x-user': 'user-123', 'x-email': 'test@example.com' });
    getOpenAIConfig.mockReturnValue({
      useLegacyContent: true,
      endpointTokenConfig: null,
      llmConfig: {
        callbacks: [],
      },
    });
  });

  it('calls resolveHeaders with headers, user, and body for body placeholder support', async () => {
    const { resolveHeaders } = require('@wrangler/api');
    await initializeClient({ req: mockRequest, res: mockResponse, optionsOnly: true });
    expect(resolveHeaders).toHaveBeenCalledWith({
      headers: { 'x-user': '{{WRANGLER_USER_ID}}', 'x-email': '{{WRANGLER_USER_EMAIL}}' },
      user: { id: 'user-123', email: 'test@example.com', role: 'user' },
      body: { endpoint: 'test-endpoint' }, // body - supports {{WRANGLER_BODY_*}} placeholders
    });
  });

  it('throws if endpoint config is missing', async () => {
    const { getCustomEndpointConfig } = require('@wrangler/api');
    getCustomEndpointConfig.mockReturnValueOnce(null);
    await expect(
      initializeClient({ req: mockRequest, res: mockResponse, optionsOnly: true }),
    ).rejects.toThrow('Config not found for the test-endpoint custom endpoint.');
  });

  it('throws if user is missing', async () => {
    await expect(
      initializeClient({
        req: { ...mockRequest, user: undefined },
        res: mockResponse,
        optionsOnly: true,
      }),
    ).rejects.toThrow("Cannot read properties of undefined (reading 'id')");
  });
});

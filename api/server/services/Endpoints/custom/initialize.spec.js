const initializeClient = require('./initialize');

jest.mock('@pleach/api', () => ({
  resolveHeaders: jest.fn(),
  getOpenAIConfig: jest.fn(),
  createHandleLLMNewToken: jest.fn(),
}));

jest.mock('pleach-data-provider', () => ({
  CacheKeys: { TOKEN_CONFIG: 'token_config' },
  ErrorTypes: { NO_USER_KEY: 'NO_USER_KEY', NO_BASE_URL: 'NO_BASE_URL' },
  envVarRegex: /\$\{([^}]+)\}/,
  FetchTokenConfig: {},
  extractEnvVariable: jest.fn((value) => value),
}));

jest.mock('@librechat/agents', () => ({
  Providers: { OLLAMA: 'ollama' },
}));

jest.mock('~/server/services/UserService', () => ({
  getUserKeyValues: jest.fn(),
  checkUserKeyExpiry: jest.fn(),
}));

jest.mock('~/server/services/Config', () => ({
  getCustomEndpointConfig: jest.fn().mockResolvedValue({
    apiKey: 'test-key',
    baseURL: 'https://test.com',
    headers: { 'x-user': '{{PLEACH_USER_ID}}', 'x-email': '{{PLEACH_USER_EMAIL}}' },
    models: { default: ['test-model'] },
  }),
}));

jest.mock('~/server/services/ModelService', () => ({
  fetchModels: jest.fn(),
}));

jest.mock('~/app/clients/OpenAIClient', () => {
  return jest.fn().mockImplementation(() => ({
    options: {},
  }));
});

jest.mock('~/server/utils', () => ({
  isUserProvided: jest.fn().mockReturnValue(false),
}));

jest.mock('~/cache/getLogStores', () =>
  jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
);

describe('custom/initializeClient', () => {
  const mockRequest = {
    body: { endpoint: 'test-endpoint' },
    user: { id: 'user-123', email: 'test@example.com' },
    app: { locals: {} },
  };
  const mockResponse = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls resolveHeaders with headers, user, and body for body placeholder support', async () => {
    const { resolveHeaders } = require('@pleach/api');
    await initializeClient({ req: mockRequest, res: mockResponse, optionsOnly: true });
    expect(resolveHeaders).toHaveBeenCalledWith({
      headers: { 'x-user': '{{PLEACH_USER_ID}}', 'x-email': '{{PLEACH_USER_EMAIL}}' },
      user: { id: 'user-123', email: 'test@example.com' },
      body: { endpoint: 'test-endpoint' }, // body - supports {{PLEACH_BODY_*}} placeholders
    });
  });

  it('throws if endpoint config is missing', async () => {
    const { getCustomEndpointConfig } = require('~/server/services/Config');
    getCustomEndpointConfig.mockResolvedValueOnce(null);
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

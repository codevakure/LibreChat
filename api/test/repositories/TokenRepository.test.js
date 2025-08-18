// TokenRepository.test.js - Tests for TokenRepository
const TokenRepository = require('../../dal/repositories/TokenRepository');

const mockAdapter = {
  findOne: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn(),
  getIdField: () => 'id'
};

describe('TokenRepository', () => {
  let tokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenRepository = new TokenRepository(mockAdapter);
  });

  it('should initialize with correct collection name', () => {
    expect(tokenRepository.collection).toBe('tokens');
  });

  it('should validate required fields', () => {
    const validData = {
      user: 'user1',
      token: 'abc123',
      type: 'access'
    };

    const result = tokenRepository.validateData(validData);
    expect(result.created_at).toBeInstanceOf(Date);
  });
});

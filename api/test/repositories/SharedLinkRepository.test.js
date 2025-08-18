// SharedLinkRepository.test.js - Tests for SharedLinkRepository
const SharedLinkRepository = require('../../dal/repositories/SharedLinkRepository');

const mockAdapter = {
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  getIdField: () => 'id'
};

describe('SharedLinkRepository', () => {
  let sharedLinkRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    sharedLinkRepository = new SharedLinkRepository(mockAdapter);
  });

  it('should initialize with correct collection name', () => {
    expect(sharedLinkRepository.collection).toBe('shared_links');
  });

  it('should validate required fields', () => {
    const validData = {
      share_id: 'abc123',
      conversation_id: 'conv1',
      user: 'user1'
    };

    const result = sharedLinkRepository.validateData(validData);
    expect(result.is_public).toBe(false);
  });
});

// MemoryEntryRepository.test.js - Tests for MemoryEntryRepository
const MemoryEntryRepository = require('../../dal/repositories/MemoryEntryRepository');

const mockAdapter = {
  find: jest.fn(),
  updateOne: jest.fn(),
  deleteMany: jest.fn(),
  getIdField: () => 'id'
};

describe('MemoryEntryRepository', () => {
  let memoryEntryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    memoryEntryRepository = new MemoryEntryRepository(mockAdapter);
  });

  it('should initialize with correct collection name', () => {
    expect(memoryEntryRepository.collection).toBe('memory_entries');
  });

  it('should validate required fields', () => {
    const validData = {
      user: 'user1',
      content: 'Test memory content',
      metadata: { category: 'work' }
    };

    const result = memoryEntryRepository.validateData(validData);
    expect(result.user).toBe('user1');
    expect(result.content).toBe('Test memory content');
    expect(result.metadata).toEqual({ category: 'work' });
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});

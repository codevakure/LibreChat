// PromptGroupRepository.test.js - Tests for PromptGroupRepository
const PromptGroupRepository = require('../../dal/repositories/PromptGroupRepository');

// Mock the adapter
const mockAdapter = {
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  getIdField: () => 'id'
};

describe('PromptGroupRepository', () => {
  let promptGroupRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    promptGroupRepository = new PromptGroupRepository(mockAdapter);
  });

  describe('constructor', () => {
    it('should initialize with correct collection name', () => {
      expect(promptGroupRepository.collection).toBe('prompt_groups');
    });
  });

  describe('findByName', () => {
    it('should find prompt group by name', async () => {
      const group = { id: '1', name: 'Test Group', author: 'user1' };
      mockAdapter.findOne.mockResolvedValue(group);

      const result = await promptGroupRepository.findByName('Test Group');
      expect(result).toEqual(group);
      expect(mockAdapter.findOne).toHaveBeenCalledWith('prompt_groups', { name: 'Test Group' });
    });
  });

  describe('validateData', () => {
    it('should validate valid prompt group data', () => {
      const validData = {
        name: 'Test Group',
        description: 'Test description',
        author: 'user1'
      };

      const result = promptGroupRepository.validateData(validData);
      expect(result.name).toBe('Test Group');
      expect(result.version).toBe(1);
    });

    it('should reject missing name', () => {
      const invalidData = { description: 'Test' };
      
      expect(() => promptGroupRepository.validateData(invalidData))
        .toThrow('Validation failed: Name is required and must be a string');
    });
  });
});

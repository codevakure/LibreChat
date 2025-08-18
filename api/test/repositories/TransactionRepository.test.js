// TransactionRepository.test.js - Tests for TransactionRepository
const TransactionRepository = require('../../dal/repositories/TransactionRepository');

const mockAdapter = {
  find: jest.fn(),
  deleteMany: jest.fn(),
  getIdField: () => 'id'
};

describe('TransactionRepository', () => {
  let transactionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionRepository = new TransactionRepository(mockAdapter);
  });

  it('should initialize with correct collection name', () => {
    expect(transactionRepository.collection).toBe('transactions');
  });

  it('should validate required fields', () => {
    const validData = {
      user: 'user1',
      amount: 50.75,
      type: 'credit'
    };

    const result = transactionRepository.validateData(validData);
    expect(result.amount).toBe(50.75);
    expect(result.created_at).toBeInstanceOf(Date);
  });
});

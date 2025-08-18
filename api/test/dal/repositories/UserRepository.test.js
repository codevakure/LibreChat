const { describe, it, beforeEach, expect } = require('@jest/globals');
const UserRepository = require('../../../dal/repositories/UserRepository');

// Mock the adapter
const mockAdapter = {
  findById: jest.fn(),
  findOne: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  count: jest.fn(),
  exists: jest.fn(),
  getType: () => 'mongodb'
};

describe('UserRepository', () => {
  let userRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = new UserRepository(mockAdapter);
  });

  describe('Initialization', () => {
    it('should set correct table name', () => {
      expect(userRepo.getTableName()).toBe('users');
      expect(userRepo.tableName).toBe('users');
    });

    it('should require adapter', () => {
      expect(() => new UserRepository()).toThrow('Adapter is required');
    });
  });

  describe('Data Validation', () => {
    it('should validate create data with email and username', () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser'
      };
      
      expect(() => userRepo.validateData(validData, 'create')).not.toThrow();
    });

    it('should validate create data with email and name', () => {
      const validData = {
        email: 'test@example.com',
        name: 'Test User'
      };
      
      expect(() => userRepo.validateData(validData, 'create')).not.toThrow();
    });

    it('should throw error for create without email', () => {
      const invalidData = { username: 'testuser' };
      
      expect(() => userRepo.validateData(invalidData, 'create')).toThrow('Email is required');
    });

    it('should throw error for create without username or name', () => {
      const invalidData = { email: 'test@example.com' };
      
      expect(() => userRepo.validateData(invalidData, 'create')).toThrow('Username or name is required');
    });

    it('should allow update without required fields', () => {
      const updateData = { lastLogin: new Date() };
      
      expect(() => userRepo.validateData(updateData, 'update')).not.toThrow();
    });
  });

  describe('Data Transformation', () => {
    it('should normalize email to lowercase on save', () => {
      const data = { email: 'TEST@EXAMPLE.COM', username: 'testuser' };
      const transformed = userRepo.transformDataForSave(data, 'create');
      
      expect(transformed.email).toBe('test@example.com');
    });

    it('should add timestamps on create', () => {
      const data = { email: 'test@example.com', username: 'testuser' };
      const transformed = userRepo.transformDataForSave(data, 'create');
      
      expect(transformed.createdAt).toBeInstanceOf(Date);
      expect(transformed.updatedAt).toBeInstanceOf(Date);
    });

    it('should update timestamp on update', () => {
      const data = { name: 'Updated Name' };
      const transformed = userRepo.transformDataForSave(data, 'update');
      
      expect(transformed.updatedAt).toBeInstanceOf(Date);
      expect(transformed.createdAt).toBeUndefined();
    });
  });

  describe('User-Specific Methods', () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User'
    };

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        mockAdapter.findOne.mockResolvedValue(mockUser);
        
        const result = await userRepo.findByEmail('test@example.com');
        
        expect(mockAdapter.findOne).toHaveBeenCalledWith(
          'users',
          { email: 'test@example.com' },
          {}
        );
        expect(result).toEqual(mockUser);
      });

      it('should convert email to lowercase before search', async () => {
        mockAdapter.findOne.mockResolvedValue(mockUser);
        
        await userRepo.findByEmail('TEST@EXAMPLE.COM');
        
        expect(mockAdapter.findOne).toHaveBeenCalledWith(
          'users',
          { email: 'test@example.com' },
          {}
        );
      });

      it('should throw error for empty email', async () => {
        await expect(userRepo.findByEmail('')).rejects.toThrow('Email is required');
      });
    });

    describe('findByUsername', () => {
      it('should find user by username', async () => {
        mockAdapter.findOne.mockResolvedValue(mockUser);
        
        const result = await userRepo.findByUsername('testuser');
        
        expect(mockAdapter.findOne).toHaveBeenCalledWith(
          'users',
          { username: 'testuser' },
          {}
        );
        expect(result).toEqual(mockUser);
      });

      it('should throw error for empty username', async () => {
        await expect(userRepo.findByUsername('')).rejects.toThrow('Username is required');
      });
    });

    describe('emailExists', () => {
      it('should check if email exists', async () => {
        mockAdapter.count.mockResolvedValue(1);
        
        const exists = await userRepo.emailExists('test@example.com');
        
        expect(mockAdapter.count).toHaveBeenCalledWith(
          'users',
          { email: 'test@example.com' }
        );
        expect(exists).toBe(true);
      });

      it('should exclude user ID when provided', async () => {
        mockAdapter.count.mockResolvedValue(0);
        
        await userRepo.emailExists('test@example.com', 'user123');
        
        expect(mockAdapter.count).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            email: 'test@example.com',
            _id: { $ne: 'user123' }
          })
        );
      });
    });

    describe('updateLastLogin', () => {
      it('should update last login timestamp', async () => {
        const updatedUser = { ...mockUser, lastLogin: new Date() };
        mockAdapter.updateById.mockResolvedValue(updatedUser);
        
        const result = await userRepo.updateLastLogin('123');
        
        expect(mockAdapter.updateById).toHaveBeenCalledWith(
          'users',
          '123',
          expect.objectContaining({
            lastLogin: expect.any(Date),
            updatedAt: expect.any(Date)
          })
        );
        expect(result).toEqual(updatedUser);
      });
    });

    describe('findByRole', () => {
      it('should find users by role', async () => {
        const users = [mockUser];
        mockAdapter.findMany.mockResolvedValue(users);
        
        const result = await userRepo.findByRole('admin');
        
        expect(mockAdapter.findMany).toHaveBeenCalledWith(
          'users',
          { role: 'admin' },
          {}
        );
        expect(result).toEqual(users);
      });
    });

    describe('search', () => {
      it('should search users by email, username, and name', async () => {
        const users = [mockUser];
        mockAdapter.findMany.mockResolvedValue(users);
        
        const result = await userRepo.search('test');
        
        expect(mockAdapter.findMany).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            $or: expect.arrayContaining([
              { email: expect.any(RegExp) },
              { username: expect.any(RegExp) },
              { name: expect.any(RegExp) }
            ])
          }),
          {}
        );
        expect(result).toEqual(users);
      });

      it('should return empty array for empty search term', async () => {
        const result = await userRepo.search('');
        expect(result).toEqual([]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors', async () => {
      mockAdapter.findOne.mockRejectedValue(new Error('Database error'));
      
      await expect(userRepo.findByEmail('test@example.com')).rejects.toThrow('Database error');
    });
  });
});

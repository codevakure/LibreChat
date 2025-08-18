// BannerRepository.test.js - Tests for BannerRepository
const BannerRepository = require('../../dal/repositories/BannerRepository');

// Mock the adapter
const mockAdapter = {
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  insertOne: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  deleteMany: jest.fn(),
  getIdField: () => 'id',
  generateId: () => Math.random().toString(36).substr(2, 9),
  getType: () => 'mongodb'
};

describe('BannerRepository', () => {
  let bannerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    bannerRepository = new BannerRepository(mockAdapter);
  });

  describe('constructor', () => {
    it('should initialize with correct collection name', () => {
      expect(bannerRepository.collection).toBe('banners');
      expect(bannerRepository.adapter).toBe(mockAdapter);
    });
  });

  describe('findByType', () => {
    it('should find banner by type', async () => {
      const banner = { id: '1', type: 'info', title: 'Info Banner' };
      mockAdapter.findOne.mockResolvedValue(banner);

      const result = await bannerRepository.findByType('info');
      expect(result).toEqual(banner);
      expect(mockAdapter.findOne).toHaveBeenCalledWith('banners', { type: 'info' });
    });

    it('should return null if banner not found', async () => {
      mockAdapter.findOne.mockResolvedValue(null);
      
      const result = await bannerRepository.findByType('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockAdapter.findOne.mockRejectedValue(new Error('Database error'));
      
      await expect(bannerRepository.findByType('info')).rejects.toThrow('Failed to find banner by type: Database error');
    });
  });

  describe('findActive', () => {
    it('should find active banners', async () => {
      const activeBanner = { id: '1', active: true, title: 'Active Banner' };
      mockAdapter.find.mockResolvedValue([activeBanner]);

      const result = await bannerRepository.findActive();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(activeBanner);
      expect(mockAdapter.find).toHaveBeenCalledWith('banners', { active: true });
    });

    it('should return empty array if no active banners', async () => {
      mockAdapter.find.mockResolvedValue([]);
      
      const result = await bannerRepository.findActive();
      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      mockAdapter.find.mockRejectedValue(new Error('Database error'));
      
      await expect(bannerRepository.findActive()).rejects.toThrow('Failed to find active banners: Database error');
    });
  });

  describe('updateStatus', () => {
    it('should update banner status', async () => {
      const updatedBanner = { id: '1', active: true, title: 'Test Banner', updated_at: new Date() };
      mockAdapter.updateOne.mockResolvedValue(updatedBanner);

      const result = await bannerRepository.updateStatus('1', true);
      expect(result.active).toBe(true);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(mockAdapter.updateOne).toHaveBeenCalledWith(
        'banners', 
        { id: '1' }, 
        expect.objectContaining({ active: true, updated_at: expect.any(Date) })
      );
    });

    it('should handle errors', async () => {
      mockAdapter.updateOne.mockRejectedValue(new Error('Database error'));
      
      await expect(bannerRepository.updateStatus('1', true)).rejects.toThrow('Failed to update banner status: Database error');
    });
  });

  describe('validateData', () => {
    it('should validate valid banner data', () => {
      const validData = {
        title: 'Test Banner',
        text: 'Banner text',
        type: 'info',
        bg_color: '#FF0000'
      };

      const result = bannerRepository.validateData(validData);
      expect(result.title).toBe('Test Banner');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should reject invalid title', () => {
      const invalidData = { title: 123 };
      
      expect(() => bannerRepository.validateData(invalidData))
        .toThrow('Validation failed: Title must be a string');
    });

    it('should reject invalid background color', () => {
      const invalidData = { bg_color: 'invalid-color' };
      
      expect(() => bannerRepository.validateData(invalidData))
        .toThrow('Validation failed: Background color must be a valid hex color');
    });

    it('should accept valid hex color', () => {
      const validData = { bg_color: '#FF0000' };
      const result = bannerRepository.validateData(validData);
      expect(result.bg_color).toBe('#FF0000');
    });
  });
});

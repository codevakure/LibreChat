// BannerRepository.js - System banner management repository
const BaseRepository = require('./BaseRepository');

class BannerRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter, 'banners');
  }

  /**
   * Find banner by type
   * @param {string} type - Banner type
   * @returns {Promise<Object|null>}
   */
  async findByType(type) {
    try {
      return await this.adapter.findOne(this.collection, { type });
    } catch (error) {
      throw new Error(`Failed to find banner by type: ${error.message}`);
    }
  }

  /**
   * Find active banners
   * @returns {Promise<Array>}
   */
  async findActive() {
    try {
      return await this.adapter.find(this.collection, { active: true });
    } catch (error) {
      throw new Error(`Failed to find active banners: ${error.message}`);
    }
  }

  /**
   * Update banner status
   * @param {string} id - Banner ID
   * @param {boolean} active - Active status
   * @returns {Promise<Object|null>}
   */
  async updateStatus(id, active) {
    try {
      return await this.adapter.updateOne(
        this.collection,
        { [this.adapter.getIdField()]: id },
        { active, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to update banner status: ${error.message}`);
    }
  }

  /**
   * Validate banner data
   * @param {Object} data - Banner data to validate
   * @returns {Object} Validated data
   */
  validateData(data) {
    const errors = [];

    // Title validation
    if (data.title && typeof data.title !== 'string') {
      errors.push('Title must be a string');
    }

    // Text validation
    if (data.text && typeof data.text !== 'string') {
      errors.push('Text must be a string');
    }

    // Type validation
    if (data.type && typeof data.type !== 'string') {
      errors.push('Type must be a string');
    }

    // Background color validation
    if (data.bg_color && !/^#[0-9A-F]{6}$/i.test(data.bg_color)) {
      errors.push('Background color must be a valid hex color');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      ...data,
      updated_at: new Date()
    };
  }
}

module.exports = BannerRepository;

// PromptGroupRepository.js - Prompt group management repository
const BaseRepository = require('./BaseRepository');

class PromptGroupRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter, 'prompt_groups');
  }

  /**
   * Find prompt group by name
   * @param {string} name - Group name
   * @param {string} author - Group author
   * @returns {Promise<Object|null>}
   */
  async findByName(name, author) {
    try {
      const query = { name };
      if (author) {
        query.author = author;
      }
      return await this.adapter.findOne(this.collection, query);
    } catch (error) {
      throw new Error(`Failed to find prompt group by name: ${error.message}`);
    }
  }

  /**
   * Find prompt groups by author
   * @param {string} author - Group author
   * @returns {Promise<Array>}
   */
  async findByAuthor(author) {
    try {
      return await this.adapter.find(this.collection, { author });
    } catch (error) {
      throw new Error(`Failed to find prompt groups by author: ${error.message}`);
    }
  }

  /**
   * Find prompt groups by category
   * @param {string} category - Group category
   * @returns {Promise<Array>}
   */
  async findByCategory(category) {
    try {
      return await this.adapter.find(this.collection, { category });
    } catch (error) {
      throw new Error(`Failed to find prompt groups by category: ${error.message}`);
    }
  }

  /**
   * Find production prompt groups
   * @returns {Promise<Array>}
   */
  async findProduction() {
    try {
      return await this.adapter.find(this.collection, { 
        production_id: { $ne: null, $exists: true } 
      });
    } catch (error) {
      throw new Error(`Failed to find production prompt groups: ${error.message}`);
    }
  }

  /**
   * Update group version
   * @param {string} id - Group ID
   * @param {number} version - New version number
   * @returns {Promise<Object|null>}
   */
  async updateVersion(id, version) {
    try {
      return await this.adapter.updateOne(
        this.collection,
        { [this.adapter.getIdField()]: id },
        { version, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to update prompt group version: ${error.message}`);
    }
  }

  /**
   * Validate prompt group data
   * @param {Object} data - Prompt group data to validate
   * @returns {Object} Validated data
   */
  validateData(data) {
    const errors = [];

    // Name validation
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Name is required and must be a string');
    }

    // Author validation
    if (data.author && typeof data.author !== 'string') {
      errors.push('Author must be a string');
    }

    // Category validation
    if (data.category && typeof data.category !== 'string') {
      errors.push('Category must be a string');
    }

    // Version validation
    if (data.version && (!Number.isInteger(data.version) || data.version < 1)) {
      errors.push('Version must be a positive integer');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      ...data,
      version: data.version || 1,
      updated_at: new Date()
    };
  }
}

module.exports = PromptGroupRepository;

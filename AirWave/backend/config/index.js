/**
 * Unified Configuration Module
 * 
 * Provides a single interface for accessing configuration from:
 * 1. Runtime settings (database) - highest priority
 * 2. Environment variables - medium priority
 * 3. Default values - lowest priority
 */

class Configuration {
  constructor(configManager = null) {
    this.configManager = configManager;
    this.env = process.env;
  }

  /**
   * Set the config manager (called after initialization)
   * @param {Object} configManager - ConfigManager instance
   */
  setConfigManager(configManager) {
    this.configManager = configManager;
  }

  /**
   * Get configuration value with precedence
   * @param {string} category - Configuration category
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  get(category, key, defaultValue = undefined) {
    // 1. Check runtime config (database via ConfigManager)
    if (this.configManager) {
      const runtimeValue = this.configManager.get(category, key);
      if (runtimeValue !== undefined && runtimeValue !== null) {
        return runtimeValue;
      }
    }
    
    // 2. Check environment variable
    const envKey = `${category.toUpperCase()}_${key.toUpperCase()}`;
    const envValue = this.env[envKey];
    if (envValue !== undefined) {
      return this.parseEnvValue(envValue);
    }
    
    // 3. Return default value
    return defaultValue;
  }

  /**
   * Get entire category configuration
   * @param {string} category - Configuration category
   * @returns {Object} Category configuration
   */
  getCategory(category) {
    if (this.configManager) {
      return this.configManager.getCategory(category);
    }
    return {};
  }

  /**
   * Parse environment variable value (handle booleans, numbers, JSON)
   * @param {string} value - Environment variable value
   * @returns {*} Parsed value
   */
  parseEnvValue(value) {
    // Handle booleans
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Handle null/undefined
    if (value === 'null' || value === 'undefined') return null;
    
    // Handle numbers
    if (!isNaN(value) && value.trim() !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    
    // Try to parse as JSON
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // Not valid JSON, return as string
      }
    }
    
    // Return as string
    return value;
  }

  /**
   * Validate required configuration
   * @param {Object} requirements - Required configuration object
   * @throws {Error} If required configuration is missing
   */
  validateRequired(requirements) {
    const missing = [];
    
    for (const [category, keys] of Object.entries(requirements)) {
      for (const key of keys) {
        const value = this.get(category, key);
        if (value === undefined || value === null || value === '') {
          missing.push(`${category}.${key}`);
        }
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Get all configuration (for debugging)
   * @returns {Object} All configuration
   */
  getAll() {
    if (this.configManager) {
      return this.configManager.config;
    }
    return {};
  }
}

// Export singleton instance
const config = new Configuration();

module.exports = config;


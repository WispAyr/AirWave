const AirwaveDatabase = require('../database-sqlite');
const SchemaValidator = require('../../utils/schema-validator');
const ConfigManager = require('../config-manager');

/**
 * Initialize core services (database, validator, config manager)
 * @returns {Promise<Object>} Core services object
 */
async function initializeCoreServices() {
  console.log('🔧 Initializing core services...');
  
  // Initialize database
  const database = new AirwaveDatabase();
  console.log('✅ Database initialized');
  
  // Initialize schema validator
  const validator = new SchemaValidator();
  console.log('✅ Schema validator initialized');
  
  // Initialize ConfigManager and load settings
  const configManager = new ConfigManager(database);
  await configManager.initialize();
  console.log('✅ ConfigManager initialized');
  
  return { database, validator, configManager };
}

module.exports = initializeCoreServices;


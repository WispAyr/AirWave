const DataSourceManager = require('../data-source-manager');
const OpenSkySource = require('../../sources/opensky-source');
const ADSBExchangeSource = require('../../sources/adsbexchange-source');
const AirframesClient = require('../airframes-client');
const Tar1090Client = require('../tar1090-client');

/**
 * Initialize data sources (Airframes, TAR1090, OpenSky, ADSBExchange)
 * @param {Object} params - Parameters object
 * @param {Object} params.messageProcessor - Message processor instance
 * @param {Object} params.configManager - Config manager instance
 * @param {Object} params.aircraftTracker - Aircraft tracker instance
 * @returns {Promise<Object>} Data sources object
 */
async function initializeDataSources({ messageProcessor, configManager, aircraftTracker }) {
  console.log('📡 Initializing data sources...');
  
  // Initialize Airframes client
  const airframesClient = new AirframesClient(messageProcessor);
  console.log('✅ Airframes client initialized');
  
  // Initialize TAR1090 client with aircraft tracker
  const tar1090Client = new Tar1090Client(messageProcessor, aircraftTracker);
  console.log('✅ TAR1090 client initialized');
  
  // Load TAR1090 settings and connect if enabled
  const tar1090Config = configManager.getTar1090Config();
  if (tar1090Config.enabled && tar1090Config.url) {
    console.log('🛰️  TAR1090 enabled in settings, connecting...');
    tar1090Client.connect(tar1090Config.url, tar1090Config.poll_interval);
  }
  
  // Initialize modular data source manager
  const dataSourceManager = new DataSourceManager(messageProcessor);
  
  // Register OpenSky Network source
  const openSkyConfig = configManager.getOpenSkyConfig();
  dataSourceManager.registerSource('opensky', new OpenSkySource(openSkyConfig));
  console.log('✅ OpenSky Network source registered');
  
  // Register ADS-B Exchange source
  const adsbExchangeConfig = configManager.getADSBExchangeConfig();
  dataSourceManager.registerSource('adsbexchange', new ADSBExchangeSource(adsbExchangeConfig));
  console.log('✅ ADS-B Exchange source registered');
  
  // Register Airframes.io source
  const airframesConfig = configManager.getAirframesConfig();
  dataSourceManager.registerSource('airframes', airframesClient);
  console.log('✅ Airframes.io source registered');
  
  // Auto-start enabled sources based on settings
  const sources = ['opensky', 'adsbexchange', 'airframes'];
  for (const sourceName of sources) {
    const enabled = configManager.get(sourceName, 'enabled', false);
    if (enabled) {
      console.log(`🚀 Auto-starting ${sourceName} (enabled in settings)...`);
      dataSourceManager.startSource(sourceName);
    }
  }
  
  return { dataSourceManager, airframesClient, tar1090Client };
}

/**
 * Cleanup data sources on shutdown
 * @param {Object} services - Data sources object
 */
function cleanupDataSources(services) {
  if (services.airframesClient) {
    services.airframesClient.disconnect();
  }
  if (services.tar1090Client) {
    services.tar1090Client.disconnect();
  }
  if (services.dataSourceManager) {
    services.dataSourceManager.stopAll();
  }
  console.log('✅ Data sources cleaned up');
}

module.exports = {
  initializeDataSources,
  cleanupDataSources
};


const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Repositories
const MessageRepository = require('../repositories/message-repository');
const AircraftRepository = require('../repositories/aircraft-repository');
const EAMRepository = require('../repositories/eam-repository');
const SettingsRepository = require('../repositories/settings-repository');

class AirwaveDatabase {
  constructor() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(path.join(dataDir, 'airwave.db'));
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance
    this.initialize();

    // Initialize repositories
    this.messageRepo = new MessageRepository(this.db);
    this.aircraftRepo = new AircraftRepository(this.db);
    this.eamRepo = new EAMRepository(this.db);
    this.settingsRepo = new SettingsRepository(this.db);
  }

  initialize() {
    // Enable auto-vacuum for automatic space reclamation
    this.db.pragma('auto_vacuum = INCREMENTAL');

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        flight TEXT,
        tail TEXT,
        airline TEXT,
        label TEXT,
        text TEXT,
        category TEXT,
        flight_phase TEXT,
        source_type TEXT,
        source_station TEXT,
        frequency REAL,
        
        -- Position data
        position_lat REAL,
        position_lon REAL,
        position_altitude TEXT,
        position_coordinates TEXT,
        
        -- OOOI data
        oooi_event TEXT,
        oooi_time TEXT,
        
        -- CPDLC data
        cpdlc_type TEXT,
        
        -- ADS-B specific fields
        squawk TEXT,
        ground_speed REAL,
        heading REAL,
        vertical_rate REAL,
        aircraft_type TEXT,
        
        -- Validation
        is_valid BOOLEAN,
        
        -- Full message JSON
        raw_json TEXT NOT NULL,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for fast queries
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_flight ON messages(flight);
      CREATE INDEX IF NOT EXISTS idx_airline ON messages(airline);
      CREATE INDEX IF NOT EXISTS idx_category ON messages(category);
      CREATE INDEX IF NOT EXISTS idx_flight_phase ON messages(flight_phase);
      CREATE INDEX IF NOT EXISTS idx_position ON messages(position_lat, position_lon);
      CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_oooi_event ON messages(oooi_event);

      -- Full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id UNINDEXED,
        flight,
        tail,
        airline,
        text,
        content='messages',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, id, flight, tail, airline, text)
        VALUES (new.rowid, new.id, new.flight, new.tail, new.airline, new.text);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE rowid = old.rowid;
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
        DELETE FROM messages_fts WHERE rowid = old.rowid;
        INSERT INTO messages_fts(rowid, id, flight, tail, airline, text)
        VALUES (new.rowid, new.id, new.flight, new.tail, new.airline, new.text);
      END;

      -- Statistics table for aggregations
      CREATE TABLE IF NOT EXISTS statistics (
        date TEXT PRIMARY KEY,
        total_messages INTEGER DEFAULT 0,
        by_category TEXT, -- JSON
        by_airline TEXT,   -- JSON
        by_phase TEXT,     -- JSON
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Aircraft tracking table
      CREATE TABLE IF NOT EXISTS aircraft_tracking (
        tail TEXT PRIMARY KEY,
        last_flight TEXT,
        last_airline TEXT,
        last_position_lat REAL,
        last_position_lon REAL,
        last_altitude TEXT,
        last_seen DATETIME,
        total_messages INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_aircraft_last_seen ON aircraft_tracking(last_seen);

      -- ATC preferences table
      CREATE TABLE IF NOT EXISTS atc_preferences (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        last_feed_id TEXT,
        volume REAL DEFAULT 0.7,
        auto_play BOOLEAN DEFAULT 0,
        favorite_feeds TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_atc_user_id ON atc_preferences(user_id);

      -- ATC transcriptions table
      CREATE TABLE IF NOT EXISTS atc_transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        segments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transcription_feed ON atc_transcriptions(feed_id);
      CREATE INDEX IF NOT EXISTS idx_transcription_time ON atc_transcriptions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_transcription_created ON atc_transcriptions(created_at);

      -- ATC recordings table (VOX-based segments)
      CREATE TABLE IF NOT EXISTS atc_recordings (
        segment_id TEXT PRIMARY KEY,
        feed_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        filesize INTEGER,
        transcribed BOOLEAN DEFAULT 0,
        transcription_text TEXT,
        transcription_segments TEXT,
        transcribed_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_recording_feed ON atc_recordings(feed_id);
      CREATE INDEX IF NOT EXISTS idx_recording_time ON atc_recordings(start_time);
      CREATE INDEX IF NOT EXISTS idx_recording_transcribed ON atc_recordings(transcribed);

      -- Settings table for admin configuration
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

      -- Emergency scanner preferences table
      CREATE TABLE IF NOT EXISTS emergency_preferences (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        last_feed_id TEXT,
        volume REAL DEFAULT 0.7,
        auto_play INTEGER DEFAULT 0,
        favorite_feeds TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_emergency_user_id ON emergency_preferences(user_id);

      -- Emergency scanner transcriptions table
      CREATE TABLE IF NOT EXISTS emergency_transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        segments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_emergency_feed ON emergency_transcriptions(feed_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_time ON emergency_transcriptions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_emergency_created ON emergency_transcriptions(created_at);

      -- Aircraft tracks table for ADS-B position history
      CREATE TABLE IF NOT EXISTS aircraft_tracks (
        aircraft_id TEXT PRIMARY KEY,
        hex TEXT,
        flight TEXT,
        tail TEXT,
        aircraft_type TEXT,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        position_count INTEGER DEFAULT 0,
        current_lat REAL,
        current_lon REAL,
        current_altitude TEXT,
        current_speed REAL,
        current_heading REAL,
        track_points TEXT,
        predicted_path TEXT,
        prediction_generated_at DATETIME,
        prediction_confidence REAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_flight ON aircraft_tracks(flight);
      CREATE INDEX IF NOT EXISTS idx_tracks_hex ON aircraft_tracks(hex);
      CREATE INDEX IF NOT EXISTS idx_tracks_last_seen ON aircraft_tracks(last_seen);

      -- Conflicts table for aircraft separation monitoring
      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        aircraft_1_id TEXT NOT NULL,
        aircraft_2_id TEXT NOT NULL,
        detected_at DATETIME NOT NULL,
        resolved_at DATETIME,
        min_horizontal_distance REAL NOT NULL,
        min_vertical_distance REAL NOT NULL,
        time_to_cpa INTEGER NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
      CREATE INDEX IF NOT EXISTS idx_conflicts_detected_at ON conflicts(detected_at);
      CREATE INDEX IF NOT EXISTS idx_conflicts_aircraft_1 ON conflicts(aircraft_1_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_aircraft_2 ON conflicts(aircraft_2_id);

      -- HFGCS aircraft tracking table
      CREATE TABLE IF NOT EXISTS hfgcs_aircraft (
        aircraft_id TEXT PRIMARY KEY,
        aircraft_type TEXT NOT NULL,
        hex TEXT,
        callsign TEXT,
        tail TEXT,
        first_detected TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        total_messages INTEGER DEFAULT 0,
        last_position_lat REAL,
        last_position_lon REAL,
        last_altitude TEXT,
        detection_method TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hfgcs_last_seen ON hfgcs_aircraft(last_seen);
      CREATE INDEX IF NOT EXISTS idx_hfgcs_type ON hfgcs_aircraft(aircraft_type);
      CREATE INDEX IF NOT EXISTS idx_hfgcs_hex ON hfgcs_aircraft(hex);

      -- Aircraft photos table for JetAPI photo caching
      CREATE TABLE IF NOT EXISTS aircraft_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aircraft_tail TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        thumbnail_url TEXT,
        photographer TEXT,
        upload_date TEXT,
        source TEXT,
        aircraft_type TEXT,
        local_path TEXT,
        local_filename TEXT,
        file_size INTEGER,
        downloaded_at DATETIME,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_verified DATETIME,
        UNIQUE(aircraft_tail, photo_url)
      );

      CREATE INDEX IF NOT EXISTS idx_photos_tail ON aircraft_photos(aircraft_tail);
      CREATE INDEX IF NOT EXISTS idx_photos_fetched ON aircraft_photos(fetched_at);
      CREATE INDEX IF NOT EXISTS idx_photos_source ON aircraft_photos(source);

      -- Hex to Registration cache table
      CREATE TABLE IF NOT EXISTS hex_to_registration (
        hex TEXT PRIMARY KEY,
        registration TEXT NOT NULL,
        aircraft_type TEXT,
        country TEXT,
        source TEXT,
        looked_up_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_verified DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_hex_registration ON hex_to_registration(registration);
      CREATE INDEX IF NOT EXISTS idx_hex_lookup_date ON hex_to_registration(looked_up_at);

      -- EAM Messages table
      CREATE TABLE IF NOT EXISTS eam_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT NOT NULL,
        header TEXT,
        message_body TEXT NOT NULL,
        message_length INTEGER,
        confidence_score INTEGER,
        repeat_count INTEGER DEFAULT 1,
        first_detected TEXT NOT NULL,
        last_detected TEXT NOT NULL,
        recording_ids TEXT,
        raw_transcription TEXT,
        codeword TEXT,
        time_code TEXT,
        authentication TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_eam_type ON eam_messages(message_type);
      CREATE INDEX IF NOT EXISTS idx_eam_detected ON eam_messages(first_detected);
      CREATE INDEX IF NOT EXISTS idx_eam_confidence ON eam_messages(confidence_score);
    `);

    // Run migrations for new columns
    this.runMigrations();

    console.log('✅ SQLite database initialized');
  }

  runMigrations() {
    try {
      // Migration: Add photo download columns
      const columns = this.db.pragma('table_info(aircraft_photos)').map(col => col.name);

      if (!columns.includes('local_path')) {
        console.log('🔄 Running migration: Adding photo download columns...');
        this.db.exec(`
          ALTER TABLE aircraft_photos ADD COLUMN local_path TEXT;
          ALTER TABLE aircraft_photos ADD COLUMN local_filename TEXT;
          ALTER TABLE aircraft_photos ADD COLUMN file_size INTEGER;
          ALTER TABLE aircraft_photos ADD COLUMN downloaded_at DATETIME;
        `);
        console.log('✅ Migration complete: Photo download columns added');
      }

      // Migration: Check for eam_messages table
      const tables = this.db.pragma('table_list').map(t => t.name);
      if (!tables.includes('eam_messages')) {
        console.log('🔄 Running migration: Creating eam_messages table...');
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS eam_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_type TEXT NOT NULL,
            header TEXT,
            message_body TEXT NOT NULL,
            message_length INTEGER,
            confidence_score INTEGER,
            repeat_count INTEGER DEFAULT 1,
            first_detected TEXT NOT NULL,
            last_detected TEXT NOT NULL,
            recording_ids TEXT,
            raw_transcription TEXT,
            codeword TEXT,
            time_code TEXT,
            authentication TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_eam_type ON eam_messages(message_type);
          CREATE INDEX IF NOT EXISTS idx_eam_detected ON eam_messages(first_detected);
          CREATE INDEX IF NOT EXISTS idx_eam_confidence ON eam_messages(confidence_score);
        `);
        console.log('✅ Migration complete: eam_messages table created');
      }

      // Migration: Add multi_segment tracking to eam_messages
      const eamColumns = this.db.pragma('table_info(eam_messages)').map(col => col.name);
      if (!eamColumns.includes('multi_segment')) {
        console.log('🔄 Running migration: Adding multi_segment field to eam_messages...');
        this.db.exec(`
          ALTER TABLE eam_messages ADD COLUMN multi_segment BOOLEAN DEFAULT 0;
          ALTER TABLE eam_messages ADD COLUMN segment_count INTEGER DEFAULT 1;
        `);
        console.log('✅ Migration complete: Multi-segment tracking added');
      }

      // Migration: Add start_time_ms to atc_recordings for faster time-window queries
      const recordingColumns = this.db.pragma('table_info(atc_recordings)').map(col => col.name);
      if (!recordingColumns.includes('start_time_ms')) {
        console.log('🔄 Running migration: Adding start_time_ms to atc_recordings...');
        this.db.exec(`
          ALTER TABLE atc_recordings ADD COLUMN start_time_ms INTEGER;
          UPDATE atc_recordings SET start_time_ms = CAST((julianday(start_time) - 2440587.5) * 86400000 AS INTEGER);
          CREATE INDEX IF NOT EXISTS idx_recording_time_ms ON atc_recordings(feed_id, start_time_ms);
        `);
        console.log('✅ Migration complete: start_time_ms column added and indexed');
      }

      // Migration: Add duration_seconds to eam_messages
      if (!eamColumns.includes('duration_seconds')) {
        console.log('🔄 Running migration: Adding duration_seconds to eam_messages...');
        this.db.exec(`
          ALTER TABLE eam_messages ADD COLUMN duration_seconds INTEGER;
        `);
        console.log('✅ Migration complete: duration_seconds column added');
      }

      // Migration: Add trajectory prediction columns to aircraft_tracks
      const trackColumns = this.db.pragma('table_info(aircraft_tracks)').map(col => col.name);
      if (!trackColumns.includes('predicted_path')) {
        console.log('🔄 Running migration: Adding trajectory prediction columns...');
        this.db.exec(`
          ALTER TABLE aircraft_tracks ADD COLUMN predicted_path TEXT;
          ALTER TABLE aircraft_tracks ADD COLUMN prediction_generated_at DATETIME;
          ALTER TABLE aircraft_tracks ADD COLUMN prediction_confidence REAL;
        `);
        console.log('✅ Migration complete: Trajectory prediction columns added');
      }

      // Migration: Create conflicts table
      const conflictsTableExists = tables.includes('conflicts');
      if (!conflictsTableExists) {
        console.log('🔄 Running migration: Creating conflicts table...');
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS conflicts (
            id TEXT PRIMARY KEY,
            aircraft_1_id TEXT NOT NULL,
            aircraft_2_id TEXT NOT NULL,
            detected_at DATETIME NOT NULL,
            resolved_at DATETIME,
            min_horizontal_distance REAL NOT NULL,
            min_vertical_distance REAL NOT NULL,
            time_to_cpa INTEGER NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
          CREATE INDEX IF NOT EXISTS idx_conflicts_detected_at ON conflicts(detected_at);
          CREATE INDEX IF NOT EXISTS idx_conflicts_aircraft_1 ON conflicts(aircraft_1_id);
          CREATE INDEX IF NOT EXISTS idx_conflicts_aircraft_2 ON conflicts(aircraft_2_id);
        `);
        console.log('✅ Migration complete: Conflicts table created');
      }
    } catch (error) {
      console.error('Migration error:', error.message);
      // Don't crash - migrations may have already run
    }
  }

  // ==================== Delegated Methods ====================

  saveMessage(message) {
    return this.messageRepo.saveMessage(message, this.aircraftRepo);
  }

  updateAircraftTracking(message) {
    return this.aircraftRepo.updateAircraftTracking(message);
  }

  updateStatistics(message) {
    return this.messageRepo.updateStatistics(message);
  }

  getRecentMessages(limit = 100) {
    return this.messageRepo.getRecentMessages(limit);
  }

  getMessagesByFlight(flight, limit = 50) {
    return this.messageRepo.getMessagesByFlight(flight, limit);
  }

  getMessagesByCategory(category, limit = 100) {
    return this.messageRepo.getMessagesByCategory(category, limit);
  }

  searchMessages(query, limit = 100) {
    return this.messageRepo.searchMessages(query, limit);
  }

  getStatistics(days = 7) {
    return this.messageRepo.getStatistics(days);
  }

  getCurrentStatistics() {
    return this.messageRepo.getCurrentStatistics();
  }

  getActiveAircraft(limit = 50) {
    return this.aircraftRepo.getActiveAircraft(limit);
  }

  getAircraftPositions() {
    return this.aircraftRepo.getAircraftPositions();
  }

  clearOldMessages(daysToKeep = 7) {
    return this.messageRepo.clearOldMessages(daysToKeep);
  }

  // Alias compatible with old API (if used)
  clearMessages(olderThanDays) {
    return this.messageRepo.clearOldMessages(olderThanDays);
  }

  getStats() {
    return this.messageRepo.getStats();
  }

  // Alias compatible with old API
  getDatabaseStats() {
    try {
      const pageSize = this.db.pragma('page_size', { simple: true });
      const pageCount = this.db.pragma('page_count', { simple: true });
      const freeListCount = this.db.pragma('freelist_count', { simple: true });

      const stats = {
        size: {
          totalBytes: pageSize * pageCount,
          totalMB: (pageSize * pageCount / 1024 / 1024).toFixed(2),
          freeBytes: pageSize * freeListCount,
          freeMB: (pageSize * freeListCount / 1024 / 1024).toFixed(2),
          usedPercent: ((1 - freeListCount / pageCount) * 100).toFixed(1)
        },
        tables: this.getTableSizes(),
        photos: {
          total: this.db.prepare('SELECT COUNT(*) as count FROM aircraft_photos').get().count,
          downloaded: this.db.prepare('SELECT COUNT(*) as count FROM aircraft_photos WHERE local_path IS NOT NULL').get().count,
          pending: this.db.prepare('SELECT COUNT(*) as count FROM aircraft_photos WHERE local_path IS NULL').get().count,
          totalSizeMB: this.db.prepare('SELECT COALESCE(SUM(file_size), 0) as size FROM aircraft_photos').get().size / 1024 / 1024
        },
        performance: {
          wal_mode: this.db.pragma('journal_mode', { simple: true }),
          cache_size_kb: Math.abs(this.db.pragma('cache_size', { simple: true })) * pageSize / 1024,
          mmap_size_mb: this.db.pragma('mmap_size', { simple: true }) / 1024 / 1024
        }
      };

      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }

  saveATCPreferences(userId, preferences) {
    return this.settingsRepo.saveATCPreferences(userId, preferences);
  }

  getATCPreferences(userId) {
    return this.settingsRepo.getATCPreferences(userId);
  }

  addFavoriteFeed(userId, feedId) {
    return this.settingsRepo.addFavoriteFeed(userId, feedId);
  }

  removeFavoriteFeed(userId, feedId) {
    return this.settingsRepo.removeFavoriteFeed(userId, feedId);
  }

  saveTranscription(data) {
    return this.settingsRepo.saveTranscription(data);
  }

  getRecentTranscriptions(feedId, limit = 50) {
    return this.settingsRepo.getRecentTranscriptions(feedId, limit);
  }

  getAllRecentTranscriptions(limit = 100) {
    return this.settingsRepo.getAllRecentTranscriptions(limit);
  }

  deleteOldTranscriptions(daysToKeep = 7) {
    return this.settingsRepo.deleteOldTranscriptions(daysToKeep);
  }

  // Alias
  clearTranscriptions() {
    // This removes ALL transcriptions, not just old ones, based on the original code
    try {
      const atc = this.db.prepare('DELETE FROM atc_transcriptions').run();
      const emergency = this.db.prepare('DELETE FROM emergency_transcriptions').run();
      console.log(`🗑️  Deleted ${atc.changes} ATC + ${emergency.changes} emergency transcriptions`);
      return atc.changes + emergency.changes;
    } catch (error) {
      console.error('Error clearing transcriptions:', error);
      return 0;
    }
  }

  saveATCRecording(data) {
    return this.settingsRepo.saveATCRecording(data);
  }

  updateRecordingTranscription(segmentId, data) {
    return this.settingsRepo.updateRecordingTranscription(segmentId, data);
  }

  getRecordings(feedId = null, limit = 100) {
    return this.settingsRepo.getRecordings(feedId, limit);
  }

  getRecordingBySegmentId(segmentId) {
    return this.settingsRepo.getRecordingBySegmentId(segmentId);
  }

  getRecordingsInTimeWindow(feedId, centerTimestamp, windowSeconds) {
    return this.settingsRepo.getRecordingsInTimeWindow(feedId, centerTimestamp, windowSeconds);
  }

  deleteRecording(segmentId) {
    return this.settingsRepo.deleteRecording(segmentId);
  }

  // Alias
  clearRecordingEntries() {
    try {
      const stmt = this.db.prepare('DELETE FROM atc_recordings');
      const result = stmt.run();
      console.log(`🗑️  Deleted ${result.changes} recording entries`);
      return result.changes;
    } catch (error) {
      console.error('Error clearing recordings:', error);
      return 0;
    }
  }

  getRecordingStats() {
    return this.settingsRepo.getRecordingStats();
  }

  saveEAMMessage(data) {
    return this.eamRepo.saveEAMMessage(data);
  }

  updateEAMRepeat(eamId, newRecordingIds) {
    return this.eamRepo.updateEAMRepeat(eamId, newRecordingIds);
  }

  getEAMMessages(options = {}) {
    return this.eamRepo.getEAMMessages(options);
  }

  getEAMById(id) {
    return this.eamRepo.getEAMById(id);
  }

  getEAMStatistics() {
    return this.eamRepo.getEAMStatistics();
  }

  searchEAMs(query, limit = 50) {
    return this.eamRepo.searchEAMs(query, limit);
  }

  getEAMsByRecordingId(segmentId) {
    return this.eamRepo.getEAMsByRecordingId(segmentId);
  }

  clearEAMs(olderThanDays = 30) {
    return this.eamRepo.clearEAMs(olderThanDays);
  }

  deleteEAM(id) {
    return this.eamRepo.deleteEAM(id);
  }

  getSetting(key) {
    return this.settingsRepo.getSetting(key);
  }

  setSetting(key, value, category) {
    return this.settingsRepo.setSetting(key, value, category);
  }

  getSettingsByCategory(category) {
    return this.settingsRepo.getSettingsByCategory(category);
  }

  getAllSettings() {
    return this.settingsRepo.getAllSettings();
  }

  deleteSetting(key) {
    return this.settingsRepo.deleteSetting(key);
  }

  saveAircraftTrack(track) {
    return this.aircraftRepo.saveAircraftTrack(track);
  }

  getAircraftTracks(limit = 100) {
    return this.aircraftRepo.getAircraftTracks(limit);
  }

  getAircraftTrack(aircraftId) {
    return this.aircraftRepo.getAircraftTrack(aircraftId);
  }

  getAircraftByIdentifier(identifier) {
    return this.aircraftRepo.getAircraftByIdentifier(identifier);
  }

  saveHFGCSAircraft(aircraft) {
    return this.aircraftRepo.saveHFGCSAircraft(aircraft);
  }

  getActiveHFGCSAircraft(limit = 50, hoursBack = 24) {
    return this.aircraftRepo.getActiveHFGCSAircraft(limit, hoursBack);
  }

  getHFGCSAircraftById(id) {
    return this.aircraftRepo.getHFGCSAircraftById(id);
  }

  getHFGCSStatistics() {
    return this.aircraftRepo.getHFGCSStatistics();
  }

  getHFGCSHistory(days = 7) {
    return this.aircraftRepo.getHFGCSHistory(days);
  }

  saveEmergencyPreferences(userId, preferences) {
    return this.settingsRepo.saveEmergencyPreferences(userId, preferences);
  }

  getEmergencyPreferences(userId) {
    return this.settingsRepo.getEmergencyPreferences(userId);
  }

  addEmergencyFavorite(userId, feedId) {
    return this.settingsRepo.addEmergencyFavorite(userId, feedId);
  }

  removeEmergencyFavorite(userId, feedId) {
    return this.settingsRepo.removeEmergencyFavorite(userId, feedId);
  }

  saveAircraftPhotos(tail, photos) {
    return this.aircraftRepo.saveAircraftPhotos(tail, photos);
  }

  getAircraftPhotos(identifier, limit = 10) {
    return this.aircraftRepo.getAircraftPhotos(identifier, limit);
  }

  deleteStalePhotos(daysToKeep = 30) {
    return this.aircraftRepo.deleteStalePhotos(daysToKeep);
  }

  clearPhotoEntries(olderThanDays = null) {
    try {
      let result;
      if (olderThanDays) {
        const stmt = this.db.prepare(`
            DELETE FROM aircraft_photos 
            WHERE fetched_at < datetime('now', '-' || ? || ' days')
          `);
        result = stmt.run(olderThanDays);
      } else {
        const stmt = this.db.prepare('DELETE FROM aircraft_photos');
        result = stmt.run();
      }
      console.log(`🗑️  Cleared ${result.changes} photo entries`);
      return result.changes;
    } catch (error) {
      console.error('Error clearing photo entries:', error);
      return 0;
    }
  }

  getPhotoStats() {
    return this.aircraftRepo.getPhotoStats();
  }

  updatePhotoVerification(photoId, verified = true) {
    return this.aircraftRepo.updatePhotoVerification(photoId, verified);
  }

  clearStaleAircraft(olderThanHours = 24) {
    return this.aircraftRepo.clearStaleAircraft(olderThanHours);
  }

  clearHexToRegCache(olderThanDays = null) {
    try {
      let result;
      if (olderThanDays) {
        const stmt = this.db.prepare(`
          DELETE FROM hex_to_registration 
          WHERE looked_up_at < datetime('now', '-' || ? || ' days')
        `);
        result = stmt.run(olderThanDays);
      } else {
        const stmt = this.db.prepare('DELETE FROM hex_to_registration');
        result = stmt.run();
      }
      console.log(`🗑️  Cleared ${result.changes} hex-to-reg entries`);
      return result.changes;
    } catch (error) {
      console.error('Error clearing hex-to-reg cache:', error);
      return 0;
    }
  }

  getTableSizes() {
    try {
      const tables = [
        'messages',
        'messages_fts',
        'statistics',
        'aircraft_tracking',
        'aircraft_tracks',
        'aircraft_photos',
        'hex_to_registration',
        'atc_transcriptions',
        'atc_recordings',
        'atc_preferences',
        'emergency_preferences',
        'emergency_transcriptions',
        'settings'
      ];

      const sizes = {};

      for (const table of tables) {
        try {
          const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          sizes[table] = result.count;
        } catch (error) {
          sizes[table] = 0;
        }
      }

      return sizes;
    } catch (error) {
      console.error('Error getting table sizes:', error);
      return {};
    }
  }

  optimizeDatabase() {
    try {
      this.db.pragma('optimize');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  runMaintenance(options = {}) {
    try {
      console.log('🧹 Running full database maintenance...');

      const results = {
        timestamp: new Date().toISOString(),
        operations: []
      };

      // Clear old messages
      if (options.clearOldMessages !== false) {
        const days = options.messageRetentionDays || 30;
        const deleted = this.clearMessages(days);
        results.operations.push({ operation: 'clear_old_messages', deleted, days });
      }

      // Clear stale aircraft
      if (options.clearStaleAircraft !== false) {
        const hours = options.aircraftRetentionHours || 48;
        const deleted = this.clearStaleAircraft(hours);
        results.operations.push({ operation: 'clear_stale_aircraft', deleted, hours });
      }

      // Clear old photos
      if (options.clearOldPhotos !== false) {
        const days = options.photoRetentionDays || 60;
        const deleted = this.deleteStalePhotos(days);
        results.operations.push({ operation: 'clear_old_photos', deleted, days });
      }

      // Optimize database
      if (options.optimize !== false) {
        const optimizeResult = this.optimizeDatabase();
        results.operations.push({ operation: 'optimize', ...optimizeResult });
      }

      // Get final stats
      results.finalStats = this.getDatabaseStats();

      console.log('✅ Database maintenance complete');

      return results;
    } catch (error) {
      console.error('Error running maintenance:', error);
      return { success: false, error: error.message };
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = AirwaveDatabase;

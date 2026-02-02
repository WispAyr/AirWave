const BaseRepository = require('./base-repository');

class SettingsRepository extends BaseRepository {
    saveATCPreferences(userId, preferences) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO atc_preferences (user_id, last_feed_id, volume, auto_play, favorite_feeds, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          last_feed_id = excluded.last_feed_id,
          volume = excluded.volume,
          auto_play = excluded.auto_play,
          favorite_feeds = excluded.favorite_feeds,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = excluded.user_id
      `);

            stmt.run(
                userId,
                preferences.lastFeedId || null,
                preferences.volume || 0.7,
                preferences.autoPlay ? 1 : 0,
                JSON.stringify(preferences.favoriteFeeds || [])
            );

            return true;
        } catch (error) {
            console.error('Error saving ATC preferences:', error);
            return false;
        }
    }

    getATCPreferences(userId) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM atc_preferences WHERE user_id = ? LIMIT 1
      `);

            const row = stmt.get(userId);

            if (!row) {
                return {
                    lastFeedId: null,
                    volume: 0.7,
                    autoPlay: false,
                    favoriteFeeds: []
                };
            }

            return {
                lastFeedId: row.last_feed_id,
                volume: row.volume,
                autoPlay: row.auto_play === 1,
                favoriteFeeds: JSON.parse(row.favorite_feeds || '[]')
            };
        } catch (error) {
            console.error('Error getting ATC preferences:', error);
            return {
                lastFeedId: null,
                volume: 0.7,
                autoPlay: false,
                favoriteFeeds: []
            };
        }
    }

    addFavoriteFeed(userId, feedId) {
        try {
            const prefs = this.getATCPreferences(userId);
            if (!prefs.favoriteFeeds.includes(feedId)) {
                prefs.favoriteFeeds.push(feedId);
                this.saveATCPreferences(userId, prefs);
            }
            return true;
        } catch (error) {
            console.error('Error adding favorite feed:', error);
            return false;
        }
    }

    removeFavoriteFeed(userId, feedId) {
        try {
            const prefs = this.getATCPreferences(userId);
            prefs.favoriteFeeds = prefs.favoriteFeeds.filter(id => id !== feedId);
            this.saveATCPreferences(userId, prefs);
            return true;
        } catch (error) {
            console.error('Error removing favorite feed:', error);
            return false;
        }
    }

    saveTranscription(data) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO atc_transcriptions (feed_id, text, timestamp, segments)
        VALUES (?, ?, ?, ?)
      `);

            stmt.run(
                data.feedId,
                data.text,
                data.timestamp,
                JSON.stringify(data.segments || [])
            );

            return true;
        } catch (error) {
            console.error('Error saving transcription:', error);
            return false;
        }
    }

    getRecentTranscriptions(feedId, limit = 50) {
        try {
            const stmt = this.db.prepare(`
        SELECT id, feed_id, text, timestamp, segments, created_at
        FROM atc_transcriptions 
        WHERE feed_id = ?
        ORDER BY timestamp DESC 
        LIMIT ?
      `);

            const rows = stmt.all(feedId, limit);
            return rows.map(row => ({
                ...row,
                segments: JSON.parse(row.segments || '[]')
            }));
        } catch (error) {
            console.error('Error getting transcriptions:', error);
            return [];
        }
    }

    getAllRecentTranscriptions(limit = 100) {
        try {
            const stmt = this.db.prepare(`
        SELECT id, feed_id, text, timestamp, segments, created_at
        FROM atc_transcriptions 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);

            const rows = stmt.all(limit);
            return rows.map(row => ({
                ...row,
                segments: JSON.parse(row.segments || '[]')
            }));
        } catch (error) {
            console.error('Error getting all transcriptions:', error);
            return [];
        }
    }

    deleteOldTranscriptions(daysToKeep = 7) {
        try {
            const stmt = this.db.prepare(`
        DELETE FROM atc_transcriptions 
        WHERE created_at < datetime('now', '-' || ? || ' days')
      `);

            const result = stmt.run(daysToKeep);
            console.log(`🗑️  Cleaned up ${result.changes} transcriptions older than ${daysToKeep} days`);
            return result.changes;
        } catch (error) {
            console.error('Error deleting old transcriptions:', error);
            return 0;
        }
    }

    saveATCRecording(data) {
        try {
            // Calculate start_time_ms from ISO timestamp
            const startTimeMs = new Date(data.startTime).getTime();

            const stmt = this.db.prepare(`
        INSERT INTO atc_recordings (
          segment_id, feed_id, start_time, start_time_ms, duration, filename, filepath, filesize, transcribed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            stmt.run(
                data.segmentId,
                data.feedId,
                data.startTime,
                startTimeMs,
                data.duration,
                data.filename,
                data.filepath,
                data.filesize,
                data.transcribed ? 1 : 0
            );

            return true;
        } catch (error) {
            console.error('Error saving ATC recording:', error);
            return false;
        }
    }

    updateRecordingTranscription(segmentId, data) {
        try {
            const stmt = this.db.prepare(`
        UPDATE atc_recordings 
        SET transcription_text = ?,
            transcription_segments = ?,
            transcribed = 1,
            transcribed_at = ?
        WHERE segment_id = ?
      `);

            stmt.run(
                data.text,
                JSON.stringify(data.segments || []),
                data.transcribedAt,
                segmentId
            );

            return true;
        } catch (error) {
            console.error('Error updating recording transcription:', error);
            return false;
        }
    }

    getRecordings(feedId = null, limit = 100) {
        try {
            let stmt;
            let rows;

            if (feedId) {
                stmt = this.db.prepare(`
          SELECT * FROM atc_recordings 
          WHERE feed_id = ?
          ORDER BY start_time DESC 
          LIMIT ?
        `);
                rows = stmt.all(feedId, limit);
            } else {
                stmt = this.db.prepare(`
          SELECT * FROM atc_recordings 
          ORDER BY start_time DESC 
          LIMIT ?
        `);
                rows = stmt.all(limit);
            }

            // Map database fields to API response format
            return rows.map(row => ({
                id: row.segment_id,
                segment_id: row.segment_id,
                feed_id: row.feed_id,
                timestamp: row.start_time,
                start_time: row.start_time,
                duration: row.duration,
                filename: row.filename,
                filepath: row.filepath,
                filesize: row.filesize,
                transcribed: row.transcribed === 1,
                transcription: row.transcription_text,
                transcription_text: row.transcription_text,
                transcription_segments: JSON.parse(row.transcription_segments || '[]'),
                transcribed_at: row.transcribed_at,
                created_at: row.created_at
            }));
        } catch (error) {
            console.error('Error getting recordings:', error);
            return [];
        }
    }

    getRecordingBySegmentId(segmentId) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM atc_recordings WHERE segment_id = ?
      `);

            const row = stmt.get(segmentId);
            if (!row) return null;

            return {
                ...row,
                transcribed: row.transcribed === 1,
                transcription_segments: JSON.parse(row.transcription_segments || '[]')
            };
        } catch (error) {
            console.error('Error getting recording:', error);
            return null;
        }
    }

    getRecordingsInTimeWindow(feedId, centerTimestamp, windowSeconds) {
        try {
            // Convert centerTimestamp to epoch milliseconds
            const centerMs = new Date(centerTimestamp).getTime();
            const windowMs = windowSeconds * 1000;
            const startMs = centerMs - windowMs;
            const endMs = centerMs + windowMs;

            const stmt = this.db.prepare(`
        SELECT * FROM atc_recordings 
        WHERE feed_id = ? 
        AND transcribed = 1 
        AND start_time_ms BETWEEN ? AND ?
        ORDER BY start_time_ms ASC
      `);

            const rows = stmt.all(feedId, startMs, endMs);

            return rows.map(row => ({
                ...row,
                transcribed: row.transcribed === 1,
                transcription_segments: JSON.parse(row.transcription_segments || '[]')
            }));
        } catch (error) {
            console.error('Error getting recordings in time window:', error);
            return [];
        }
    }

    deleteRecording(segmentId) {
        try {
            const stmt = this.db.prepare(`
        DELETE FROM atc_recordings WHERE segment_id = ?
      `);

            stmt.run(segmentId);
            return true;
        } catch (error) {
            console.error('Error deleting recording:', error);
            return false;
        }
    }

    getRecordingStats() {
        try {
            const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN transcribed = 1 THEN 1 ELSE 0 END) as transcribed,
          SUM(duration) as total_duration,
          SUM(filesize) as total_size
        FROM atc_recordings
      `).get();

            return {
                totalRecordings: stats.total,
                transcribed: stats.transcribed,
                pending: stats.total - stats.transcribed,
                totalDuration: stats.total_duration,
                totalSize: stats.total_size
            };
        } catch (error) {
            console.error('Error getting recording stats:', error);
            return null;
        }
    }

    getSetting(key) {
        try {
            const stmt = this.db.prepare(`
        SELECT value, category FROM settings WHERE key = ?
      `);

            const row = stmt.get(key);
            return row ? { value: row.value, category: row.category } : null;
        } catch (error) {
            console.error('Error getting setting:', error);
            return null;
        }
    }

    setSetting(key, value, category) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO settings (key, value, category, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          category = excluded.category,
          updated_at = CURRENT_TIMESTAMP
      `);

            stmt.run(key, value, category);
            return true;
        } catch (error) {
            console.error('Error setting setting:', error);
            return false;
        }
    }

    getSettingsByCategory(category) {
        try {
            const stmt = this.db.prepare(`
        SELECT key, value, updated_at FROM settings WHERE category = ?
      `);

            return stmt.all(category);
        } catch (error) {
            console.error('Error getting settings by category:', error);
            return [];
        }
    }

    getAllSettings() {
        try {
            const stmt = this.db.prepare(`
        SELECT key, value, category, updated_at FROM settings
      `);

            return stmt.all();
        } catch (error) {
            console.error('Error getting all settings:', error);
            return [];
        }
    }

    deleteSetting(key) {
        try {
            const stmt = this.db.prepare(`
        DELETE FROM settings WHERE key = ?
      `);

            const result = stmt.run(key);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting setting:', error);
            return false;
        }
    }

    saveEmergencyPreferences(userId, preferences) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO emergency_preferences (user_id, last_feed_id, volume, auto_play, favorite_feeds, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          last_feed_id = excluded.last_feed_id,
          volume = excluded.volume,
          auto_play = excluded.auto_play,
          favorite_feeds = excluded.favorite_feeds,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = excluded.user_id
      `);

            stmt.run(
                userId,
                preferences.lastFeedId || null,
                preferences.volume || 0.7,
                preferences.autoPlay ? 1 : 0,
                JSON.stringify(preferences.favoriteFeeds || [])
            );

            return true;
        } catch (error) {
            console.error('Error saving emergency preferences:', error);
            return false;
        }
    }

    getEmergencyPreferences(userId) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM emergency_preferences WHERE user_id = ? LIMIT 1
      `);

            const row = stmt.get(userId);

            if (!row) {
                return {
                    lastFeedId: null,
                    volume: 0.7,
                    autoPlay: false,
                    favoriteFeeds: []
                };
            }

            return {
                lastFeedId: row.last_feed_id,
                volume: row.volume,
                autoPlay: row.auto_play === 1,
                favoriteFeeds: JSON.parse(row.favorite_feeds || '[]')
            };
        } catch (error) {
            console.error('Error getting emergency preferences:', error);
            return {
                lastFeedId: null,
                volume: 0.7,
                autoPlay: false,
                favoriteFeeds: []
            };
        }
    }

    addEmergencyFavorite(userId, feedId) {
        try {
            const prefs = this.getEmergencyPreferences(userId);
            if (!prefs.favoriteFeeds.includes(feedId)) {
                prefs.favoriteFeeds.push(feedId);
                this.saveEmergencyPreferences(userId, prefs);
            }
            return true;
        } catch (error) {
            console.error('Error adding emergency favorite feed:', error);
            return false;
        }
    }

    removeEmergencyFavorite(userId, feedId) {
        try {
            const prefs = this.getEmergencyPreferences(userId);
            prefs.favoriteFeeds = prefs.favoriteFeeds.filter(id => id !== feedId);
            this.saveEmergencyPreferences(userId, prefs);
            return true;
        } catch (error) {
            console.error('Error removing emergency favorite feed:', error);
            return false;
        }
    }
}

module.exports = SettingsRepository;

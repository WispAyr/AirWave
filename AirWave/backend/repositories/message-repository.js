const BaseRepository = require('./base-repository');

class MessageRepository extends BaseRepository {
    constructor(database) {
        super(database);
    }

    saveMessage(message, aircraftRepository) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO messages (
          id, timestamp, flight, tail, airline, label, text,
          category, flight_phase, source_type, source_station, frequency,
          position_lat, position_lon, position_altitude, position_coordinates,
          oooi_event, oooi_time, cpdlc_type,
          squawk, ground_speed, heading, vertical_rate, aircraft_type,
          is_valid, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            stmt.run(
                message.id,
                message.timestamp,
                message.flight || null,
                message.tail || null,
                message.airline || null,
                message.label || null,
                message.text || null,
                message.category || null,
                message.flight_phase || null,
                message.source?.type || message.source_type || null,
                message.source?.station_id || null,
                message.source?.frequency || null,
                message.position?.lat || null,
                message.position?.lon || null,
                message.position?.altitude || null,
                message.position?.coordinates || null,
                message.oooi?.event || null,
                message.oooi?.time || null,
                message.cpdlc?.type || null,
                message.squawk || null,
                message.ground_speed || null,
                message.heading || null,
                message.vertical_rate || null,
                message.aircraft_type || null,
                message.validation?.valid ? 1 : 0,
                JSON.stringify(message)
            );

            // Update aircraft tracking - delegated to AircraftRepository if provided
            if (message.tail && aircraftRepository) {
                aircraftRepository.updateAircraftTracking(message);
            } else if (message.tail) {
                // Fallback if no repo provided keeping old logic inline is risky, better to rely on caller
                // providing the repo.
            }

            // Update daily statistics
            this.updateStatistics(message);

            return true;
        } catch (error) {
            console.error('Error saving message to database:', error);
            return false;
        }
    }

    updateStatistics(message) {
        const date = message.timestamp.split('T')[0];

        const row = this.db.prepare('SELECT * FROM statistics WHERE date = ?').get(date);

        if (!row) {
            this.db.prepare(`
        INSERT INTO statistics (date, total_messages, by_category, by_airline, by_phase)
        VALUES (?, 1, ?, ?, ?)
      `).run(
                date,
                JSON.stringify({ [message.category || 'unknown']: 1 }),
                JSON.stringify({ [message.airline || 'unknown']: 1 }),
                JSON.stringify({ [message.flight_phase || 'unknown']: 1 })
            );
        } else {
            const byCategory = JSON.parse(row.by_category);
            const byAirline = JSON.parse(row.by_airline);
            const byPhase = JSON.parse(row.by_phase);

            byCategory[message.category || 'unknown'] = (byCategory[message.category || 'unknown'] || 0) + 1;
            byAirline[message.airline || 'unknown'] = (byAirline[message.airline || 'unknown'] || 0) + 1;
            byPhase[message.flight_phase || 'unknown'] = (byPhase[message.flight_phase || 'unknown'] || 0) + 1;

            this.db.prepare(`
        UPDATE statistics 
        SET total_messages = total_messages + 1,
            by_category = ?,
            by_airline = ?,
            by_phase = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `).run(
                JSON.stringify(byCategory),
                JSON.stringify(byAirline),
                JSON.stringify(byPhase),
                date
            );
        }
    }

    getRecentMessages(limit = 100) {
        const stmt = this.db.prepare(`
      SELECT raw_json FROM messages 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

        return stmt.all(limit).map(row => JSON.parse(row.raw_json));
    }

    getMessagesByFlight(flight, limit = 50) {
        const stmt = this.db.prepare(`
      SELECT raw_json FROM messages 
      WHERE flight = ? OR tail = ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

        return stmt.all(flight, flight, limit).map(row => JSON.parse(row.raw_json));
    }

    getMessagesByCategory(category, limit = 100) {
        const stmt = this.db.prepare(`
      SELECT raw_json FROM messages 
      WHERE category = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

        return stmt.all(category, limit).map(row => JSON.parse(row.raw_json));
    }

    searchMessages(query, limit = 100) {
        const stmt = this.db.prepare(`
      SELECT m.raw_json 
      FROM messages_fts fts
      JOIN messages m ON fts.rowid = m.rowid
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

        return stmt.all(query, limit).map(row => JSON.parse(row.raw_json));
    }

    getStatistics(days = 7) {
        const stmt = this.db.prepare(`
      SELECT * FROM statistics 
      ORDER BY date DESC 
      LIMIT ?
    `);

        return stmt.all(days);
    }

    getCurrentStatistics() {
        const total = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();

        const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM messages 
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `).all();

        const byAirline = this.db.prepare(`
      SELECT airline, COUNT(*) as count 
      FROM messages 
      WHERE airline IS NOT NULL
      GROUP BY airline
      ORDER BY count DESC
      LIMIT 10
    `).all();

        const byPhase = this.db.prepare(`
      SELECT flight_phase, COUNT(*) as count 
      FROM messages 
      WHERE flight_phase IS NOT NULL
      GROUP BY flight_phase
      ORDER BY count DESC
    `).all();

        return {
            total: total.count,
            byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
            byAirline: Object.fromEntries(byAirline.map(r => [r.airline, r.count])),
            byPhase: Object.fromEntries(byPhase.map(r => [r.flight_phase, r.count])),
        };
    }

    clearOldMessages(daysToKeep = 7) {
        const stmt = this.db.prepare(`
      DELETE FROM messages 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);

        const result = stmt.run(daysToKeep);
        console.log(`🗑️  Cleaned up ${result.changes} messages older than ${daysToKeep} days`);
        return result.changes;
    }

    getStats() {
        const size = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `).get();

        const counts = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM messages) as messages,
        (SELECT COUNT(*) FROM aircraft_tracking) as aircraft,
        (SELECT COUNT(*) FROM statistics) as days
    `).get();

        return {
            database_size: size.size,
            database_size_mb: (size.size / 1024 / 1024).toFixed(2),
            total_messages: counts.messages,
            tracked_aircraft: counts.aircraft,
            days_tracked: counts.days,
        };
    }
}

module.exports = MessageRepository;

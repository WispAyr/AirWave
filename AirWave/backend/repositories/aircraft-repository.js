const BaseRepository = require('./base-repository');

class AircraftRepository extends BaseRepository {
    saveAircraftTrack(track) {
        try {
            const currentPos = track.current_position || {};

            const stmt = this.db.prepare(`
        INSERT INTO aircraft_tracks (
          aircraft_id, hex, flight, tail, aircraft_type,
          first_seen, last_seen, position_count,
          current_lat, current_lon, current_altitude,
          current_speed, current_heading, track_points,
          predicted_path, prediction_generated_at, prediction_confidence,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(aircraft_id) DO UPDATE SET
          flight = excluded.flight,
          tail = excluded.tail,
          aircraft_type = excluded.aircraft_type,
          last_seen = excluded.last_seen,
          position_count = excluded.position_count,
          current_lat = excluded.current_lat,
          current_lon = excluded.current_lon,
          current_altitude = excluded.current_altitude,
          current_speed = excluded.current_speed,
          current_heading = excluded.current_heading,
          track_points = excluded.track_points,
          predicted_path = excluded.predicted_path,
          prediction_generated_at = excluded.prediction_generated_at,
          prediction_confidence = excluded.prediction_confidence,
          updated_at = CURRENT_TIMESTAMP
      `);

            stmt.run(
                track.aircraft_id,
                track.hex,
                track.flight,
                track.tail,
                track.aircraft_type,
                track.first_seen,
                track.last_seen,
                track.position_count,
                currentPos.lat || null,
                currentPos.lon || null,
                currentPos.altitude || null,
                currentPos.ground_speed || null,
                currentPos.heading || null,
                JSON.stringify(track.track_points || []),
                track.predicted_path || null,
                track.prediction_generated_at || null,
                track.prediction_confidence || null
            );

            return true;
        } catch (error) {
            console.error('Error saving aircraft track:', error);
            return false;
        }
    }

    getAircraftTracks(limit = 100) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM aircraft_tracks 
        ORDER BY last_seen DESC 
        LIMIT ?
      `);

            const rows = stmt.all(limit);
            return rows.map(row => ({
                ...row,
                track_points: JSON.parse(row.track_points || '[]'),
                predicted_path: row.predicted_path ? JSON.parse(row.predicted_path) : []
            }));
        } catch (error) {
            console.error('Error getting aircraft tracks:', error);
            return [];
        }
    }

    getAircraftTrack(aircraftId) {
        try {
            // Try multiple lookup strategies
            let stmt = this.db.prepare(`
        SELECT * FROM aircraft_tracks WHERE aircraft_id = ?
      `);
            let row = stmt.get(aircraftId);

            // If not found, try flight field
            if (!row) {
                stmt = this.db.prepare(`
          SELECT * FROM aircraft_tracks WHERE flight = ?
        `);
                row = stmt.get(aircraftId);
            }

            // If not found, try tail field
            if (!row) {
                stmt = this.db.prepare(`
          SELECT * FROM aircraft_tracks WHERE tail = ?
        `);
                row = stmt.get(aircraftId);
            }

            // If not found, try hex field
            if (!row) {
                stmt = this.db.prepare(`
          SELECT * FROM aircraft_tracks WHERE hex = ?
        `);
                row = stmt.get(aircraftId);
            }

            if (!row) return null;

            return {
                ...row,
                track_points: JSON.parse(row.track_points || '[]'),
                predicted_path: row.predicted_path ? JSON.parse(row.predicted_path) : []
            };
        } catch (error) {
            console.error('Error getting aircraft track:', error);
            return null;
        }
    }

    getAircraftByIdentifier(identifier) {
        try {
            // Unified lookup method - returns most recent track
            const stmt = this.db.prepare(`
        SELECT * FROM aircraft_tracks 
        WHERE aircraft_id = ? OR flight = ? OR tail = ? OR hex = ?
        ORDER BY last_seen DESC
        LIMIT 1
      `);

            const row = stmt.get(identifier, identifier, identifier, identifier);
            if (!row) return null;

            return {
                ...row,
                track_points: JSON.parse(row.track_points || '[]'),
                predicted_path: row.predicted_path ? JSON.parse(row.predicted_path) : []
            };
        } catch (error) {
            console.error('Error getting aircraft by identifier:', error);
            return null;
        }
    }

    updateAircraftTracking(message) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO aircraft_tracking (
          tail, last_flight, last_airline, 
          last_position_lat, last_position_lon, last_altitude,
          last_seen, total_messages
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(tail) DO UPDATE SET
          last_flight = excluded.last_flight,
          last_airline = excluded.last_airline,
          last_position_lat = COALESCE(excluded.last_position_lat, last_position_lat),
          last_position_lon = COALESCE(excluded.last_position_lon, last_position_lon),
          last_altitude = COALESCE(excluded.last_altitude, last_altitude),
          last_seen = excluded.last_seen,
          total_messages = total_messages + 1
      `);

            stmt.run(
                message.tail,
                message.flight || null,
                message.airline || null,
                message.position?.lat || null,
                message.position?.lon || null,
                message.position?.altitude || null,
                message.timestamp
            );
            return true;
        } catch (error) {
            console.error('Error updating aircraft tracking:', error);
            return false;
        }
    }

    getActiveAircraft(limit = 50) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM aircraft_tracking 
        ORDER BY last_seen DESC 
        LIMIT ?
      `);

            return stmt.all(limit);
        } catch (error) {
            console.error('Error getting active aircraft:', error);
            return [];
        }
    }

    getAircraftPositions() {
        try {
            // Get ACARS positions from messages table
            const acarsPositions = this.db.prepare(`
        SELECT flight, tail, airline, position_lat, position_lon, 
               position_altitude, timestamp, raw_json
        FROM messages
        WHERE position_lat IS NOT NULL 
          AND position_lon IS NOT NULL
          AND timestamp > datetime('now', '-6 hours')
        ORDER BY timestamp DESC
      `).all();

            // Get ADS-B positions from aircraft_tracks table
            const adsbTracks = this.db.prepare(`
        SELECT aircraft_id, hex, flight, tail, aircraft_type,
               current_lat, current_lon, current_altitude,
               current_speed, current_heading, last_seen
        FROM aircraft_tracks
        WHERE current_lat IS NOT NULL 
          AND current_lon IS NOT NULL
          AND last_seen > datetime('now', '-1 hour')
        ORDER BY last_seen DESC
      `).all();

            // Convert ACARS messages to position format
            const seen = new Set();
            const acarsFormatted = acarsPositions.filter(pos => {
                const dedupeKey = `${pos.flight || 'unknown'}_${pos.tail || 'unknown'}_${pos.position_lat}_${pos.position_lon}`;
                if (!pos.flight && !pos.tail) return false;

                if (!seen.has(dedupeKey)) {
                    seen.add(dedupeKey);
                    return true;
                }
                return false;
            }).map(row => JSON.parse(row.raw_json));

            // Convert ADS-B tracks to position format
            const adsbFormatted = adsbTracks.map(track => ({
                id: track.aircraft_id,
                hex: track.hex,
                tail: track.tail || track.hex,
                flight: track.flight || track.tail || track.hex,
                aircraft_type: track.aircraft_type,
                position: {
                    lat: track.current_lat,
                    lon: track.current_lon,
                    altitude: track.current_altitude
                },
                velocity: track.current_speed,
                heading: track.current_heading,
                timestamp: track.last_seen,
                source: {
                    type: 'adsb',
                    station_id: 'aircraft_tracker'
                },
                category: 'adsb'
            }));

            // Combine both sources
            return [...acarsFormatted, ...adsbFormatted];
        } catch (error) {
            console.error('Error getting aircraft positions:', error);
            return [];
        }
    }

    saveHFGCSAircraft(aircraft) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO hfgcs_aircraft (
          aircraft_id, aircraft_type, hex, callsign, tail,
          first_detected, last_seen, total_messages,
          last_position_lat, last_position_lon, last_altitude,
          detection_method, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(aircraft_id) DO UPDATE SET
          callsign = excluded.callsign,
          tail = excluded.tail,
          last_seen = excluded.last_seen,
          total_messages = excluded.total_messages,
          last_position_lat = excluded.last_position_lat,
          last_position_lon = excluded.last_position_lon,
          last_altitude = excluded.last_altitude,
          updated_at = CURRENT_TIMESTAMP
      `);

            stmt.run(
                aircraft.aircraft_id,
                aircraft.aircraft_type,
                aircraft.hex,
                aircraft.callsign,
                aircraft.tail,
                aircraft.first_detected,
                aircraft.last_seen,
                aircraft.total_messages,
                aircraft.last_position_lat,
                aircraft.last_position_lon,
                aircraft.last_altitude,
                aircraft.detection_method
            );

            return true;
        } catch (error) {
            console.error('Error saving HFGCS aircraft:', error);
            return false;
        }
    }

    getActiveHFGCSAircraft(limit = 50, hoursBack = 24) {
        try {
            // Get aircraft seen within the last N hours
            const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();

            const stmt = this.db.prepare(`
        SELECT * FROM hfgcs_aircraft 
        WHERE last_seen > ?
        ORDER BY last_seen DESC 
        LIMIT ?
      `);

            return stmt.all(cutoffTime, limit);
        } catch (error) {
            console.error('Error getting active HFGCS aircraft:', error);
            return [];
        }
    }

    getHFGCSAircraftById(id) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM hfgcs_aircraft 
        WHERE aircraft_id = ? OR hex = ? OR callsign = ? OR tail = ?
      `);

            return stmt.get(id, id, id, id);
        } catch (error) {
            console.error('Error getting HFGCS aircraft by ID:', error);
            return null;
        }
    }

    getHFGCSStatistics() {
        try {
            const stats = {
                total: 0,
                e6b_count: 0,
                e4b_count: 0,
                total_messages: 0,
                last_activity: null
            };

            // Get total counts by type
            const typeCounts = this.db.prepare(`
        SELECT aircraft_type, COUNT(*) as count, SUM(total_messages) as messages
        FROM hfgcs_aircraft
        GROUP BY aircraft_type
      `).all();

            typeCounts.forEach(row => {
                if (row.aircraft_type === 'E-6B') {
                    stats.e6b_count = row.count;
                } else if (row.aircraft_type === 'E-4B') {
                    stats.e4b_count = row.count;
                }
                stats.total_messages += row.messages || 0;
            });

            stats.total = stats.e6b_count + stats.e4b_count;

            // Get last activity
            const lastActivity = this.db.prepare(`
        SELECT last_seen FROM hfgcs_aircraft
        ORDER BY last_seen DESC
        LIMIT 1
      `).get();

            if (lastActivity) {
                stats.last_activity = lastActivity.last_seen;
            }

            return stats;
        } catch (error) {
            console.error('Error getting HFGCS statistics:', error);
            return {
                total: 0,
                e6b_count: 0,
                e4b_count: 0,
                total_messages: 0,
                last_activity: null
            };
        }
    }

    getHFGCSHistory(days = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffISO = cutoffDate.toISOString();

            const stmt = this.db.prepare(`
        SELECT * FROM hfgcs_aircraft 
        WHERE last_seen >= ?
        ORDER BY last_seen DESC
      `);

            return stmt.all(cutoffISO);
        } catch (error) {
            console.error('Error getting HFGCS history:', error);
            return [];
        }
    }

    saveAircraftPhotos(tail, photos) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO aircraft_photos (
          aircraft_tail, photo_url, thumbnail_url, photographer,
          upload_date, source, aircraft_type, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(aircraft_tail, photo_url) DO UPDATE SET
          photographer = excluded.photographer,
          upload_date = excluded.upload_date,
          source = excluded.source,
          aircraft_type = excluded.aircraft_type,
          fetched_at = CURRENT_TIMESTAMP
      `);

            let insertedCount = 0;
            for (const photo of photos) {
                try {
                    stmt.run(
                        tail,
                        photo.url,
                        photo.thumbnail_url || null,
                        photo.photographer || null,
                        photo.upload_date || null,
                        photo.source || null,
                        photo.aircraft_type || null
                    );
                    insertedCount++;
                } catch (error) {
                    console.error('Error inserting photo:', error);
                }
            }

            console.log(`💾 Saved ${insertedCount} photos for ${tail}`);
            return true;
        } catch (error) {
            console.error('Error saving aircraft photos:', error);
            return false;
        }
    }

    getAircraftPhotos(identifier, limit = 10) {
        try {
            // Try to find photos by tail first, then by other identifiers
            let stmt = this.db.prepare(`
        SELECT * FROM aircraft_photos WHERE aircraft_tail = ?
        ORDER BY upload_date DESC, fetched_at DESC
        LIMIT ?
      `);

            let photos = stmt.all(identifier, limit);

            // If no photos found, try to find aircraft by identifier and use its tail
            if (photos.length === 0) {
                const aircraft = this.getAircraftByIdentifier(identifier);
                if (aircraft && aircraft.tail && aircraft.tail !== identifier) {
                    stmt = this.db.prepare(`
            SELECT * FROM aircraft_photos WHERE aircraft_tail = ?
            ORDER BY upload_date DESC, fetched_at DESC
            LIMIT ?
          `);
                    photos = stmt.all(aircraft.tail, limit);
                }
            }

            return photos;
        } catch (error) {
            console.error('Error getting aircraft photos:', error);
            return [];
        }
    }

    deleteStalePhotos(daysToKeep = 30) {
        try {
            const stmt = this.db.prepare(`
        DELETE FROM aircraft_photos 
        WHERE fetched_at < datetime('now', '-' || ? || ' days')
      `);

            const result = stmt.run(daysToKeep);
            console.log(`🗑️  Deleted ${result.changes} stale photos older than ${daysToKeep} days`);
            return result.changes;
        } catch (error) {
            console.error('Error deleting stale photos:', error);
            return 0;
        }
    }

    getPhotoStats() {
        try {
            const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_photos,
          COUNT(DISTINCT aircraft_tail) as aircraft_with_photos,
          source,
          COUNT(*) as count_by_source
        FROM aircraft_photos
        GROUP BY source
      `).all();

            const totalStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT aircraft_tail) as unique_aircraft
        FROM aircraft_photos
      `).get();

            const bySource = {};
            stats.forEach(stat => {
                if (stat.source) {
                    bySource[stat.source] = stat.count_by_source;
                }
            });

            return {
                totalPhotos: totalStats.total,
                aircraftWithPhotos: totalStats.unique_aircraft,
                bySource: bySource
            };
        } catch (error) {
            console.error('Error getting photo stats:', error);
            return {
                totalPhotos: 0,
                aircraftWithPhotos: 0,
                bySource: {}
            };
        }
    }

    updatePhotoVerification(photoId, verified = true) {
        try {
            const stmt = this.db.prepare(`
        UPDATE aircraft_photos 
        SET last_verified = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

            stmt.run(photoId);
            return true;
        } catch (error) {
            console.error('Error updating photo verification:', error);
            return false;
        }
    }

    // Maintenance method
    clearStaleAircraft(olderThanHours = 24) {
        try {
            const stmt = this.db.prepare(`
        DELETE FROM aircraft_tracks 
        WHERE last_seen < datetime('now', '-' || ? || ' hours')
      `);

            const result = stmt.run(olderThanHours);
            console.log(`🗑️  Deleted ${result.changes} stale aircraft (older than ${olderThanHours} hours)`);

            return result.changes;
        } catch (error) {
            console.error('Error clearing stale aircraft:', error);
            return 0;
        }
    }
}

module.exports = AircraftRepository;

const BaseRepository = require('./base-repository');

class EAMRepository extends BaseRepository {
    saveEAMMessage(data) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO eam_messages (
          message_type, header, message_body, message_length,
          confidence_score, first_detected, last_detected,
          recording_ids, raw_transcription, codeword, time_code, authentication,
          multi_segment, segment_count, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            const result = stmt.run(
                data.message_type,
                data.header,
                data.message_body,
                data.message_length,
                data.confidence_score,
                data.first_detected,
                data.last_detected,
                data.recording_ids,
                data.raw_transcription,
                data.codeword,
                data.time_code,
                data.authentication,
                data.multi_segment || 0,
                data.segment_count || 1,
                data.duration_seconds || null
            );

            return result.lastInsertRowid;
        } catch (error) {
            console.error('Error saving EAM message:', error);
            throw error;
        }
    }

    updateEAMRepeat(eamId, newRecordingIds) {
        try {
            // Get current recording_ids
            const current = this.db.prepare('SELECT recording_ids, repeat_count FROM eam_messages WHERE id = ?').get(eamId);

            if (!current) {
                throw new Error(`EAM message ${eamId} not found`);
            }

            const recordingIds = JSON.parse(current.recording_ids || '[]');

            // Handle both array and single ID inputs
            const idsToAdd = Array.isArray(newRecordingIds) ? newRecordingIds : [newRecordingIds];

            // Add only unique IDs
            for (const id of idsToAdd) {
                if (!recordingIds.includes(id)) {
                    recordingIds.push(id);
                }
            }

            const stmt = this.db.prepare(`
        UPDATE eam_messages 
        SET repeat_count = repeat_count + 1,
            recording_ids = ?,
            last_detected = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

            stmt.run(JSON.stringify(recordingIds), new Date().toISOString(), eamId);
            return true;
        } catch (error) {
            console.error('Error updating EAM repeat:', error);
            throw error;
        }
    }

    getEAMMessages(options = {}) {
        try {
            const {
                messageType = null,
                minConfidence = 0,
                limit = 100,
                offset = 0,
                orderBy = 'first_detected DESC'
            } = options;

            let query = 'SELECT * FROM eam_messages WHERE 1=1';
            const params = [];

            if (messageType) {
                query += ' AND message_type = ?';
                params.push(messageType);
            }

            if (minConfidence > 0) {
                query += ' AND confidence_score >= ?';
                params.push(minConfidence);
            }

            query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const stmt = this.db.prepare(query);
            const messages = stmt.all(...params);

            // Parse recording_ids JSON
            return messages.map(msg => ({
                ...msg,
                recording_ids: JSON.parse(msg.recording_ids || '[]')
            }));
        } catch (error) {
            console.error('Error getting EAM messages:', error);
            return [];
        }
    }

    getEAMById(id) {
        try {
            const stmt = this.db.prepare('SELECT * FROM eam_messages WHERE id = ?');
            const message = stmt.get(id);

            if (!message) {
                return null;
            }

            return {
                ...message,
                recording_ids: JSON.parse(message.recording_ids || '[]')
            };
        } catch (error) {
            console.error('Error getting EAM by ID:', error);
            return null;
        }
    }

    getEAMStatistics() {
        try {
            const totalStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          AVG(confidence_score) as avg_confidence,
          MAX(first_detected) as most_recent
        FROM eam_messages
      `).get();

            const byType = this.db.prepare(`
        SELECT message_type, COUNT(*) as count
        FROM eam_messages
        GROUP BY message_type
      `).all();

            const byConfidence = this.db.prepare(`
        SELECT 
          SUM(CASE WHEN confidence_score < 51 THEN 1 ELSE 0 END) as low,
          SUM(CASE WHEN confidence_score >= 51 AND confidence_score <= 75 THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN confidence_score > 75 THEN 1 ELSE 0 END) as high
        FROM eam_messages
      `).get();

            return {
                total: totalStats.total,
                averageConfidence: Math.round(totalStats.avg_confidence || 0),
                mostRecent: totalStats.most_recent,
                byType: byType.reduce((acc, item) => {
                    acc[item.message_type] = item.count;
                    return acc;
                }, {}),
                confidenceRanges: {
                    low: byConfidence.low,
                    medium: byConfidence.medium,
                    high: byConfidence.high
                }
            };
        } catch (error) {
            console.error('Error getting EAM statistics:', error);
            return null;
        }
    }

    searchEAMs(query, limit = 50) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM eam_messages 
        WHERE message_body LIKE ? 
           OR header LIKE ?
           OR codeword LIKE ?
        ORDER BY first_detected DESC
        LIMIT ?
      `);

            const searchPattern = `%${query}%`;
            const messages = stmt.all(searchPattern, searchPattern, searchPattern, limit);

            return messages.map(msg => ({
                ...msg,
                recording_ids: JSON.parse(msg.recording_ids || '[]')
            }));
        } catch (error) {
            console.error('Error searching EAMs:', error);
            return [];
        }
    }

    getEAMsByRecordingId(segmentId) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM eam_messages 
        WHERE recording_ids LIKE ?
        ORDER BY first_detected DESC
      `);

            const messages = stmt.all(`%${segmentId}%`);

            return messages.map(msg => ({
                ...msg,
                recording_ids: JSON.parse(msg.recording_ids || '[]')
            })).filter(msg => msg.recording_ids.includes(segmentId));
        } catch (error) {
            console.error('Error getting EAMs by recording ID:', error);
            return [];
        }
    }

    clearEAMs(olderThanDays = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const stmt = this.db.prepare(`
        DELETE FROM eam_messages 
        WHERE first_detected < ?
      `);

            const result = stmt.run(cutoffDate.toISOString());
            return result.changes;
        } catch (error) {
            console.error('Error clearing old EAMs:', error);
            return 0;
        }
    }

    deleteEAM(id) {
        try {
            const stmt = this.db.prepare('DELETE FROM eam_messages WHERE id = ?');
            const result = stmt.run(id);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting EAM:', error);
            return false;
        }
    }
}

module.exports = EAMRepository;

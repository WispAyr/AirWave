/**
 * EAM Segment Aggregator
 * Aggregates related recording segments for multi-segment EAM detection
 */

class EAMSegmentAggregator {
  constructor(database) {
    this.database = database;
    this.timeWindowSeconds = 120; // ±2 minutes
    this.maxSegmentsToAggregate = 10;
    
    // Cache to track processed segment combinations
    this.processedSegments = new Map(); // Key: sorted segment IDs, Value: { eamId, timestamp }
    this.cacheTTL = 600000; // 10 minutes in milliseconds
    
    // Periodically clean cache
    setInterval(() => this.cleanCache(), 60000); // Every minute
  }

  /**
   * Get related segments from same feed within time window
   * @param {string} segmentId - Current segment ID
   * @param {string} feedId - Feed identifier
   * @param {string} timestamp - Center timestamp (ISO string or Unix timestamp)
   * @returns {Promise<Array>} Array of recording objects
   */
  async getRelatedSegments(segmentId, feedId, timestamp) {
    try {
      // Use database method to fetch recordings in time window
      const segments = await this.database.getRecordingsInTimeWindow(
        feedId,
        timestamp,
        this.timeWindowSeconds
      );

      // Limit to max segments
      return segments.slice(0, this.maxSegmentsToAggregate);
    } catch (error) {
      console.error('Error getting related segments:', error);
      return [];
    }
  }

  /**
   * Aggregate transcriptions from multiple segments
   * @param {Array} segments - Array of recording objects
   * @returns {Object} Aggregated transcription data
   */
  aggregateTranscriptions(segments) {
    if (!segments || segments.length === 0) {
      return {
        combinedText: '',
        segmentIds: [],
        firstTimestamp: null,
        lastTimestamp: null,
        segmentCount: 0
      };
    }

    // Sort segments by start_time chronologically
    const sortedSegments = [...segments].sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeA - timeB;
    });

    // Concatenate transcription texts with space separator
    const combinedText = sortedSegments
      .map(seg => seg.transcription_text || '')
      .filter(text => text.length > 0)
      .join(' ');

    // Track all segment IDs
    const segmentIds = sortedSegments.map(seg => seg.segment_id);

    // Get first and last timestamps
    const firstTimestamp = sortedSegments[0].start_time;
    const lastTimestamp = sortedSegments[sortedSegments.length - 1].start_time;

    // Calculate total duration span
    const durationMs = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();

    return {
      combinedText,
      segmentIds,
      firstTimestamp,
      lastTimestamp,
      segmentCount: sortedSegments.length,
      durationSeconds: Math.round(durationMs / 1000)
    };
  }

  /**
   * Determine if transcription should trigger multi-segment aggregation
   * @param {string} transcriptionText - Cleaned transcription text
   * @returns {boolean} True if aggregation should be triggered
   */
  shouldTriggerAggregation(transcriptionText) {
    if (!transcriptionText) return false;

    const upperText = transcriptionText.toUpperCase();

    // Check for EAM trigger phrases
    const hasTriggerPhrase = 
      /STAND\s*BY/i.test(upperText) ||
      /MESSAGE\s*(FOLLOWS|BEGINS)/i.test(upperText) ||
      /I\s*SAY\s*AGAIN/i.test(upperText) ||
      /AUTHENTICATION/i.test(upperText) ||
      /SKYKING/i.test(upperText);

    if (hasTriggerPhrase) return true;

    // Check for high phonetic content (15+ NATO phonetic characters)
    const phoneticPattern = /\b(ALPHA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL|INDIA|JULIET|JULIETT|KILO|LIMA|MIKE|NOVEMBER|OSCAR|PAPA|QUEBEC|ROMEO|SIERRA|TANGO|UNIFORM|VICTOR|WHISKEY|WHISKY|XRAY|X-RAY|YANKEE|ZULU)\b/gi;
    const phoneticMatches = upperText.match(phoneticPattern);
    
    if (phoneticMatches && phoneticMatches.length >= 15) return true;

    return false;
  }

  /**
   * Create overlapping sliding windows of segments for progressive detection
   * @param {Array} segments - Array of recording objects
   * @param {number} windowSize - Size of each window (default: 3)
   * @returns {Array} Array of aggregated text blocks
   */
  buildSlidingWindows(segments, windowSize = 3) {
    if (!segments || segments.length < windowSize) {
      // If we don't have enough segments, return single window with all segments
      return [this.aggregateTranscriptions(segments)];
    }

    const windows = [];
    
    // Create overlapping windows (e.g., segments 1-3, 2-4, 3-5)
    for (let i = 0; i <= segments.length - windowSize; i++) {
      const windowSegments = segments.slice(i, i + windowSize);
      const aggregated = this.aggregateTranscriptions(windowSegments);
      windows.push(aggregated);
    }

    return windows;
  }

  /**
   * Mark segment combination as processed to avoid duplicate detection
   * @param {Array} segmentIds - Array of segment IDs
   * @param {string} eamId - EAM message ID
   */
  markSegmentsProcessed(segmentIds, eamId) {
    if (!segmentIds || segmentIds.length === 0) return;

    // Create cache key from sorted segment IDs
    const cacheKey = [...segmentIds].sort().join('|');
    
    this.processedSegments.set(cacheKey, {
      eamId,
      timestamp: Date.now()
    });
  }

  /**
   * Check if segment combination has been processed
   * @param {Array} segmentIds - Array of segment IDs
   * @returns {boolean} True if already processed
   */
  isProcessed(segmentIds) {
    if (!segmentIds || segmentIds.length === 0) return false;

    const cacheKey = [...segmentIds].sort().join('|');
    return this.processedSegments.has(cacheKey);
  }

  /**
   * Clean expired entries from processed segments cache
   */
  cleanCache() {
    const now = Date.now();
    
    for (const [key, value] of this.processedSegments.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.processedSegments.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.processedSegments.size,
      ttl: this.cacheTTL
    };
  }
}

module.exports = EAMSegmentAggregator;


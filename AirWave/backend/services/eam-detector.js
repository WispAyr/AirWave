const EventEmitter = require('events');
const EAMPreprocessor = require('./eam-preprocessor');

/**
 * EAM (Emergency Action Messages) Detector Service
 * Detects and classifies EAM and Skyking messages from HFGCS transcriptions
 * Based on VE3IPS blog and monitoring community standards
 * Enhanced with multi-segment detection capabilities
 */
class EAMDetector extends EventEmitter {
  constructor(database, preprocessor = null, aggregator = null) {
    super();
    this.database = database;
    this.preprocessor = preprocessor || new EAMPreprocessor();
    this.aggregator = aggregator;
    
    // Cache recent messages for deduplication (last 100)
    this.recentMessages = new Map();
    
    // Track pending multi-segment detections
    this.pendingEAMs = new Map();
    
    // Statistics tracking
    this.stats = {
      totalDetected: 0,
      eamCount: 0,
      skykingCount: 0,
      multiSegmentCount: 0,
      lastDetection: null
    };
    
    // EAM Pattern: 6-character header repeated 3 times, stand by, message length, body, repeat
    this.eamPattern = /([A-Z0-9]{6}).*\1.*\1.*stand\s*by.*(message\s*of\s*(\d+)\s*characters|thirty|3-0).*((?:[A-Z0-9]\s*){20,})/i;
    
    // Skyking Pattern: "Skyking, Skyking, do not answer" + codeword (twice) + Time + Authentication
    this.skykingPattern = /skyking.*skyking.*do\s*not\s*answer.*([A-Z]+).*\1.*time.*(\d{2}).*authentication.*([A-Z]{2})/i;
    
    // Header extraction pattern
    this.headerPattern = /([A-Z0-9]{6})\s+\1\s+\1/i;
    
    // Message body pattern (groups of alphanumerics)
    this.bodyPattern = /(?:message|characters)[^A-Z0-9]*((?:[A-Z0-9]\s*){20,})/i;
    
    // Repeat indicator
    this.repeatPattern = /(?:I\s*say\s*again|repeat)/i;
    
    // Flexible patterns for multi-segment detection
    this.partialHeaderPattern = /([A-Z0-9]{4,6})(?:\s+\1)?/i;
    this.messageBodyPattern = /(?:[A-Z]\w+\s*){10,}/i;
    this.eamIndicatorPatterns = [
      /stand\s*by/i,
      /message\s*follows/i,
      /message\s*begins/i,
      /authentication/i,
      /I\s*say\s*again/i
    ];
  }

  /**
   * Main detection method - analyzes transcription text for EAM/Skyking patterns
   * @param {string} transcriptionText - The transcribed text to analyze
   * @param {number} segmentId - Recording segment ID
   * @param {string} feedId - Feed identifier
   * @returns {Object|null} Classification object or null if no pattern detected
   */
  async detectEAM(transcriptionText, segmentId, feedId) {
    if (!transcriptionText || typeof transcriptionText !== 'string') {
      return null;
    }

    // Preprocess transcription to clean Whisper artifacts
    const cleaned = this.preprocessor.cleanTranscription(transcriptionText);
    const normalizedText = this.preprocessor.normalizePhonetics(cleaned);
    
    // Detect EAM indicators
    const indicators = this.preprocessor.detectEAMIndicators(normalizedText);
    
    // Check if aggregation needed for multi-segment detection
    if (this.aggregator && this.aggregator.shouldTriggerAggregation(normalizedText)) {
      const multiSegmentResult = await this.detectMultiSegmentEAM(segmentId, feedId, normalizedText);
      if (multiSegmentResult) {
        return multiSegmentResult;
      }
    }
    
    // Try Skyking detection first (more specific pattern)
    const skykingResult = this.detectSkyking(normalizedText, segmentId, feedId);
    if (skykingResult) {
      return skykingResult;
    }
    
    // Try standard single-segment EAM detection
    const eamResult = this.detectStandardEAM(normalizedText, segmentId, feedId);
    if (eamResult) {
      return eamResult;
    }
    
    return null;
  }

  /**
   * Detect standard EAM messages
   */
  detectStandardEAM(text, segmentId, feedId) {
    const components = this.extractEAMComponents(text);
    
    if (!components || !components.header) {
      return null;
    }
    
    const hasRepeat = this.repeatPattern.test(text);
    const confidence = this.calculateConfidence(components, hasRepeat);
    
    // Minimum confidence threshold
    if (confidence < 30) {
      return null;
    }
    
    const eamData = {
      detected: true,
      type: 'EAM',
      header: components.header,
      message_body: components.body || '',
      message_length: components.messageLength,
      confidence_score: confidence,
      first_detected: new Date().toISOString(),
      last_detected: new Date().toISOString(),
      recording_ids: [segmentId],
      raw_transcription: text,
      feed_id: feedId,
      codeword: null,
      time_code: null,
      authentication: null
    };
    
    this.stats.totalDetected++;
    this.stats.eamCount++;
    this.stats.lastDetection = new Date().toISOString();
    
    return eamData;
  }

  /**
   * Detect multi-segment EAM by aggregating related recordings
   */
  async detectMultiSegmentEAM(segmentId, feedId, currentText) {
    try {
      // Get current recording to retrieve timestamp
      const recording = await this.database.getRecordingBySegmentId(segmentId);
      if (!recording) {
        return null;
      }

      // Get related segments from database
      const relatedSegments = await this.aggregator.getRelatedSegments(
        segmentId, 
        feedId, 
        recording.start_time
      );

      if (relatedSegments.length < 2) {
        return null; // Need at least 2 segments for multi-segment detection
      }

      // Aggregate transcriptions
      const aggregated = this.aggregator.aggregateTranscriptions(relatedSegments);

      // Check if this segment combination has already been processed
      if (this.aggregator.isProcessed(aggregated.segmentIds)) {
        console.log(`⏭️  Skipping already processed segment combination: ${aggregated.segmentIds.join(', ')}`);
        return null;
      }

      // Clean combined text
      const cleanedCombined = this.preprocessor.cleanTranscription(aggregated.combinedText);
      const normalizedCombined = this.preprocessor.normalizePhonetics(cleanedCombined);

      // Try detection on combined text
      let components = this.extractEAMComponents(normalizedCombined);
      let confidence = 0;
      let usedSegmentIds = aggregated.segmentIds;
      let usedText = aggregated.combinedText;
      let firstTimestamp = aggregated.firstTimestamp;
      let lastTimestamp = aggregated.lastTimestamp;
      let durationSeconds = aggregated.durationSeconds;

      if (components && (components.header || components.body)) {
        // Calculate confidence with multi-segment bonus
        const indicators = this.preprocessor.detectEAMIndicators(normalizedCombined);
        confidence = this.calculateMultiSegmentConfidence(
          components, 
          indicators, 
          aggregated.segmentCount
        );
      }

      // If detection failed or low confidence, try sliding windows
      if (confidence < 40 && relatedSegments.length >= 3) {
        const windows = this.aggregator.buildSlidingWindows(relatedSegments, 3);
        
        for (const window of windows) {
          const cleanedWindow = this.preprocessor.cleanTranscription(window.combinedText);
          const normalizedWindow = this.preprocessor.normalizePhonetics(cleanedWindow);
          const windowComponents = this.extractEAMComponents(normalizedWindow);
          
          if (windowComponents && (windowComponents.header || windowComponents.body)) {
            const windowIndicators = this.preprocessor.detectEAMIndicators(normalizedWindow);
            const windowConfidence = this.calculateMultiSegmentConfidence(
              windowComponents,
              windowIndicators,
              window.segmentCount
            );
            
            if (windowConfidence >= 40) {
              // Found a good window
              components = windowComponents;
              confidence = windowConfidence;
              usedSegmentIds = window.segmentIds;
              usedText = window.combinedText;
              firstTimestamp = window.firstTimestamp;
              lastTimestamp = window.lastTimestamp;
              durationSeconds = window.durationSeconds;
              console.log(`🪟 Sliding window detection succeeded (window size: ${window.segmentCount})`);
              break;
            }
          }
        }
      }

      if (components && (components.header || components.body) && confidence >= 40) {
        this.stats.totalDetected++;
        this.stats.eamCount++;
        this.stats.multiSegmentCount++;
        this.stats.lastDetection = new Date().toISOString();

        console.log(`🔗 Multi-segment EAM detected across ${usedSegmentIds.length} recordings`);

        const eamData = {
          detected: true,
          type: 'EAM',
          header: components.header,
          message_body: components.body || '',
          message_length: components.messageLength,
          confidence_score: confidence,
          first_detected: firstTimestamp,
          last_detected: lastTimestamp,
          recording_ids: usedSegmentIds,
          raw_transcription: usedText,
          feed_id: feedId,
          codeword: null,
          time_code: null,
          authentication: null,
          multi_segment: true,
          segment_count: usedSegmentIds.length,
          duration_seconds: durationSeconds
        };

        // Save and mark segments as processed
        const savedMessage = await this.saveEAM(eamData);
        this.aggregator.markSegmentsProcessed(usedSegmentIds, savedMessage.id);

        return eamData;
      }

      return null;
    } catch (error) {
      console.error('Error in multi-segment EAM detection:', error);
      return null;
    }
  }

  /**
   * Detect Skyking messages
   */
  detectSkyking(text, segmentId, feedId) {
    const components = this.extractSkykingComponents(text);
    
    if (!components || !components.codeword) {
      return null;
    }
    
    const confidence = 90; // Skyking pattern is very specific
    
    const skykingData = {
      detected: true,
      type: 'SKYKING',
      header: null,
      message_body: components.codeword,
      message_length: null,
      confidence_score: confidence,
      first_detected: new Date().toISOString(),
      last_detected: new Date().toISOString(),
      recording_ids: [segmentId],
      raw_transcription: text,
      feed_id: feedId,
      codeword: components.codeword,
      time_code: components.timeCode,
      authentication: components.authentication
    };
    
    this.stats.totalDetected++;
    this.stats.skykingCount++;
    this.stats.lastDetection = new Date().toISOString();
    
    return skykingData;
  }

  /**
   * Extract EAM components from text using regex (enhanced for multi-segment)
   */
  extractEAMComponents(text) {
    const components = {
      header: null,
      body: null,
      messageLength: null,
      repeatCount: 0
    };
    
    // Extract header (6 characters repeated, or partial 4-5 chars for multi-segment)
    let headerMatch = text.match(this.headerPattern);
    if (headerMatch) {
      components.header = headerMatch[1].toUpperCase();
    } else {
      // Try partial header pattern for fragmented messages
      headerMatch = text.match(this.partialHeaderPattern);
      if (headerMatch && headerMatch[1].length >= 4) {
        components.header = headerMatch[1].toUpperCase();
      }
    }
    
    // Extract message body using preprocessor's phonetic extraction
    const phoneticSequence = this.preprocessor.extractPhoneticSequence(text);
    if (phoneticSequence.decoded && phoneticSequence.decoded.length >= 10) {
      components.body = phoneticSequence.decoded;
    } else {
      // Fallback to original body extraction
      const bodyMatch = text.match(this.bodyPattern);
      if (bodyMatch) {
        components.body = bodyMatch[1].replace(/\s+/g, ' ').trim().toUpperCase();
      }
    }
    
    // Extract message length
    const lengthMatch = text.match(/message\s*of\s*(\d+)\s*characters/i);
    if (lengthMatch) {
      components.messageLength = parseInt(lengthMatch[1], 10);
    } else if (/thirty|3-0/i.test(text)) {
      components.messageLength = 30;
    }
    
    // Count repeats
    const repeatMatches = text.match(/I\s*say\s*again/gi);
    components.repeatCount = repeatMatches ? repeatMatches.length : 0;
    
    return components;
  }

  /**
   * Extract Skyking components from text
   */
  extractSkykingComponents(text) {
    const match = text.match(this.skykingPattern);
    
    if (!match) {
      return null;
    }
    
    return {
      codeword: match[1].toUpperCase(),
      timeCode: match[2],
      authentication: match[3].toUpperCase()
    };
  }

  /**
   * Calculate confidence score based on pattern completeness
   */
  calculateConfidence(components, hasRepeat) {
    let score = 0;
    
    // Header present and valid
    if (components.header && components.header.length === 6) {
      score += 30;
    } else if (components.header && components.header.length >= 4) {
      // Partial header for multi-segment
      score += 15;
    }
    
    // Body present
    if (components.body && components.body.length >= 20) {
      score += 30;
    } else if (components.body && components.body.length >= 10) {
      // Partial body
      score += 15;
    }
    
    // Repeat detected
    if (hasRepeat) {
      score += 20;
    }
    
    // Message length declared
    if (components.messageLength) {
      score += 10;
    }
    
    // Body length matches declared length (bonus points)
    if (components.messageLength && components.body) {
      const bodyLength = components.body.replace(/\s/g, '').length;
      if (Math.abs(bodyLength - components.messageLength) <= 5) {
        score += 10;
      }
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate confidence score for multi-segment detections
   */
  calculateMultiSegmentConfidence(components, indicators, segmentCount) {
    // Start with base confidence
    const hasRepeat = indicators.hasISayAgain || indicators.hasRepeatedPatterns;
    let score = this.calculateConfidence(components, hasRepeat);

    // Add bonus for multi-segment detection (shows proper correlation)
    score += 10;

    // Add points per segment (up to +20 max) to reward temporal coherence
    const segmentBonus = Math.min((segmentCount - 1) * 5, 20);
    score += segmentBonus;

    // Add bonus if indicators span multiple segments (shows complete transmission)
    const indicatorCount = Object.values(indicators).filter(v => v === true).length;
    if (indicatorCount >= 2) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Deduplicate message against recent messages
   * If similar message found, update repeat count; otherwise save as new
   * Enhanced to handle multi-segment detections
   */
  async deduplicateMessage(newMessage) {
    if (!newMessage || !newMessage.detected) {
      return;
    }
    
    const messageHash = this.hashMessageBody(newMessage.message_body);
    
    // Check cache first
    if (this.recentMessages.has(messageHash)) {
      const existingMessage = this.recentMessages.get(messageHash);
      
      // Check for segment ID overlap for multi-segment messages
      const hasOverlap = newMessage.recording_ids.some(id => 
        existingMessage.recording_ids && 
        JSON.parse(existingMessage.recording_ids || '[]').includes(id)
      );
      
      if (hasOverlap) {
        console.log(`📝 Overlapping multi-segment ${newMessage.type} - skipping duplicate`);
        return;
      }
      
      // Check if it's truly a duplicate (85% similarity threshold on decoded body)
      const similarity = this.calculateSimilarity(
        newMessage.message_body,
        existingMessage.message_body
      );
      
      if (similarity > 85) {
        console.log(`📝 Duplicate ${newMessage.type} detected - updating repeat count`);
        
        // Update existing message with ALL new recording IDs (for multi-segment)
        const existingRecordingIds = JSON.parse(existingMessage.recording_ids || '[]');
        const newRecordingIds = newMessage.recording_ids.filter(id => !existingRecordingIds.includes(id));
        
        if (newRecordingIds.length > 0) {
          await this.database.updateEAMRepeat(
            existingMessage.id,
            newRecordingIds
          );
          
          // Update cache
          existingMessage.repeat_count++;
          existingMessage.last_detected = new Date().toISOString();
          
          this.emit('eam_repeat_detected', {
            originalId: existingMessage.id,
            newRecordingIds: newRecordingIds,
            repeatCount: existingMessage.repeat_count
          });
        }
        
        return;
      }
    }
    
    // New unique message - save to database
    const segmentInfo = newMessage.multi_segment ? ` (${newMessage.segment_count} segments)` : '';
    console.log(`💾 Saving new ${newMessage.type} message${segmentInfo}`);
    const savedMessage = await this.saveEAM(newMessage);
    
    // Add to cache
    this.recentMessages.set(messageHash, savedMessage);
    
    // Maintain cache size (keep last 100)
    if (this.recentMessages.size > 100) {
      const firstKey = this.recentMessages.keys().next().value;
      this.recentMessages.delete(firstKey);
    }
    
    // Emit appropriate event
    if (newMessage.type === 'SKYKING') {
      this.emit('skyking_detected', savedMessage);
    } else {
      this.emit('eam_detected', savedMessage);
    }
  }

  /**
   * Save EAM to database
   */
  async saveEAM(eamData) {
    const id = await this.database.saveEAMMessage({
      message_type: eamData.type,
      header: eamData.header,
      message_body: eamData.message_body,
      message_length: eamData.message_length,
      confidence_score: eamData.confidence_score,
      first_detected: eamData.first_detected,
      last_detected: eamData.last_detected,
      recording_ids: JSON.stringify(eamData.recording_ids),
      raw_transcription: eamData.raw_transcription,
      codeword: eamData.codeword,
      time_code: eamData.time_code,
      authentication: eamData.authentication,
      multi_segment: eamData.multi_segment || false,
      segment_count: eamData.segment_count || 1,
      duration_seconds: eamData.duration_seconds || null
    });
    
    return {
      id,
      ...eamData,
      repeat_count: 1,
      recording_ids: JSON.stringify(eamData.recording_ids)
    };
  }

  /**
   * Get recent EAMs from database
   */
  async getRecentEAMs(limit = 50) {
    return await this.database.getEAMMessages({ limit });
  }

  /**
   * Get specific EAM by ID
   */
  async getEAMById(id) {
    return await this.database.getEAMById(id);
  }

  /**
   * Get EAM statistics
   */
  getEAMStatistics() {
    return {
      ...this.stats,
      cacheSize: this.recentMessages.size
    };
  }

  /**
   * Normalize text for consistent pattern matching
   */
  normalizeText(text) {
    return text
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate similarity percentage between two strings
   */
  calculateSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 100;
    
    const distance = this.levenshteinDistance(str1, str2);
    return ((maxLength - distance) / maxLength) * 100;
  }

  /**
   * Create hash for message body (for deduplication key)
   */
  hashMessageBody(body) {
    // Simple hash based on normalized body
    const normalized = body.replace(/\s/g, '').toUpperCase();
    
    // Use first 20 characters as hash key
    return normalized.substring(0, 20);
  }
}

module.exports = EAMDetector;

